// ─── Content Script: Entry Point ───────────────────────────────────────────
// Injected into web pages on-demand. Routes messages from service worker
// to the appropriate DOM handler.

import { analyzePage } from './page-analyzer';
import { clickElement, typeText, scrollPage, hoverElement, pressKey, selectDropdown, toggleCheckbox } from './dom/interactor';
import { extractAllText, extractElementText, extractUrls, extractImages, extractTableData, extractEmails, extractPhoneNumbers, extractPrices, extractMeta, extractStructuredData } from './dom/extractor';
import { navigateToUrl, goBack, goForward, refreshPage } from './dom/navigator';
import { requestScreenshot } from './dom/screenshot';
import { observePageChanges, observeUrlChanges } from './dom/observer';
import {
  fillMultipleFields,
  handleAutocomplete,
  selectDate,
  selectTime,
  fillRichText,
  checkFormValidity,
  dismissPopup,
  navigateMultiStepForm,
  multiSelect,
  addToCart,
  applyCouponCode,
  viewCart,
} from './dom/form-filler';
import {
  speakText,
  stopSpeech,
  getSelectedOrMainText,
  applyHighContrast,
  applyLowContrast,
  removeContrastStyle,
  applyLargeFont,
  resetFont,
  enhanceKeyboardNavigation,
  resetKeyboardNavigation,
  focusNextInteractive,
} from './dom/accessibility';
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

  return { type: 'TOOL_RESULT', requestId: (message as any).requestId, result: { success: false, error: 'Unknown message type' } };
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

    // ─── Navigation ─────────────────────────────────────────────────────────
    case 'navigate_to_url':
      return navigateToUrl(params.url as string);
    case 'go_back':
      return goBack();
    case 'go_forward':
      return goForward();
    case 'refresh_page':
      return refreshPage();

    // ─── Interaction ─────────────────────────────────────────────────────────
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
    case 'wait_for_element': {
      const { waitForElement } = await import('./element-selector');
      const el = await waitForElement(descriptor, (params.timeout as number) || 10000);
      return { found: true, text: el.innerText?.trim().substring(0, 100) };
    }

    // ─── Extraction ──────────────────────────────────────────────────────────
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
    case 'get_page_state':
      return analyzePage();

    // ─── Phase 2: Form Tools ─────────────────────────────────────────────────

    case 'fill_text_field':
      // fill_text_field is a convenience wrapper over type_text
      return typeText(descriptor, params.value as string, (params.clearFirst as boolean) ?? true);

    case 'fill_multiple_fields':
      return fillMultipleFields(
        params.fields as Record<string, string>,
        params.formSelector as string | undefined
      );

    case 'handle_autocomplete':
      return handleAutocomplete(descriptor, params.text as string, params.optionText as string | undefined);

    case 'upload_file':
      // Trigger file input click (user must select the file)
      return clickElement(descriptor);

    case 'navigate_multi_step_form':
      return navigateMultiStepForm(
        (params.direction as 'next' | 'previous' | 'submit') || 'next',
        params.buttonText as string | undefined
      );

    case 'handle_form_validation':
      return checkFormValidity(params.selector as string | undefined);

    case 'fill_conditional_fields': {
      // 1. Set trigger field value
      const triggerDesc = buildDescriptor({ selector: params.triggerSelector as string });
      await selectDropdown(triggerDesc, params.triggerValue as string)
        .catch(() => typeText(triggerDesc, params.triggerValue as string, true));
      // 2. Wait for conditional field to appear
      await new Promise((resolve) => setTimeout(resolve, 500));
      // 3. Fill conditional field
      const condDesc = buildDescriptor({
        selector: params.conditionalSelector,
        text: params.conditionalLabel,
      });
      return typeText(condDesc, params.conditionalValue as string, true);
    }

    case 'select_date':
      return selectDate(descriptor, params.date as string);

    case 'select_time':
      return selectTime(descriptor, params.time as string);

    case 'multi_select':
      return multiSelect(
        params.selector as string | undefined,
        params.values as string[]
      );

    case 'fill_rich_text':
      return fillRichText(
        descriptor,
        params.text as string,
        (params.clearFirst as boolean) ?? true
      );

    case 'dismiss_popup':
      return dismissPopup(params.selector as string | undefined);

    // ─── Phase 2: Shopping Tools ──────────────────────────────────────────────

    case 'search_products': {
      // Find search box, type query, optionally submit
      const searchDesc = buildDescriptor({
        selector: 'input[type="search"], input[name="q"], input[name="search"], input[id*="search"], input[placeholder*="search" i]',
      });
      await typeText(searchDesc, params.query as string, true);
      if (params.submitSearch !== false) {
        await pressKey('Enter', {});
      }
      return { searched: true, query: params.query };
    }

    case 'filter_results': {
      const filterValue = params.filterValue as string;
      // Look for filter labels/checkboxes/links matching the filterValue
      const allEls = Array.from(
        document.querySelectorAll('label, a, button, [role="checkbox"], [role="option"]')
      ) as HTMLElement[];
      const match = allEls.find((el) =>
        el.textContent?.trim().toLowerCase().includes(filterValue.toLowerCase())
      );
      if (match) {
        match.scrollIntoView({ block: 'center' });
        match.click();
        return { filtered: true, appliedFilter: filterValue };
      }
      return { filtered: false, error: `Filter "${filterValue}" not found` };
    }

    case 'sort_products': {
      const sortBy = (params.sortBy as string).toLowerCase();
      // Try a <select> sort dropdown first
      const sortSelect = document.querySelector(
        'select[class*="sort"], select[id*="sort"], select[name*="sort"]'
      ) as HTMLSelectElement | null;
      if (sortSelect) {
        for (const opt of sortSelect.options) {
          if (opt.textContent?.toLowerCase().includes(sortBy)) {
            sortSelect.value = opt.value;
            sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
            return { sorted: true, by: sortBy };
          }
        }
      }
      // Fall back to clicking a sort button
      const btns = Array.from(document.querySelectorAll('button, a, [role="option"]')) as HTMLElement[];
      const btn = btns.find((el) => el.textContent?.toLowerCase().includes(sortBy));
      if (btn) { btn.click(); return { sorted: true, by: sortBy }; }
      return { sorted: false, error: `Sort option "${sortBy}" not found` };
    }

    case 'view_product_details': {
      if (params.productName) {
        const allLinks = Array.from(document.querySelectorAll('a, [class*="product-card"], [class*="product-item"]')) as HTMLElement[];
        const match = allLinks.find((el) =>
          el.textContent?.toLowerCase().includes((params.productName as string).toLowerCase())
        );
        if (match) { match.click(); return { opened: true }; }
      }
      if (params.selector) {
        const el = document.querySelector(params.selector as string) as HTMLElement | null;
        if (el) { el.click(); return { opened: true }; }
      }
      return { opened: false };
    }

    case 'read_reviews':
      return extractAllText(); // Page text contains reviews; LLM filters them

    case 'compare_products':
      return analyzePage(); // LLM compares from page state

    case 'check_stock': {
      const text = extractAllText() as { text: string };
      const lower = (typeof text === 'string' ? text : (text as any).text || '').toLowerCase();
      const inStock = lower.includes('in stock') || lower.includes('add to cart') || lower.includes('available');
      const outOfStock = lower.includes('out of stock') || lower.includes('sold out') || lower.includes('unavailable');
      return { inStock: inStock && !outOfStock, status: outOfStock ? 'Out of stock' : inStock ? 'In stock' : 'Unknown' };
    }

    case 'get_pricing':
    case 'track_price':
      return extractPrices();

    case 'add_to_cart':
      return addToCart(params.selector as string | undefined);

    case 'remove_from_cart': {
      const removeKeywords = ['remove', 'delete', 'trash', '×', 'x'];
      const allBtns = Array.from(
        document.querySelectorAll('button, [class*="remove"], [class*="delete"]')
      ) as HTMLElement[];
      if (params.productName) {
        // Find the cart row containing the product name, then find remove button
        const rows = Array.from(document.querySelectorAll('[class*="cart-item"], [class*="line-item"], tr')) as HTMLElement[];
        const row = rows.find((r) => r.textContent?.toLowerCase().includes((params.productName as string).toLowerCase()));
        if (row) {
          const btn = row.querySelector('button') as HTMLElement | null;
          if (btn) { btn.click(); return { removed: true }; }
        }
      }
      const removeBtn = allBtns.find((btn) =>
        removeKeywords.some((k) => btn.textContent?.trim().toLowerCase() === k)
      );
      if (removeBtn) { removeBtn.click(); return { removed: true }; }
      return { removed: false };
    }

    case 'update_quantity': {
      const qtyInputs = Array.from(
        document.querySelectorAll('input[type="number"], input[class*="qty"], input[class*="quantity"]')
      ) as HTMLInputElement[];
      const input = qtyInputs[0];
      if (input) {
        input.focus();
        input.value = String(params.quantity);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return { updated: true, quantity: params.quantity };
      }
      return { updated: false };
    }

    case 'view_cart':
      return viewCart();

    case 'apply_coupon':
      return applyCouponCode(params.code as string);

    case 'calculate_shipping':
    case 'add_billing_address':
      // These fill forms — LLM will use fill_multiple_fields with the address data
      return { instruction: 'Use fill_multiple_fields to fill the address/shipping form fields.' };

    case 'select_shipping_method': {
      const method = (params.method as string).toLowerCase();
      const allRadios = Array.from(document.querySelectorAll('input[type="radio"], [class*="shipping-option"]')) as HTMLElement[];
      const radio = allRadios.find((el) => {
        const label = el.closest('label') || document.querySelector(`label[for="${(el as HTMLInputElement).id}"]`);
        return label?.textContent?.toLowerCase().includes(method);
      });
      if (radio) { radio.click(); return { selected: true, method: params.method }; }
      return { selected: false };
    }

    case 'review_order':
      return analyzePage(); // LLM reads order summary from page state

    // ─── Phase 2: Research Tools (most use existing tools via LLM) ───────────

    case 'web_search': {
      const engine = (params.engine as string) || 'google';
      const engines: Record<string, string> = {
        google: 'https://www.google.com/search?q=',
        bing: 'https://www.bing.com/search?q=',
        duckduckgo: 'https://duckduckgo.com/?q=',
      };
      const url = engines[engine] + encodeURIComponent(params.query as string);
      navigateToUrl(url);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (params.extractResults !== false) {
        return extractAllText();
      }
      return { navigated: true, url };
    }

    case 'collect_data':
    case 'compare_options':
    case 'monitor_information':
    case 'extract_statistics':
    case 'find_competitors':
    case 'research_person':
    case 'find_contact_info':
    case 'check_stock_price':
    case 'find_job_listings':
    case 'compare_salary_data':
      // These are LLM-guided research tasks; extract page text for the LLM to analyse
      return extractAllText();

    // ─── Email tools (work within open web email clients) ────────────────────
    // Most email tools read/click through the page — the LLM uses page state + click/type
    case 'read_emails':
    case 'search_emails':
    case 'filter_emails':
    case 'extract_email_address':
    case 'extract_contact_info':
      return extractAllText();

    case 'compose_email':
    case 'create_draft': {
      // Click the Compose / New Email button
      const composePatterns = ['compose', 'new email', 'new message', 'write'];
      const btns = Array.from(document.querySelectorAll('button, a, [role="button"]')) as HTMLElement[];
      const composeBtn = btns.find((el) =>
        composePatterns.some((p) => el.textContent?.toLowerCase().includes(p))
      );
      if (composeBtn) composeBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { composing: true };
    }

    case 'mark_read_unread':
    case 'archive_email':
    case 'delete_email':
    case 'add_label':
    case 'mark_spam':
    case 'move_to_folder':
    case 'create_folder':
    case 'unsubscribe':
    case 'send_email':
    case 'reply_to_email':
    case 'forward_email':
    case 'select_payment_method':
      // These are handled via click_element + the LLM navigating the UI
      return clickElement(descriptor);

    case 'create_contact':
    case 'update_contact':
    case 'delete_contact':
      return { instruction: 'Use navigate and fill_multiple_fields to manage contacts.' };

    // ─── Phase 3: Calendar / Booking ─────────────────────────────────────────
    case 'check_availability':
    case 'view_week':
    case 'view_month':
    case 'find_meeting_time':
    case 'check_booking_availability':
      return extractAllText();

    case 'create_event':
    case 'edit_event':
    case 'add_attendees':
    case 'set_reminder':
    case 'add_special_requests':
    case 'modify_reservation':
      return fillMultipleFields(params as Record<string, string>);

    case 'delete_event':
    case 'reschedule_meeting':
    case 'send_invites':
    case 'cancel_booking':
    case 'book_flight':
    case 'book_hotel':
    case 'book_restaurant':
    case 'book_appointment':
      return clickElement(descriptor);

    // ─── Phase 3: Content / CMS ───────────────────────────────────────────────
    case 'create_blog_post':
    case 'edit_content':
    case 'format_text':
    case 'edit_for_tone':
    case 'check_grammar':
    case 'create_headline':
    case 'create_image_caption': {
      // These work within the active editor — fall through to page text for LLM
      return extractAllText();
    }

    case 'publish_content':
    case 'upload_image':
    case 'create_social_post':
    case 'reply_to_comment':
    case 'share_post': {
      const submitBtns = Array.from(
        document.querySelectorAll('button[type="submit"], button')
      ) as HTMLElement[];
      const publishBtn = submitBtns.find((el) =>
        /(publish|post|share|submit|send)/i.test(el.textContent || '')
      );
      if (publishBtn) publishBtn.click();
      return { clicked: !!publishBtn };
    }

    case 'schedule_post':
    case 'schedule_tweet':
      return fillMultipleFields({ publishAt: params.publishAt as string, scheduledAt: params.scheduledAt as string });

    case 'add_video': {
      const urlInput = document.querySelector('input[placeholder*="URL" i], input[placeholder*="link" i], input[placeholder*="embed" i]') as HTMLInputElement | null;
      if (urlInput) {
        urlInput.focus();
        urlInput.value = params.videoUrl as string;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        urlInput.dispatchEvent(new Event('change', { bubbles: true }));
        return { inserted: true };
      }
      return { inserted: false };
    }

    case 'like_follow': {
      const action = (params.action as string).toLowerCase();
      const btns = Array.from(document.querySelectorAll('button, [role="button"]')) as HTMLElement[];
      const btn = btns.find((el) => new RegExp(action, 'i').test(el.textContent || el.getAttribute('aria-label') || ''));
      if (btn) { btn.click(); return { success: true, action }; }
      return { success: false, error: `No "${action}" button found` };
    }

    case 'add_hashtags': {
      const composer = document.querySelector(
        '[contenteditable="true"], textarea[class*="compose"], textarea[placeholder*="tweet" i], textarea[placeholder*="post" i]'
      ) as HTMLElement | null;
      if (composer) {
        composer.focus();
        const text = params.hashtags as string;
        document.execCommand('insertText', false, ' ' + text);
        return { inserted: true, hashtags: text };
      }
      return { inserted: false };
    }

    case 'monitor_mentions': {
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLInputElement | null;
      if (searchInput) {
        searchInput.value = params.keyword as string;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await pressKey('Enter', {});
        await new Promise((r) => setTimeout(r, 1000));
      }
      return extractAllText();
    }

    // ─── Phase 3: CRM ─────────────────────────────────────────────────────────
    case 'create_lead':
    case 'create_opportunity':
      return fillMultipleFields(params as Record<string, string>);

    case 'update_lead_status':
    case 'log_interaction':
    case 'schedule_followup':
    case 'add_notes':
    case 'send_followup_email':
      return extractAllText();

    // ─── Phase 4: Vision / Layout ─────────────────────────────────────────────
    case 'identify_ui_elements': {
      const typeFilter = (params.elementType as string) || 'all';
      const scope = params.selector ? document.querySelector(params.selector as string) || document : document;
      const selector = typeFilter === 'all'
        ? 'button, input, select, textarea, a[href], [role="button"], [role="tab"], [role="menuitem"]'
        : typeFilter === 'button' ? 'button, [role="button"]'
        : typeFilter === 'input' ? 'input, textarea'
        : typeFilter === 'link' ? 'a[href]'
        : 'select';
      const elements = Array.from(scope.querySelectorAll<HTMLElement>(selector))
        .filter((el) => {
          if (params.visible === false) return true;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .slice(0, 50)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().substring(0, 60) || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          id: el.id || '',
          selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type || '',
        }));
      return { elements, count: elements.length };
    }

    case 'read_visual_content': {
      const selector = params.selector as string | undefined;
      const els = selector
        ? Array.from(document.querySelectorAll<HTMLElement>(selector))
        : Array.from(document.querySelectorAll<HTMLElement>('img, svg, canvas, figure, [class*="chart"], [class*="graph"]'));
      const descriptions = els.slice(0, 10).map((el) => ({
        tag: el.tagName.toLowerCase(),
        alt: (el as HTMLImageElement).alt || '',
        ariaLabel: el.getAttribute('aria-label') || el.getAttribute('aria-describedby') || '',
        title: el.getAttribute('title') || '',
        text: el.textContent?.trim().substring(0, 200) || '',
        src: (el as HTMLImageElement).src || '',
      }));
      return { descriptions, count: descriptions.length };
    }

    case 'describe_layout': {
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('header, nav, main, aside, footer, section, article, [role="banner"], [role="navigation"], [role="main"], [role="complementary"]')
      ).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || '',
          id: el.id || '',
          text: el.textContent?.trim().substring(0, 100) || '',
          ...(params.includeCoordinates ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : {}),
        };
      });
      return { layout: sections, title: document.title, url: location.href };
    }

    case 'verify_visual_changes': {
      const { selector: verifySelector, expectedText, shouldExist = true } = params as { selector?: string; expectedText?: string; shouldExist?: boolean };
      if (verifySelector) {
        const el = document.querySelector(verifySelector) as HTMLElement | null;
        const exists = !!el && window.getComputedStyle(el).display !== 'none';
        const textMatch = expectedText ? el?.textContent?.includes(expectedText) ?? false : true;
        return { verified: exists === shouldExist && textMatch, exists, textMatch, selector: verifySelector };
      }
      const bodyText = document.body.innerText || '';
      const found = expectedText ? bodyText.includes(expectedText) : false;
      return { verified: found === shouldExist, found, expectedText };
    }

    case 'personalise_content':
      return extractAllText();

    case 'ocr_text_from_image': {
      const imgEl = params.selector
        ? document.querySelector(params.selector as string) as HTMLImageElement | null
        : params.imageUrl
          ? Array.from(document.querySelectorAll<HTMLImageElement>('img')).find((i) => i.src === params.imageUrl) || null
          : document.querySelector<HTMLImageElement>('img');
      if (!imgEl) return { text: '', error: 'Image element not found' };
      const altText = imgEl.alt || imgEl.getAttribute('aria-label') || imgEl.title || '';
      if (params.method === 'canvas' && imgEl.src) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imgEl.naturalWidth;
          canvas.height = imgEl.naturalHeight;
          canvas.getContext('2d')?.drawImage(imgEl, 0, 0);
          return { text: altText, note: 'Canvas rendering attempted. Alt text returned as fallback.', src: imgEl.src };
        } catch {
          return { text: altText, note: 'Canvas OCR failed (CORS). Returning alt text.', src: imgEl.src };
        }
      }
      return { text: altText, src: imgEl.src };
    }

    // ─── Phase 4: Auth ─────────────────────────────────────────────────────────
    case 'login_to_account': {
      const usernameSelectors = [
        params.usernameSelector as string,
        'input[type="email"]', 'input[name="email"]', 'input[name="username"]',
        'input[id*="email" i]', 'input[id*="user" i]', 'input[placeholder*="email" i]',
      ].filter(Boolean);
      const passwordSelectors = [
        params.passwordSelector as string,
        'input[type="password"]',
      ].filter(Boolean);

      let usernameEl: HTMLInputElement | null = null;
      for (const sel of usernameSelectors) {
        usernameEl = document.querySelector<HTMLInputElement>(sel);
        if (usernameEl) break;
      }
      let passwordEl: HTMLInputElement | null = null;
      for (const sel of passwordSelectors) {
        passwordEl = document.querySelector<HTMLInputElement>(sel);
        if (passwordEl) break;
      }

      if (usernameEl) {
        await typeText({ selector: usernameEl.id ? `#${usernameEl.id}` : usernameSelectors.find(Boolean) }, params.username as string, true);
      }
      if (passwordEl) {
        await typeText({ selector: passwordEl.id ? `#${passwordEl.id}` : 'input[type="password"]' }, params.password as string, true);
      }

      const submitSel = (params.submitSelector as string) || 'button[type="submit"], input[type="submit"]';
      const submitBtn = document.querySelector<HTMLElement>(submitSel);
      if (submitBtn) submitBtn.click();

      return { attempted: true, usernameFound: !!usernameEl, passwordFound: !!passwordEl, submitClicked: !!submitBtn };
    }

    case 'logout': {
      const logoutPatterns = /sign.?out|log.?out|disconnect/i;
      const allEls = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"], [role="menuitem"]'));
      const btn = allEls.find((el) => logoutPatterns.test(el.textContent || el.getAttribute('aria-label') || ''));
      if (btn) { btn.click(); return { loggedOut: true }; }
      return { loggedOut: false, error: 'Logout button not found' };
    }

    case 'reset_password': {
      const forgotPatterns = /forgot|reset|trouble.?sign|can.?t.?access/i;
      const allLinks = Array.from(document.querySelectorAll<HTMLElement>('a, button, [role="button"]'));
      const link = allLinks.find((el) => forgotPatterns.test(el.textContent || el.getAttribute('aria-label') || ''));
      if (link) {
        link.click();
        await new Promise((r) => setTimeout(r, 800));
      }
      const emailInput = document.querySelector<HTMLInputElement>('input[type="email"], input[name="email"]');
      if (emailInput && params.email) {
        await typeText({ selector: 'input[type="email"]' }, params.email as string, true);
      }
      const submitBtn = document.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]');
      if (submitBtn) submitBtn.click();
      return { attempted: true };
    }

    case 'handle_2fa': {
      const otpSelectors = [
        params.selector as string,
        'input[name*="otp" i]', 'input[name*="code" i]', 'input[name*="token" i]',
        'input[placeholder*="code" i]', 'input[placeholder*="otp" i]',
        'input[autocomplete="one-time-code"]',
      ].filter(Boolean);
      let otpInput: HTMLInputElement | null = null;
      for (const sel of otpSelectors) {
        otpInput = document.querySelector<HTMLInputElement>(sel);
        if (otpInput) break;
      }
      if (otpInput) {
        await typeText({ selector: otpSelectors.find(Boolean) }, params.code as string, true);
        const submitBtn = document.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]');
        if (submitBtn) submitBtn.click();
        return { entered: true };
      }
      return { entered: false, error: '2FA input field not found' };
    }

    case 'create_account':
      return fillMultipleFields({
        email: params.email as string,
        password: params.password as string,
        firstName: params.firstName as string,
        lastName: params.lastName as string,
        ...(params.additionalFields as Record<string, string> || {}),
      });

    case 'update_profile':
      return fillMultipleFields(params.fields as Record<string, string>);

    case 'change_password':
      return fillMultipleFields({
        currentPassword: params.currentPassword as string,
        newPassword: params.newPassword as string,
        confirmPassword: (params.confirmPassword || params.newPassword) as string,
      });

    case 'add_security_info':
      return fillMultipleFields({ [params.type as string]: params.value as string });

    // ─── Phase 4: Accessibility ───────────────────────────────────────────────
    case 'text_to_speech': {
      const action = (params.action as string) || 'speak';
      if (action === 'stop') return stopSpeech();
      const text = (params.text as string) || getSelectedOrMainText();
      return speakText(text, {
        rate: params.rate as number,
        pitch: params.pitch as number,
        lang: params.lang as string,
      });
    }

    case 'toggle_high_contrast': {
      const mode = params.mode as string;
      if (mode === 'high') return applyHighContrast();
      if (mode === 'low') return applyLowContrast();
      removeContrastStyle();
      return { success: true, mode: 'off' };
    }

    case 'adjust_font_size': {
      const action = params.action as string;
      if (action === 'reset') return resetFont();
      const factor = (params.factor as number) || (action === 'increase' ? 1.4 : 0.85);
      return applyLargeFont(factor);
    }

    case 'enhance_keyboard_navigation': {
      const enable = params.enable !== false;
      return enable ? enhanceKeyboardNavigation() : resetKeyboardNavigation();
    }

    case 'focus_next_element':
      return focusNextInteractive((params.direction as 'next' | 'prev') || 'next');

    // ─── Phase 4: Document tools (DOM-side) ───────────────────────────────────
    case 'read_pdf':
    case 'read_document':
    case 'read_presentation':
    case 'read_spreadsheet':
      return extractAllText();

    case 'insert_text_in_document':
      return fillRichText(descriptor, params.text as string, !params.afterHeading);

    case 'add_comment_to_document': {
      const comment = params.comment as string;
      const anchor = params.anchorText as string | undefined;
      if (anchor) {
        const text = document.body.innerHTML;
        if (text.includes(anchor)) {
          // Highlight the anchor text selection (best-effort)
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node: Text | null;
          while ((node = walker.nextNode() as Text | null)) {
            if (node.textContent?.includes(anchor)) {
              const range = document.createRange();
              const idx = node.textContent.indexOf(anchor);
              range.setStart(node, idx);
              range.setEnd(node, idx + anchor.length);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
              break;
            }
          }
        }
      }
      return { comment, anchorText: anchor, note: 'Use the platform comment button to submit after selection.' };
    }

    case 'write_to_spreadsheet':
    case 'add_spreadsheet_formula':
      return fillMultipleFields({ [params.cell as string || params.range as string]: params.formula as string || String((params.values as unknown[][])?.[0]?.[0] ?? '') });

    case 'export_document':
    case 'download_document': {
      const format = (params.format as string) || 'pdf';
      const downloadBtns = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="menuitem"]'));
      const btn = downloadBtns.find((el) => new RegExp(`download|export|save.as|${format}`, 'i').test(el.textContent || el.getAttribute('aria-label') || ''));
      if (btn) { btn.click(); return { triggered: true, format }; }
      return { triggered: false, note: `Use File → Download / Export → ${format} in the editor menu.` };
    }

    case 'annotate_pdf':
    case 'add_slide':
    case 'create_chart':
      return { note: `${toolName}: Use the editor UI directly or the platform's API via google_sheets_action / google_drive_action.` };

    // ─── Phase 4: Financial (read-only DOM) ───────────────────────────────────
    case 'read_portfolio':
    case 'read_transaction_history':
    case 'read_invoice':
      return extractAllText();

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

observePageChanges(() => {
  const state = analyzePage();
  chrome.runtime.sendMessage({
    type: 'PAGE_STATE',
    requestId: 'auto',
    state,
  }).catch(() => {});
});

observeUrlChanges((_newUrl) => {
  setTimeout(() => {
    const state = analyzePage();
    chrome.runtime.sendMessage({
      type: 'PAGE_STATE',
      requestId: 'url_change',
      state,
    }).catch(() => {});
  }, 1000);
});

console.log('[Sanchalak] Content script loaded on:', window.location.href);
