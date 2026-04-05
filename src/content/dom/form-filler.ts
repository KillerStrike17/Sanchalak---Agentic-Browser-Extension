// ─── Content Script: Form Filler ────────────────────────────────────────────
// Advanced form interactions: smart field mapping, autocomplete, date pickers,
// rich text editors, multi-select, popup dismissal.

import { findElement, waitForElement } from '../element-selector';
import type { ElementDescriptor } from '@shared/types/dom';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fireEvents(el: Element, events: string[]): void {
  for (const name of events) {
    el.dispatchEvent(new Event(name, { bubbles: true }));
  }
}

/** Try to find a form field by its label text, placeholder, name, or aria-label */
function findFieldByLabel(label: string, form?: Element | null): HTMLElement | null {
  const scope = form || document;

  // 1. Find <label> with matching text
  const labels = Array.from(scope.querySelectorAll('label'));
  for (const lbl of labels) {
    if (lbl.textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
      const targetId = lbl.getAttribute('for');
      if (targetId) {
        const field = document.getElementById(targetId) as HTMLElement | null;
        if (field) return field;
      }
      // Label wraps the input
      const wrapped = lbl.querySelector('input, textarea, select') as HTMLElement | null;
      if (wrapped) return wrapped;
    }
  }

  // 2. Placeholder match
  const inputs = Array.from(scope.querySelectorAll('input, textarea')) as HTMLInputElement[];
  for (const el of inputs) {
    if (el.placeholder?.toLowerCase().includes(label.toLowerCase())) return el;
    if (el.name?.toLowerCase().includes(label.toLowerCase())) return el;
    if (el.getAttribute('aria-label')?.toLowerCase().includes(label.toLowerCase())) return el;
  }

  // 3. Select element by name or aria-label
  const selects = Array.from(scope.querySelectorAll('select')) as HTMLSelectElement[];
  for (const el of selects) {
    if (el.name?.toLowerCase().includes(label.toLowerCase())) return el;
    if (el.getAttribute('aria-label')?.toLowerCase().includes(label.toLowerCase())) return el;
  }

  return null;
}

// ── fill_multiple_fields ──────────────────────────────────────────────────────

export async function fillMultipleFields(
  fields: Record<string, string>,
  formSelector?: string
): Promise<{ filled: Record<string, boolean> }> {
  const form = formSelector
    ? (document.querySelector(formSelector) as HTMLFormElement | null)
    : (document.querySelector('form') as HTMLFormElement | null);

  const results: Record<string, boolean> = {};

  for (const [label, value] of Object.entries(fields)) {
    const el = findFieldByLabel(label, form) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

    if (!el) {
      results[label] = false;
      continue;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(100);
    el.focus();

    if (el.tagName === 'SELECT') {
      const select = el as HTMLSelectElement;
      for (const option of select.options) {
        if (
          option.value.toLowerCase() === value.toLowerCase() ||
          option.textContent?.trim().toLowerCase() === value.toLowerCase()
        ) {
          select.value = option.value;
          break;
        }
      }
    } else {
      (el as HTMLInputElement).value = '';
      fireEvents(el, ['input', 'change']);
      (el as HTMLInputElement).value = value;
    }

    fireEvents(el, ['input', 'change']);
    results[label] = true;
    await sleep(80);
  }

  return { filled: results };
}

// ── handle_autocomplete ───────────────────────────────────────────────────────

export async function handleAutocomplete(
  descriptor: ElementDescriptor,
  text: string,
  optionText?: string
): Promise<{ typed: boolean; optionClicked: boolean; clickedText: string }> {
  const input = await waitForElement(descriptor, 5000) as HTMLInputElement;
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  // Focus and type
  input.focus();
  input.value = '';
  fireEvents(input, ['focus', 'input', 'change']);

  for (const char of text) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    input.value += char;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    await sleep(60 + Math.random() * 40);
  }

  // Wait for the autocomplete dropdown to appear (up to 3 seconds)
  const dropdownSelectors = [
    '[role="listbox"]',
    '[role="option"]',
    '.autocomplete-suggestions',
    '.autocomplete-items',
    '.dropdown-menu li',
    '.suggestions',
    '.pac-container .pac-item', // Google Maps
    'ul[class*="suggest"]',
    'ul[class*="autocomplete"]',
    'div[class*="suggest"]',
    'div[class*="autocomplete"] li',
    'div[class*="dropdown"] li',
  ];

  let suggestionContainer: Element | null = null;
  const deadline = Date.now() + 3000;

  while (!suggestionContainer && Date.now() < deadline) {
    for (const sel of dropdownSelectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) {
        suggestionContainer = el.closest('[role="listbox"]') || el.parentElement || el;
        break;
      }
    }
    if (!suggestionContainer) await sleep(150);
  }

  if (!suggestionContainer) {
    return { typed: true, optionClicked: false, clickedText: '' };
  }

  // Find the matching option
  const items = Array.from(
    suggestionContainer.querySelectorAll('[role="option"], li, .pac-item')
  );

  let targetItem: Element | null = null;

  if (optionText) {
    targetItem =
      items.find((el) =>
        el.textContent?.toLowerCase().includes(optionText.toLowerCase())
      ) || items[0] || null;
  } else {
    targetItem = items[0] || null;
  }

  if (!targetItem) {
    return { typed: true, optionClicked: false, clickedText: '' };
  }

  const clickedText = targetItem.textContent?.trim() || '';
  (targetItem as HTMLElement).scrollIntoView({ block: 'nearest' });
  await sleep(100);
  targetItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  targetItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  targetItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  return { typed: true, optionClicked: true, clickedText };
}

