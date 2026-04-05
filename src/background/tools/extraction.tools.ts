// ─── Extraction Tools ──────────────────────────────────────────────────────
// Registers all Tier 1 text extraction + reading tools.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';

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

export function registerExtractionTools(): void {
  toolRegistry.register(createContentTool({
    name: 'extract_page_text',
    description: 'Extract all visible text content from the current page.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_element_text',
    description: 'Extract text from a specific element on the page.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the element', required: false },
      { name: 'text', type: 'string', description: 'Text near the element to find', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from interactive elements list', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_table_data',
    description: 'Extract data from an HTML table as headers and rows.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the table (default: first table on page)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_urls',
    description: 'Get all links (URLs) from the current page.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_images',
    description: 'Get all image URLs and alt text from the page.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_emails',
    description: 'Find all email addresses on the page.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_phone_numbers',
    description: 'Find all phone numbers on the page.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_prices',
    description: 'Find all prices on the page with their currency.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_meta',
    description: 'Get page title, meta description, and other meta information.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_structured_data',
    description: 'Extract JSON-LD structured data (schema.org) from the page.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'get_page_state',
    description: 'Get a full analysis of the current page including all interactive elements, forms, and visible content. Use this to understand what is on the page before taking actions.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
  }));

  // Screenshot uses chrome.tabs API
  toolRegistry.register({
    name: 'take_screenshot',
    description: 'Take a screenshot of the current visible page.',
    category: 'extraction',
    safetyLevel: 'safe',
    parameters: [],
    execute: async () => {
      try {
        const screenshot = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
        return { success: true, data: { screenshot } };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  });
}
