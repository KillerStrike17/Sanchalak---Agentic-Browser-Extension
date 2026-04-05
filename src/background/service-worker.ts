// ─── Background Service Worker: Entry Point ───────────────────────────────
// The central hub of Sanchalak. Registers all listeners and orchestrates.

import { registerNavigationTools } from './tools/navigation.tools';
import { registerExtractionTools } from './tools/extraction.tools';
import { executeTask, type PlannerCallbacks } from './agent/planner';
import { registerUIPort, broadcastToUI, getActiveTab, ensureContentScript, sendToTab } from '@shared/messaging';
import { PORT_NAMES } from '@shared/constants';
import { createLogger } from '@shared/logger';
import type { AgentMessage, BackgroundToUIMessage } from '@shared/types/messages';
import type { PageState } from '@shared/types/dom';
import type { ToolResult } from '@shared/types/tools';

const log = createLogger('background');

// ─── Initialize ─────────────────────────────────────────────────────────────

log.info('Service worker starting...');

// Register all tools
registerNavigationTools();
registerExtractionTools();
log.info('Tools registered');

// Track current task state
let isTaskRunning = false;
let pendingConfirmationResolve: ((approved: boolean) => void) | null = null;

// ─── Message Handling ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: AgentMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    log.debug('Message received', { type: message.type, from: sender.tab ? 'content' : 'ui' });

    switch (message.type) {
      case 'USER_COMMAND':
        handleUserCommand(message.text, message.requestId);
        sendResponse({ received: true });
        break;

      case 'USER_CONFIRMATION':
        if (pendingConfirmationResolve) {
          pendingConfirmationResolve(message.approved);
          pendingConfirmationResolve = null;
        }
        sendResponse({ received: true });
        break;

      case 'PAGE_STATE':
        // Auto page state from content script
        log.debug('Page state received', { url: (message as { state: PageState }).state?.url });
        sendResponse({ received: true });
        break;

      case 'CAPTURE_SCREENSHOT':
        chrome.tabs.captureVisibleTab(undefined, { format: 'png' })
          .then((screenshot) => sendResponse({ screenshot }))
          .catch((err) => sendResponse({ error: String(err) }));
        return true; // Keep channel open

      case 'GET_PAGE_STATE':
        getPageState().then((state) => sendResponse(state)).catch((err) =>
          sendResponse({ error: String(err) })
        );
        return true;

      case 'CANCEL_TASK':
        isTaskRunning = false;
        broadcastToUI({
          type: 'TASK_STATUS',
          status: 'cancelled',
          requestId: message.requestId,
        });
        sendResponse({ cancelled: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }

    return false;
  }
);

// ─── Port-based Communication (for streaming) ──────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === PORT_NAMES.SIDEPANEL || port.name === PORT_NAMES.POPUP) {
    log.info(`UI port connected: ${port.name}`);
    registerUIPort(port);

    port.onMessage.addListener((message: AgentMessage) => {
      if (message.type === 'USER_COMMAND') {
        handleUserCommand(message.text, message.requestId);
      } else if (message.type === 'USER_CONFIRMATION') {
        if (pendingConfirmationResolve) {
          pendingConfirmationResolve(message.approved);
          pendingConfirmationResolve = null;
        }
      }
    });
  }
});

// ─── Side Panel Setup ───────────────────────────────────────────────────────

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => log.error('Failed to set side panel behavior', err));

// ─── Context Menu ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sanchalak-ask',
    title: 'Ask Sanchalak about this page',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'sanchalak-extract',
    title: 'Extract text from this page',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'sanchalak-selected',
    title: 'Ask Sanchalak about "%s"',
    contexts: ['selection'],
  });

  log.info('Context menus created');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sanchalak-ask' && tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  } else if (info.menuItemId === 'sanchalak-extract' && tab?.id) {
    handleUserCommand('Extract all text from this page', `ctx_${Date.now()}`);
    chrome.sidePanel.open({ tabId: tab.id });
  } else if (info.menuItemId === 'sanchalak-selected' && info.selectionText) {
    handleUserCommand(
      `Tell me about: "${info.selectionText}"`,
      `ctx_${Date.now()}`
    );
    if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ─── Task Execution ─────────────────────────────────────────────────────────

async function handleUserCommand(text: string, requestId: string): Promise<void> {
  if (isTaskRunning) {
    broadcastToUI({
      type: 'AGENT_ERROR',
      error: 'A task is already running. Please wait for it to complete or cancel it.',
      requestId,
    });
    return;
  }

  isTaskRunning = true;
  log.info('Handling user command', { text, requestId });

  try {
    // Get current page state
    const pageState = await getPageState();

    const tab = await getActiveTab();
    const tabId = tab.id || 0;

    // Build callbacks for UI updates
    const callbacks: PlannerCallbacks = {
      onThinking: (thought) => {
        broadcastToUI({ type: 'AGENT_THINKING', thought, requestId });
      },
      onAction: (tool, params) => {
        broadcastToUI({
          type: 'TASK_STATUS',
          status: 'executing',
          stepDescription: `Running: ${tool}`,
          requestId,
        });
      },
      onResult: (tool, result) => {
        log.debug('Tool result', { tool, success: result.success });
      },
      onNeedConfirmation: (tool, params, reason) => {
        return new Promise<boolean>((resolve) => {
          pendingConfirmationResolve = resolve;
          broadcastToUI({
            type: 'CONFIRM_ACTION',
            action: tool,
            description: reason,
            details: params,
            requestId,
          });

          // Timeout after 2 minutes
          setTimeout(() => {
            if (pendingConfirmationResolve === resolve) {
              pendingConfirmationResolve = null;
              resolve(false);
            }
          }, 120000);
        });
      },
      onComplete: (response) => {
        broadcastToUI({
          type: 'AGENT_RESPONSE',
          text: response,
          requestId,
        });
      },
      onError: (error) => {
        broadcastToUI({
          type: 'AGENT_ERROR',
          error,
          requestId,
        });
      },
      onStatusChange: (status, step, total) => {
        broadcastToUI({
          type: 'TASK_STATUS',
          status: status as any,
          currentStep: step,
          totalSteps: total,
          requestId,
        });
      },
    };

    await executeTask(text, pageState, callbacks, tabId);
  } catch (err) {
    log.error('Command failed', err);
    broadcastToUI({
      type: 'AGENT_ERROR',
      error: String(err),
      requestId,
    });
  } finally {
    isTaskRunning = false;
  }
}

async function getPageState(): Promise<PageState | null> {
  try {
    const tab = await getActiveTab();
    if (!tab.id) return null;
    await ensureContentScript(tab.id);
    const response = await sendToTab<{ state: PageState }>(tab.id, {
      type: 'ANALYZE_PAGE',
      requestId: `state_${Date.now()}`,
    });
    return response?.state || null;
  } catch (err) {
    log.warn('Failed to get page state', err);
    return null;
  }
}

log.info('Service worker ready');