// ── select_date ───────────────────────────────────────────────────────────────

export async function selectDate(
  descriptor: ElementDescriptor,
  date: string // YYYY-MM-DD
): Promise<{ selected: boolean; method: string }> {
  const el = await waitForElement(descriptor, 5000) as HTMLInputElement;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  // Native date input
  if ((el as HTMLInputElement).type === 'date') {
    el.focus();
    (el as HTMLInputElement).value = date;
    fireEvents(el, ['input', 'change']);
    return { selected: true, method: 'native' };
  }

  // Try setting value directly (some date pickers use a hidden input)
  const hiddenDate = findElement({ selector: 'input[type="date"]' }) as HTMLInputElement | null;
  if (hiddenDate) {
    hiddenDate.value = date;
    fireEvents(hiddenDate, ['input', 'change']);
    return { selected: true, method: 'hidden-input' };
  }

  // Custom calendar: click the trigger to open picker
  el.click();
  await sleep(400);

  const [year, month, day] = date.split('-').map(Number);

  // Try to find year/month navigation and day buttons
  const calendarContainer =
    document.querySelector('[class*="calendar"]') ||
    document.querySelector('[class*="datepicker"]') ||
    document.querySelector('[class*="date-picker"]') ||
    document.querySelector('[role="dialog"]');

  if (!calendarContainer) {
    // Fallback: type the date as text
    el.focus();
    (el as HTMLInputElement).value = date;
    fireEvents(el, ['input', 'change']);
    return { selected: true, method: 'text-fallback' };
  }

  // Navigate to the correct month/year
  // We'll look for month/year display and nav arrows
  let attempts = 0;
  while (attempts < 24) {
    const headerText = calendarContainer.querySelector(
      '[class*="header"], [class*="title"], [class*="caption"]'
    )?.textContent || '';

    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const currentMonthIdx = monthNames.findIndex((m) => headerText.toLowerCase().includes(m));
    const currentYearMatch = headerText.match(/\d{4}/);
    const currentYear = currentYearMatch ? parseInt(currentYearMatch[0]) : 0;

    if (currentMonthIdx === month - 1 && currentYear === year) break;

    // Click next or prev
    const isAfter =
      currentYear > year || (currentYear === year && currentMonthIdx >= month - 1);

    const navBtn = isAfter
      ? calendarContainer.querySelector('[class*="prev"], [aria-label*="previous"], button:first-child')
      : calendarContainer.querySelector('[class*="next"], [aria-label*="next"], button:last-child');

    if (navBtn) {
      (navBtn as HTMLElement).click();
      await sleep(200);
    } else {
      break;
    }
    attempts++;
  }

  // Click the day
  const dayBtns = Array.from(calendarContainer.querySelectorAll('button, td, [role="gridcell"]'));
  const dayBtn = dayBtns.find((btn) => {
    const t = btn.textContent?.trim();
    return t === String(day) || t === String(day).padStart(2, '0');
  }) as HTMLElement | null;

  if (dayBtn) {
    dayBtn.click();
    return { selected: true, method: 'calendar-click' };
  }

  return { selected: false, method: 'calendar-click-failed' };
}

// ── select_time ───────────────────────────────────────────────────────────────

