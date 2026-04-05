// ─── Content Script: DOM Navigator ─────────────────────────────────────────
// Page navigation actions.

/**
 * Navigate to a URL.
 */
export function navigateToUrl(url: string): { navigated: boolean } {
  window.location.href = url;
  return { navigated: true };
}

/**
 * Go back in browser history.
 */
export function goBack(): { navigated: boolean } {
  history.back();
  return { navigated: true };
}

/**
 * Go forward in browser history.
 */
export function goForward(): { navigated: boolean } {
  history.forward();
  return { navigated: true };
}

/**
 * Refresh the current page.
 */
export function refreshPage(): { refreshed: boolean } {
  location.reload();
  return { refreshed: true };
}
