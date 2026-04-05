// ─── Type-Safe Chrome Messaging Utilities ──────────────────────────────────

import type {
  AgentMessage,
  UIToBackgroundMessage,
  BackgroundToContentMessage,
  BackgroundToUIMessage,
  RequestId,
} from './types/messages';
import { generateRequestId } from './types/messages';

/**
 * Send a message from UI (sidepanel/popup) to the background service worker.
 * Returns the response from the background.
 */
export async function sendToBackground<T = unknown>(
  message: UIToBackgroundMessage
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

/**
 * Send a message from the background service worker to a specific tab's content script.
 */
export async function sendToTab<T = unknown>(
  tabId: number,
  message: BackgroundToContentMessage
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

/**
 * Send a message from background to all connected UI contexts (sidepanel/popup).
 * Uses a port-based approach for streaming updates.
 */
const uiPorts = new Map<string, chrome.runtime.Port>();

export function registerUIPort(port: chrome.runtime.Port): void {
  const id = port.name + '_' + Date.now();
  uiPorts.set(id, port);
  port.onDisconnect.addListener(() => {
    uiPorts.delete(id);
  });
}

export function broadcastToUI(message: BackgroundToUIMessage): void {
  for (const [, port] of uiPorts) {
    try {
      port.postMessage(message);
    } catch {
      // Port was disconnected
    }
  }
}

/**
 * Register a message handler in the background service worker.
 */
export function onBackgroundMessage(
  handler: (
    message: AgentMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void
): void {
  chrome.runtime.onMessage.addListener(handler);
}

/**
 * Register a message handler in a content script.
 */
export function onContentMessage(
  handler: (
    message: BackgroundToContentMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void
): void {
  chrome.runtime.onMessage.addListener(
    handler as (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => boolean | void
  );
}

/**
 * Get the currently active tab.
 */
export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  return tab;
}

/**
 * Ensure content script is injected into a tab (on-demand injection).
 */
export async function ensureContentScript(tabId: number): Promise<void> {
  // First, try a quick ping to see if content script is already loaded
  try {
    const response = await sendToTab<{ pong?: boolean }>(tabId, { type: 'PING' as any, requestId: 'ping' });
    if (response?.pong) return;
  } catch {
    // Not loaded yet — inject it programmatically
  }

  // Programmatic injection as fallback (for tabs open before extension load)
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['assets/index.ts-loader-B6OhCzhJ.js'],
    });
    // Wait for it to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (err) {
    console.warn('[Sanchalak] Programmatic injection failed, trying dynamic lookup', err);
    // If the hashed filename changed, try to find it dynamically from the manifest
    try {
      const manifest = chrome.runtime.getManifest();
      const contentScriptFiles = manifest.content_scripts?.[0]?.js;
      if (contentScriptFiles && contentScriptFiles.length > 0) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: contentScriptFiles,
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (fallbackErr) {
      console.error('[Sanchalak] All injection methods failed:', fallbackErr);
    }
  }

  // Final ping check
  try {
    const response = await sendToTab<{ pong?: boolean }>(tabId, { type: 'PING' as any, requestId: 'ping' });
    if (response?.pong) return;
  } catch {
    console.warn('[Sanchalak] Content script still not responding after injection');
  }
}

export { generateRequestId, type RequestId };