export async function selectTime(
  descriptor: ElementDescriptor,
  time: string // HH:MM (24-hour)
): Promise<{ selected: boolean }> {
  const el = await waitForElement(descriptor, 5000) as HTMLInputElement;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  // Native time input
  if ((el as HTMLInputElement).type === 'time') {
    el.focus();
    (el as HTMLInputElement).value = time;
    fireEvents(el, ['input', 'change']);
    return { selected: true };
  }

  // Custom: open the picker, look for hour/minute dropdowns or inputs
  el.click();
  await sleep(400);

  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;

  // Try hour select
  const hourSelects = document.querySelectorAll('select[class*="hour"], select[name*="hour"]');
  if (hourSelects.length > 0) {
    for (const sel of hourSelects) {
      const s = sel as HTMLSelectElement;
      for (const opt of s.options) {
        const v = parseInt(opt.value);
        if (v === hours || v === hours12) { s.value = opt.value; break; }
      }
      fireEvents(s, ['change']);
    }
    const minSelects = document.querySelectorAll('select[class*="min"], select[name*="min"]');
    for (const sel of minSelects) {
      const s = sel as HTMLSelectElement;
      for (const opt of s.options) {
        if (parseInt(opt.value) === minutes) { s.value = opt.value; break; }
      }
      fireEvents(s, ['change']);
    }
    return { selected: true };
  }

  // Fallback: type the time as text
  el.focus();
  (el as HTMLInputElement).value = time;
  fireEvents(el, ['input', 'change']);
  return { selected: true };
}

// ── fill_rich_text ────────────────────────────────────────────────────────────

export async function fillRichText(
  descriptor: ElementDescriptor,
  text: string,
  clearFirst: boolean = true
): Promise<{ typed: boolean }> {
  const el = await waitForElement(descriptor, 5000) as HTMLElement;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  el.focus();

  // ContentEditable
  if (el.getAttribute('contenteditable') === 'true' || el.isContentEditable) {
    if (clearFirst) {
      document.execCommand('selectAll', false);
      document.execCommand('delete', false);
    }
    document.execCommand('insertText', false, text);
    fireEvents(el, ['input', 'change']);
    return { typed: true };
  }

  // Quill / Draft.js / ProseMirror inner editor
  const inner = el.querySelector('[contenteditable="true"]') as HTMLElement | null;
  if (inner) {
    inner.focus();
    if (clearFirst) {
      document.execCommand('selectAll', false);
      document.execCommand('delete', false);
    }
    document.execCommand('insertText', false, text);
    fireEvents(inner, ['input', 'change']);
    return { typed: true };
  }

  // Fallback: textarea
  const textarea = el.querySelector('textarea') as HTMLTextAreaElement | null;
  if (textarea) {
    textarea.focus();
    if (clearFirst) textarea.value = '';
    textarea.value += text;
    fireEvents(textarea, ['input', 'change']);
    return { typed: true };
  }

  return { typed: false };
}

// ── handle_form_validation ────────────────────────────────────────────────────

export function checkFormValidity(
  formSelector?: string
): { isValid: boolean; invalidFields: { label: string; message: string }[] } {
  const form = formSelector
    ? (document.querySelector(formSelector) as HTMLFormElement | null)
    : (document.querySelector('form') as HTMLFormElement | null);

  const invalidFields: { label: string; message: string }[] = [];

  if (!form) return { isValid: true, invalidFields: [] };

  const fields = Array.from(form.querySelectorAll('input, textarea, select')) as HTMLInputElement[];

  for (const field of fields) {
    if (!field.validity.valid) {
      // Try to find label text
      let labelText = field.getAttribute('placeholder') || field.name || field.id || field.type;
      const lbl = form.querySelector(`label[for="${field.id}"]`);
      if (lbl) labelText = lbl.textContent?.trim() || labelText;

      invalidFields.push({ label: labelText, message: field.validationMessage });
    }

    // Check for visible error messages near the field
    const parent = field.parentElement;
    if (parent) {
      const errorEl = parent.querySelector('[class*="error"], [class*="invalid"], [role="alert"]');
      if (errorEl && errorEl.textContent?.trim()) {
        const msg = errorEl.textContent.trim();
        const label = field.getAttribute('placeholder') || field.name || field.id || field.type;
        // Only add if not already captured
        if (!invalidFields.some((f) => f.label === label)) {
          invalidFields.push({ label, message: msg });
        }
      }
    }
  }

  return { isValid: invalidFields.length === 0, invalidFields };
}

// ── dismiss_popup ─────────────────────────────────────────────────────────────

