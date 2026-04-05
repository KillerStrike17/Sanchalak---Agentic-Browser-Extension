// ─── Content Script: Screenshot ────────────────────────────────────────────
// Page capture (delegates to background for chrome.tabs.captureVisibleTab).

/**
 * Request a screenshot from the background service worker.
 * The content script can't call captureVisibleTab directly.
 */
export async function requestScreenshot(): Promise<{ screenshot: string }> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'CAPTURE_SCREENSHOT' },
      (response: { screenshot?: string; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.screenshot) {
          resolve({ screenshot: response.screenshot });
        } else {
          reject(new Error(response?.error || 'Screenshot failed'));
        }
      }
    );
  });
}
