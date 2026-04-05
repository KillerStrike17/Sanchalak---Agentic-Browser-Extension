// ─── Content Script: Element Selector ──────────────────────────────────────
// Multi-strategy element finding with fallback chain.

import type { ElementDescriptor } from '@shared/types/dom';

/**
 * Find an element using multiple strategies in order of reliability.
 * Falls back through: index → selector → xpath → text → ariaLabel
 */
export function findElement(descriptor: ElementDescriptor): HTMLElement | null {
  // 1. By interactive element index (fastest, from PageState)
  if (descriptor.elementIndex !== undefined) {
    const el = findByIndex(descriptor.elementIndex);
    if (el) return el;
  }

  // 2. By CSS selector (most reliable)
  if (descriptor.selector) {
    const el = document.querySelector(descriptor.selector) as HTMLElement;
    if (el) return el;
  }

  // 3. By XPath
  if (descriptor.xpath) {
    const el = findByXPath(descriptor.xpath);
    if (el) return el;
  }

  // 4. By text content
  if (descriptor.text) {
    const el = findByText(descriptor.text, descriptor.tag);
    if (el) return el;
  }

  // 5. By ARIA label
  if (descriptor.ariaLabel) {
    const el = findByAriaLabel(descriptor.ariaLabel, descriptor.tag);
    if (el) return el;
  }

  return null;
}

/**
 * Wait for an element to appear in the DOM.
 */
export function waitForElement(
  descriptor: ElementDescriptor,
  timeoutMs: number = 10000
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    // Check immediately
    const existing = findElement(descriptor);
    if (existing) {
      resolve(existing);
      return;
    }

    // Set up observer
    const observer = new MutationObserver(() => {
      const el = findElement(descriptor);
      if (el) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found within ${timeoutMs}ms: ${JSON.stringify(descriptor)}`));
    }, timeoutMs);
  });
}

// ─── Internal Strategy Implementations ──────────────────────────────────────

function findByIndex(index: number): HTMLElement | null {
  const selectors = [
    'a[href]', 'button', 'input', 'select', 'textarea',
    '[role="button"]', '[role="link"]', '[role="tab"]',
    '[role="menuitem"]', '[role="checkbox"]', '[role="radio"]',
    '[onclick]', '[tabindex]',
  ];

  const seen = new Set<Element>();
  let currentIndex = 0;

  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    for (const el of nodes) {
      if (seen.has(el)) continue;
      seen.add(el);

      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = htmlEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      if (currentIndex === index) return htmlEl;
      currentIndex++;
    }
  }

  return null;
}

function findByXPath(xpath: string): HTMLElement | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as HTMLElement | null;
  } catch {
    return null;
  }
}

function findByText(text: string, tag?: string): HTMLElement | null {
  const lower = text.toLowerCase().trim();

  // Try exact match first
  const allElements = tag
    ? document.querySelectorAll(tag)
    : document.querySelectorAll('a, button, span, p, div, h1, h2, h3, h4, h5, h6, label, li, td');

  // Exact text match
  for (const el of allElements) {
    const elText = (el as HTMLElement).innerText?.trim().toLowerCase();
    if (elText === lower) return el as HTMLElement;
  }

  // Partial text match (contains)
  for (const el of allElements) {
    const elText = (el as HTMLElement).innerText?.trim().toLowerCase();
    if (elText && elText.includes(lower)) return el as HTMLElement;
  }

  // Try XPath text() match as last resort
  return findByXPath(`//*[contains(text(), "${text}")]`);
}

function findByAriaLabel(label: string, tag?: string): HTMLElement | null {
  const selector = tag
    ? `${tag}[aria-label="${CSS.escape(label)}"]`
    : `[aria-label="${CSS.escape(label)}"]`;

  const exact = document.querySelector(selector) as HTMLElement;
  if (exact) return exact;

  // Partial match
  const all = document.querySelectorAll('[aria-label]');
  for (const el of all) {
    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase();
    if (ariaLabel && ariaLabel.includes(label.toLowerCase())) {
      if (!tag || el.tagName.toLowerCase() === tag) {
        return el as HTMLElement;
      }
    }
  }

  return null;
}
