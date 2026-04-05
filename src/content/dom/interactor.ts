// ─── Content Script: DOM Interactor ────────────────────────────────────────
// Clicks, types, scrolls, hovers with human-like behavior.

import { findElement, waitForElement } from '../element-selector';
import type { ElementDescriptor } from '@shared/types/dom';
import { DEFAULT_TYPING_DELAY } from '@shared/constants';

/**
 * Click an element.
 */
export async function clickElement(descriptor: ElementDescriptor): Promise<{ clicked: boolean; text: string }> {
  const el = await waitForElement(descriptor, 5000);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(200);

  // Dispatch full mouse event sequence
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  await sleep(50);
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  return { clicked: true, text: el.innerText?.trim().substring(0, 100) || '' };
}

/**
 * Type text into an input element with human-like delays.
 */
export async function typeText(
  descriptor: ElementDescriptor,
  text: string,
  clearFirst: boolean = true,
  delayMs: number = DEFAULT_TYPING_DELAY
): Promise<{ typed: boolean }> {
  const el = await waitForElement(descriptor, 5000);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  // Focus the element
  el.focus();
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

  const input = el as HTMLInputElement;

  // Clear existing value
  if (clearFirst) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Type each character
  for (const char of text) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    input.value += char;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    await sleep(delayMs + Math.random() * 30);
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));

  return { typed: true };
}

/**
 * Scroll the page or an element.
 */
export async function scrollPage(
  direction: 'up' | 'down' | 'top' | 'bottom',
  amount?: number,
  descriptor?: ElementDescriptor
): Promise<{ scrolled: boolean; scrollPosition: number }> {
  if (descriptor) {
    // Scroll to a specific element
    const el = findElement(descriptor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);
      return { scrolled: true, scrollPosition: window.scrollY };
    }
  }

  const scrollAmount = amount || window.innerHeight * 0.8;

  switch (direction) {
    case 'up':
      window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
      break;
    case 'down':
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      break;
    case 'top':
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'bottom':
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      break;
  }

  await sleep(500);
  return { scrolled: true, scrollPosition: window.scrollY };
}

/**
 * Hover over an element.
 */
export async function hoverElement(descriptor: ElementDescriptor): Promise<{ hovered: boolean }> {
  const el = await waitForElement(descriptor, 5000);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

  await sleep(300);
  return { hovered: true };
}

/**
 * Press a keyboard key.
 */
export async function pressKey(
  key: string,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}
): Promise<{ pressed: boolean }> {
  const target = document.activeElement || document.body;

  const options: KeyboardEventInit = {
    key,
    code: getKeyCode(key),
    bubbles: true,
    ctrlKey: modifiers.ctrl || false,
    shiftKey: modifiers.shift || false,
    altKey: modifiers.alt || false,
    metaKey: modifiers.meta || false,
  };

  target.dispatchEvent(new KeyboardEvent('keydown', options));
  target.dispatchEvent(new KeyboardEvent('keypress', options));
  target.dispatchEvent(new KeyboardEvent('keyup', options));

  // Special handling for Enter on forms
  if (key === 'Enter') {
    const form = (target as HTMLElement).closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    }
  }

  return { pressed: true };
}

/**
 * Select a value from a dropdown <select> element.
 */
export async function selectDropdown(
  descriptor: ElementDescriptor,
  value: string
): Promise<{ selected: boolean; selectedText: string }> {
  const el = await waitForElement(descriptor, 5000) as HTMLSelectElement;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);
  el.focus();

  // Try matching by value first, then by text
  let found = false;
  for (const option of el.options) {
    if (option.value === value || option.textContent?.trim().toLowerCase() === value.toLowerCase()) {
      el.value = option.value;
      found = true;
      break;
    }
  }

  if (!found) {
    // Partial text match
    for (const option of el.options) {
      if (option.textContent?.trim().toLowerCase().includes(value.toLowerCase())) {
        el.value = option.value;
        found = true;
        break;
      }
    }
  }

  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));

  const selectedOption = el.options[el.selectedIndex];
  return {
    selected: found,
    selectedText: selectedOption?.textContent?.trim() || '',
  };
}

/**
 * Toggle a checkbox or radio button.
 */
export async function toggleCheckbox(
  descriptor: ElementDescriptor,
  checked?: boolean
): Promise<{ toggled: boolean; isChecked: boolean }> {
  const el = await waitForElement(descriptor, 5000) as HTMLInputElement;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  if (checked !== undefined) {
    el.checked = checked;
  } else {
    el.checked = !el.checked;
  }

  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  return { toggled: true, isChecked: el.checked };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getKeyCode(key: string): string {
  const codeMap: Record<string, string> = {
    Enter: 'Enter',
    Tab: 'Tab',
    Escape: 'Escape',
    Backspace: 'Backspace',
    Delete: 'Delete',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    Space: 'Space',
    ' ': 'Space',
  };
  return codeMap[key] || `Key${key.toUpperCase()}`;
}
