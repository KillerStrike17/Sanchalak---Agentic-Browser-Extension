// ─── Navigation & Interaction Tools ────────────────────────────────────────
// Registers all Tier 1 navigation + interaction tools.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';

/** Helper to create a tool that delegates to content script */
function createContentTool(tool: Omit<Tool, 'execute'>): Tool {
  return {
    ...tool,
    execute: async (params) => {
      const tab = await getActiveTab();
      if (!tab.id) throw new Error('No active tab');
      await ensureContentScript(tab.id);
      const response = await sendToTab<{ result: { success: boolean; data?: unknown; error?: string } }>(
        tab.id,
        { type: 'EXECUTE_TOOL', tool: tool.name, params, requestId: `tool_${Date.now()}` }
      );
      return response?.result || { success: false, error: 'No response from content script' };
    },
  };
}

// ─── Navigation Tools ───────────────────────────────────────────────────────

export function registerNavigationTools(): void {
  toolRegistry.register(createContentTool({
    name: 'navigate_to_url',
    description: 'Navigate the browser to a specific URL. Use this to visit websites.',
    category: 'navigation',
    safetyLevel: 'safe',
    parameters: [
      { name: 'url', type: 'string', description: 'The full URL to navigate to (include https://)', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'click_element',
    description: 'Click on an element on the page. Use selector, text, elementIndex, or ariaLabel to identify it.',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the element', required: false },
      { name: 'text', type: 'string', description: 'Visible text of the element to click', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from the interactive elements list', required: false },
      { name: 'ariaLabel', type: 'string', description: 'ARIA label of the element', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'type_text',
    description: 'Type text into an input field, textarea, or editable element.',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the input', required: false },
      { name: 'text', type: 'string', description: 'The text to type', required: true },
      { name: 'elementIndex', type: 'number', description: 'Index from the interactive elements list', required: false },
      { name: 'clearFirst', type: 'boolean', description: 'Clear existing text before typing (default: true)', required: false, default: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'scroll_page',
    description: 'Scroll the page in a direction or to a specific element.',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'direction', type: 'string', description: 'Scroll direction', required: true, enum: ['up', 'down', 'top', 'bottom'] },
      { name: 'amount', type: 'number', description: 'Pixels to scroll (default: 80% of viewport)', required: false },
      { name: 'targetSelector', type: 'string', description: 'CSS selector of element to scroll into view', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'select_dropdown',
    description: 'Select an option from a <select> dropdown element.',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the select element', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from the interactive elements list', required: false },
      { name: 'value', type: 'string', description: 'The value or visible text of the option to select', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'toggle_checkbox',
    description: 'Check or uncheck a checkbox or radio button.',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the checkbox', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from the interactive elements list', required: false },
      { name: 'checked', type: 'boolean', description: 'Set to true to check, false to uncheck. Omit to toggle.', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'submit_form',
    description: 'Submit a form on the page.',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the form to submit', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'wait_for_element',
    description: 'Wait for a specific element to appear on the page.',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector to wait for', required: false },
      { name: 'text', type: 'string', description: 'Text content to wait for', required: false },
      { name: 'timeout', type: 'number', description: 'Max wait time in ms (default: 10000)', required: false, default: 10000 },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'press_key',
    description: 'Press a keyboard key (Enter, Tab, Escape, etc.).',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'key', type: 'string', description: 'The key to press (e.g., Enter, Tab, Escape, ArrowDown)', required: true },
      { name: 'ctrl', type: 'boolean', description: 'Hold Ctrl while pressing', required: false },
      { name: 'shift', type: 'boolean', description: 'Hold Shift while pressing', required: false },
      { name: 'alt', type: 'boolean', description: 'Hold Alt while pressing', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'hover_element',
    description: 'Hover the mouse over an element to reveal tooltips or dropdowns.',
    category: 'interaction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of element to hover', required: false },
      { name: 'text', type: 'string', description: 'Visible text of element to hover', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from interactive elements list', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'go_back',
    description: 'Navigate back in browser history (like clicking the back button).',
    category: 'navigation',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'go_forward',
    description: 'Navigate forward in browser history.',
    category: 'navigation',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'refresh_page',
    description: 'Reload the current page.',
    category: 'navigation',
    safetyLevel: 'safe',
    parameters: [],
  }));

  // Tab management tools use chrome.tabs API directly
  toolRegistry.register({
    name: 'open_new_tab',
    description: 'Open a URL in a new browser tab.',
    category: 'tab',
    safetyLevel: 'safe',
    parameters: [
      { name: 'url', type: 'string', description: 'URL to open in new tab', required: true },
    ],
    execute: async (params) => {
      const tab = await chrome.tabs.create({ url: params.url as string });
      return { success: true, data: { tabId: tab.id, url: tab.url } };
    },
  });

  toolRegistry.register({
    name: 'close_tab',
    description: 'Close the current browser tab.',
    category: 'tab',
    safetyLevel: 'safe',
    parameters: [
      { name: 'tabId', type: 'number', description: 'ID of tab to close (default: current tab)', required: false },
    ],
    execute: async (params) => {
      const tabId = params.tabId as number || (await getActiveTab()).id;
      if (tabId) await chrome.tabs.remove(tabId);
      return { success: true, data: { closed: true } };
    },
  });

  toolRegistry.register({
    name: 'switch_tab',
    description: 'Switch to a different open tab.',
    category: 'tab',
    safetyLevel: 'safe',
    parameters: [
      { name: 'tabId', type: 'number', description: 'ID of tab to switch to', required: false },
      { name: 'index', type: 'number', description: 'Tab index (0-based)', required: false },
    ],
    execute: async (params) => {
      let tabId = params.tabId as number;
      if (!tabId && params.index !== undefined) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tab = tabs[params.index as number];
        if (tab?.id) tabId = tab.id;
      }
      if (tabId) {
        await chrome.tabs.update(tabId, { active: true });
        return { success: true, data: { switchedTo: tabId } };
      }
      return { success: false, error: 'Tab not found' };
    },
  });
}
