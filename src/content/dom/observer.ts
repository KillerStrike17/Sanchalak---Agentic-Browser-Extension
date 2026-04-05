// ─── Content Script: DOM Observer ──────────────────────────────────────────
// Watches for page changes using MutationObserver.

import { PAGE_ANALYSIS_DEBOUNCE } from '@shared/constants';

type PageChangeCallback = () => void;

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start observing the page for significant DOM changes.
 */
export function observePageChanges(callback: PageChangeCallback): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    // Filter out trivial changes
    const significant = mutations.some((m) => {
      // Added/removed nodes
      if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName?.toLowerCase();
            // Ignore script/style injections
            if (tag !== 'script' && tag !== 'style' && tag !== 'link') {
              return true;
            }
          }
        }
      }
      // Attribute changes on interactive elements
      if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
        const el = m.target as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (['input', 'select', 'textarea', 'button', 'a'].includes(tag)) {
          return true;
        }
      }
      return false;
    });

    if (significant) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(callback, PAGE_ANALYSIS_DEBOUNCE);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'disabled', 'hidden', 'aria-hidden'],
  });
}

/**
 * Stop observing page changes.
 */
export function stopObserving(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/**
 * Detect SPA navigation (URL changes without page reload).
 */
export function observeUrlChanges(callback: (newUrl: string) => void): void {
  let lastUrl = window.location.href;

  // Poll for URL changes (handles pushState/replaceState)
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      callback(currentUrl);
    }
  }, 1000);

  // Also listen for popstate (back/forward)
  window.addEventListener('popstate', () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      callback(currentUrl);
    }
  });
}