export async function dismissPopup(
  selector?: string
): Promise<{ dismissed: boolean; method: string }> {
  // If a specific selector is provided, use it
  if (selector) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      el.remove();
      return { dismissed: true, method: 'selector-remove' };
    }
  }

  // Common close button patterns
  const closePatterns = [
    'button[aria-label*="close" i]',
    'button[aria-label*="dismiss" i]',
    'button[class*="close"]',
    'button[class*="dismiss"]',
    '[class*="modal__close"]',
    '[class*="dialog__close"]',
    '[class*="popup__close"]',
    '[class*="banner__close"]',
    '[class*="cookie"] button[class*="accept"]',
    '[class*="cookie"] button[class*="close"]',
    '[class*="consent"] button[class*="accept"]',
    '[class*="overlay"] button',
  ];

  for (const pattern of closePatterns) {
    const el = document.querySelector(pattern) as HTMLElement | null;
    if (el && el.getBoundingClientRect().width > 0) {
      el.click();
      await sleep(300);
      return { dismissed: true, method: `pattern: ${pattern}` };
    }
  }

  // Try pressing Escape
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(200);

  // Check if any modal/overlay is still visible
  const overlay = document.querySelector('[class*="modal"], [class*="overlay"], [class*="popup"]') as HTMLElement | null;
  if (!overlay || overlay.getBoundingClientRect().height === 0) {
    return { dismissed: true, method: 'escape-key' };
  }

  return { dismissed: false, method: 'not-found' };
}

// ── navigate_multi_step_form ──────────────────────────────────────────────────

export async function navigateMultiStepForm(
  direction: 'next' | 'previous' | 'submit',
  buttonText?: string
): Promise<{ clicked: boolean; clickedText: string }> {
  if (buttonText) {
    // Find button by exact text
    const allBtns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')) as HTMLElement[];
    const match = allBtns.find((btn) =>
      btn.textContent?.trim().toLowerCase() === buttonText.toLowerCase() ||
      (btn as HTMLInputElement).value?.toLowerCase() === buttonText.toLowerCase()
    );
    if (match) {
      match.scrollIntoView({ block: 'center' });
      await sleep(100);
      match.click();
      return { clicked: true, clickedText: match.textContent?.trim() || buttonText };
    }
  }

  const patterns: Record<string, string[]> = {
    next: ['next', 'continue', 'proceed', 'forward', '→', 'next step', 'step 2'],
    previous: ['back', 'previous', 'prev', '←', 'go back'],
    submit: ['submit', 'finish', 'complete', 'place order', 'confirm', 'send'],
  };

  const keywords = patterns[direction];
  const allBtns = Array.from(
    document.querySelectorAll('button, input[type="submit"], input[type="button"]')
  ) as HTMLElement[];

  const btn = allBtns.find((el) => {
    const text = (el.textContent?.trim() || (el as HTMLInputElement).value || '').toLowerCase();
    return keywords.some((k) => text.includes(k));
  });

  if (btn) {
    btn.scrollIntoView({ block: 'center' });
    await sleep(100);
    btn.click();
    return { clicked: true, clickedText: btn.textContent?.trim() || (btn as HTMLInputElement).value || direction };
  }

  return { clicked: false, clickedText: '' };
}

// ── multi_select ──────────────────────────────────────────────────────────────

