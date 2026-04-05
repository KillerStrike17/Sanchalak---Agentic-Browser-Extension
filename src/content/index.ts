// ─── Content Script: Entry Point ───────────────────────────────────────────
// Injected into web pages on-demand. Routes messages from service worker
// to the appropriate DOM handler.

import { analyzePage } from './page-analyzer';
import { clickElement, typeText, scrollPage, hoverElement, pressKey, selectDropdown, toggleCheckbox } from './dom/interactor';
import { extractAllText, extractElementText, extractUrls, extractImages, extractTableData, extractEmails, extractPhoneNumbers, extractPrices, extractMeta, extractStructuredData } from './dom/extractor';
import { navigateToUrl, goBack, goForward, refreshPage } from './dom/navigator';
import { requestScreenshot } from './dom/screenshot';
import { observePageChanges, observeUrlChanges } from './dom/observer';
import type { BackgroundToContentMessage } from '@shared/types/messages';
import type { ToolResult } from '@shared/types/tools';
import type { ElementDescriptor } from '@shared/types/dom';

// ─── Message Listener ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundToContentMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    handleMessage(message).then(sendResponse).catch((err) => {
      sendResponse({
        type: 'TOOL_RESULT',
        requestId: message.requestId,
        result: { success: false, error: String(err) },
      });
    });
    return true; // Keep channel open for async response
  }
);

async function handleMessage(message: BackgroundToContentMessage): Promise<unknown> {
  // Handle ping to verify content script is loaded
  if ((message as any).type === 'PING') {
    return { pong: true };
  }

  if (message.type === 'ANALYZE_PAGE') {
    const state = analyzePage();
    return { type: 'PAGE_STATE', requestId: message.requestId, state };
  }

  if (message.type === 'EXECUTE_TOOL') {
    const result = await executeTool(message.tool, message.params);
    return { type: 'TOOL_RESULT', requestId: message.requestId, result };
  }

  return { type: 'TOOL_RESULT', requestId: message.requestId, result: { success: false, error: 'Unknown message type' } };
}

// ─── Tool Execution Dispatcher ──────────────────────────────────────────────

async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const data = await dispatchTool(toolName, params);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function dispatchTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const descriptor = buildDescriptor(params);

  switch (toolName) {
    // ─── Navigation ─────────────────────────────────────────
    case 'navigate_to_url':
      return navigateToUrl(params.url as string);
    case 'go_back':
      return goBack();
    case 'go_forward':
      return goForward();
    case 'refresh_page':
      return refreshPage();

    // ─── Interaction ────────────────────────────────────────
    case 'click_element':
      return clickElement(descriptor);
    case 'type_text':
      return typeText(descriptor, params.text as string, params.clearFirst as boolean);
    case 'scroll_page':
      return scrollPage(
        params.direction as 'up' | 'down' | 'top' | 'bottom',
        params.amount as number | undefined,
        params.targetSelector ? buildDescriptor({ selector: params.targetSelector }) : undefined
      );
    case 'hover_element':
      return hoverElement(descriptor);
    case 'press_key':
      return pressKey(params.key as string, {
        ctrl: params.ctrl as boolean,
        shift: params.shift as boolean,
        alt: params.alt as boolean,
        meta: params.meta as boolean,
      });
    case 'select_dropdown':
      return selectDropdown(descriptor, params.value as string);
    case 'toggle_checkbox':
      return toggleCheckbox(descriptor, params.checked as boolean | undefined);
    case 'submit_form':
      return submitForm(descriptor);
    case 'wait_for_element':
      const { waitForElement } = await import('./element-selector');
      const el = await waitForElement(descriptor, (params.timeout as number) || 10000);
      return { found: true, text: el.innerText?.trim().substring(0, 100) };

    // ─── Extraction ─────────────────────────────────────────
    case 'extract_page_text':
      return extractAllText();
    case 'extract_element_text':
      return extractElementText(descriptor);
    case 'extract_urls':
      return extractUrls();
    case 'extract_images':
      return extractImages();
    case 'extract_table_data':
      return extractTableData(descriptor.selector ? descriptor : undefined);
    case 'extract_emails':
      return extractEmails();
    case 'extract_phone_numbers':
      return extractPhoneNumbers();
    case 'extract_prices':
      return extractPrices();
    case 'extract_meta':
      return extractMeta();
    case 'extract_structured_data':
      return extractStructuredData();
    case 'take_screenshot':
      return requestScreenshot();

    // ─── Page Analysis ──────────────────────────────────────
    case 'get_page_state':
      return analyzePage();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

function submitForm(descriptor: ElementDescriptor): { submitted: boolean } {
  const form = descriptor.selector
    ? document.querySelector(descriptor.selector) as HTMLFormElement
    : document.querySelector('form') as HTMLFormElement;

  if (form) {
    form.dispatchEvent(new Event('submit', { bubbles: true }));
    return { submitted: true };
  }
  throw new Error('No form found');
}

function buildDescriptor(params: Record<string, unknown>): ElementDescriptor {
  return {
    selector: params.selector as string | undefined,
    xpath: params.xpath as string | undefined,
    text: params.text as string | undefined,
    ariaLabel: params.ariaLabel as string | undefined,
    elementIndex: params.elementIndex as number | undefined,
    tag: params.tag as string | undefined,
  };
}

// ─── Page Observation ───────────────────────────────────────────────────────

// Auto-analyze on significant DOM changes
observePageChanges(() => {
  const state = analyzePage();
  chrome.runtime.sendMessage({
    type: 'PAGE_STATE',
    requestId: 'auto',
    state,
  }).catch(() => {
    // Background might not be listening yet
  });
});

// Detect SPA navigations
observeUrlChanges((_newUrl) => {
  setTimeout(() => {
    const state = analyzePage();
    chrome.runtime.sendMessage({
      type: 'PAGE_STATE',
      requestId: 'url_change',
      state,
    }).catch(() => {});
  }, 1000); // Wait for new page to render
});

// Signal that content script is ready
console.log('[Sanchalak] Content script loaded on:', window.location.href);