export async function multiSelect(
  selector: string | undefined,
  values: string[]
): Promise<{ selected: string[]; failed: string[] }> {
  const selected: string[] = [];
  const failed: string[] = [];

  // Native multi-select
  const nativeSelect = selector
    ? (document.querySelector(selector) as HTMLSelectElement | null)
    : (document.querySelector('select[multiple]') as HTMLSelectElement | null);

  if (nativeSelect) {
    for (const value of values) {
      let found = false;
      for (const option of nativeSelect.options) {
        if (
          option.value.toLowerCase() === value.toLowerCase() ||
          option.textContent?.trim().toLowerCase() === value.toLowerCase()
        ) {
          option.selected = true;
          found = true;
          selected.push(value);
          break;
        }
      }
      if (!found) failed.push(value);
    }
    fireEvents(nativeSelect, ['change']);
    return { selected, failed };
  }

  // Checkbox-based multi-select
  const container = selector ? document.querySelector(selector) : document.body;
  if (!container) return { selected, failed };

  for (const value of values) {
    const checkboxes = Array.from(
      container.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[];

    const checkbox = checkboxes.find((cb) => {
      const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
      return label?.textContent?.trim().toLowerCase().includes(value.toLowerCase()) ||
        cb.value.toLowerCase() === value.toLowerCase();
    });

    if (checkbox && !checkbox.checked) {
      checkbox.scrollIntoView({ block: 'nearest' });
      await sleep(60);
      checkbox.checked = true;
      fireEvents(checkbox, ['change', 'input', 'click']);
      selected.push(value);
    } else if (!checkbox) {
      failed.push(value);
    }
  }

  return { selected, failed };
}

// ── Shopping: add_to_cart ─────────────────────────────────────────────────────

export async function addToCart(
  selector?: string
): Promise<{ added: boolean; buttonText: string }> {
  if (selector) {
    const btn = document.querySelector(selector) as HTMLElement | null;
    if (btn) {
      btn.scrollIntoView({ block: 'center' });
      await sleep(100);
      btn.click();
      return { added: true, buttonText: btn.textContent?.trim() || '' };
    }
  }

  const addToCartPatterns = [
    'add to cart', 'add to bag', 'add to basket',
    'buy now', 'add', 'purchase',
  ];

  const allBtns = Array.from(
    document.querySelectorAll('button, input[type="submit"], [role="button"]')
  ) as HTMLElement[];

  const btn = allBtns.find((el) => {
    const text = el.textContent?.trim().toLowerCase() || '';
    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
    return addToCartPatterns.some((p) => text.includes(p) || ariaLabel.includes(p));
  });

  if (btn) {
    btn.scrollIntoView({ block: 'center' });
    await sleep(100);
    btn.click();
    return { added: true, buttonText: btn.textContent?.trim() || '' };
  }

  return { added: false, buttonText: '' };
}

// ── Shopping: apply_coupon ────────────────────────────────────────────────────

export async function applyCouponCode(
  code: string
): Promise<{ applied: boolean }> {
  // Find coupon input
  const couponKeywords = ['coupon', 'promo', 'discount', 'voucher', 'gift card', 'code'];

  const allInputs = Array.from(
    document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')
  ) as HTMLInputElement[];

  const couponInput = allInputs.find((el) => {
    const attrs = [el.placeholder, el.name, el.id, el.getAttribute('aria-label') || '']
      .join(' ')
      .toLowerCase();
    return couponKeywords.some((k) => attrs.includes(k));
  });

  if (!couponInput) return { applied: false };

  couponInput.scrollIntoView({ block: 'center' });
  await sleep(100);
  couponInput.focus();
  couponInput.value = code;
  fireEvents(couponInput, ['input', 'change']);

  await sleep(200);

  // Find the apply/submit button near the coupon input
  const applyKeywords = ['apply', 'submit', 'redeem', 'add', 'use'];
  const nearbyBtns = Array.from(
    (couponInput.closest('form, [class*="coupon"]') || couponInput.parentElement || document)
      .querySelectorAll('button, input[type="submit"]')
  ) as HTMLElement[];

  const applyBtn =
    nearbyBtns.find((btn) =>
      applyKeywords.some((k) =>
        btn.textContent?.trim().toLowerCase().includes(k) ||
        (btn as HTMLInputElement).value?.toLowerCase().includes(k)
      )
    ) || nearbyBtns[0];

  if (applyBtn) {
    applyBtn.click();
    return { applied: true };
  }

  // Try pressing Enter
  couponInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return { applied: true };
}

// ── Shopping: view_cart ───────────────────────────────────────────────────────

export function viewCart(): { items: { name: string; quantity: string; price: string }[]; total: string } {
  const items: { name: string; quantity: string; price: string }[] = [];

  // Common cart row selectors
  const rowSelectors = [
    '[class*="cart-item"]',
    '[class*="cart__item"]',
    '[class*="line-item"]',
    'tr[class*="cart"]',
    '.order-item',
  ];

  for (const sel of rowSelectors) {
    const rows = document.querySelectorAll(sel);
    if (rows.length > 0) {
      for (const row of rows) {
        const name =
          row.querySelector('[class*="name"], [class*="title"], [class*="product"]')?.textContent?.trim() ||
          row.querySelector('td:first-child')?.textContent?.trim() || '';
        const quantity =
          (row.querySelector('input[type="number"]') as HTMLInputElement)?.value ||
          row.querySelector('[class*="qty"], [class*="quantity"]')?.textContent?.trim() || '';
        const price =
          row.querySelector('[class*="price"], [class*="total"]')?.textContent?.trim() || '';
        if (name) items.push({ name, quantity, price });
      }
      break;
    }
  }

  // Find total
  const totalSelectors = ['[class*="cart-total"]', '[class*="order-total"]', '[class*="total-price"]', '.total'];
  let total = '';
  for (const sel of totalSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      total = el.textContent?.trim() || '';
      break;
    }
  }

  return { items, total };
}
