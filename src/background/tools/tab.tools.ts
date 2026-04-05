// ─── Multi-Tab Coordination Tools ────────────────────────────────────────────
// Phase 4: Cross-tab data gathering, comparison, and coordinated actions.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, ensureContentScript } from '@shared/messaging';
import { createLogger } from '@shared/logger';

const log = createLogger('background');

export function registerTabCoordinationTools(): void {

  // ── get_all_tabs ───────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'get_all_tabs',
    description: 'List all currently open browser tabs with their IDs, URLs, and titles.',
    category: 'tab',
    safetyLevel: 'safe',
    parameters: [
      { name: 'filterUrl', type: 'string', description: 'Filter tabs whose URL contains this string', required: false },
    ],
    execute: async (params) => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const filtered = params.filterUrl
        ? tabs.filter((t) => t.url?.includes(params.filterUrl as string))
        : tabs;
      return {
        success: true,
        data: filtered.map((t) => ({
          tabId: t.id,
          title: t.title || '',
          url: t.url || '',
          active: t.active,
          index: t.index,
        })),
      };
    },
  } as Tool);

  // ── read_tab_content ──────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'read_tab_content',
    description: 'Read the page text or full page state from a specific tab (by tab ID or URL fragment).',
    category: 'tab',
    safetyLevel: 'safe',
    parameters: [
      { name: 'tabId', type: 'number', description: 'ID of the tab to read (use get_all_tabs to find IDs)', required: false },
      { name: 'urlFragment', type: 'string', description: 'URL substring to identify the tab (alternative to tabId)', required: false },
      { name: 'mode', type: 'string', description: '"text" for visible text only, "state" for full page analysis (default: "text")', required: false, enum: ['text', 'state'], default: 'text' },
    ],
    execute: async (params) => {
      let targetTabId = params.tabId as number | undefined;

      if (!targetTabId && params.urlFragment) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const match = tabs.find((t) => t.url?.includes(params.urlFragment as string));
        if (!match?.id) return { success: false, error: `No tab found with URL containing "${params.urlFragment}"` };
        targetTabId = match.id;
      }

      if (!targetTabId) return { success: false, error: 'No tabId or urlFragment provided' };

      await ensureContentScript(targetTabId);

      const toolName = params.mode === 'state' ? 'get_page_state' : 'extract_page_text';
      const response = await sendToTab<{ result: unknown }>(targetTabId, {
        type: 'EXECUTE_TOOL',
        tool: toolName,
        params: {},
        requestId: `tab_${Date.now()}`,
      });

      return response?.result as any || { success: false, error: 'No response' };
    },
  } as Tool);

  // ── compare_across_tabs ───────────────────────────────────────────────────
  toolRegistry.register({
    name: 'compare_across_tabs',
    description: 'Read text from multiple tabs and return their content side-by-side for comparison.',
    category: 'tab',
    safetyLevel: 'safe',
    parameters: [
      {
        name: 'tabIds',
        type: 'array',
        description: 'Array of tab IDs to read and compare. Use get_all_tabs first to get IDs.',
        required: false,
      },
      {
        name: 'urlFragments',
        type: 'array',
        description: 'Array of URL substrings to identify tabs (alternative to tabIds)',
        required: false,
      },
      { name: 'extractPrices', type: 'boolean', description: 'Also extract and compare prices across tabs', required: false },
    ],
    execute: async (params) => {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      let targets: { tabId: number; url: string; title: string }[] = [];

      if (params.tabIds) {
        for (const id of params.tabIds as number[]) {
          const tab = allTabs.find((t) => t.id === id);
          if (tab?.id) targets.push({ tabId: tab.id, url: tab.url || '', title: tab.title || '' });
        }
      } else if (params.urlFragments) {
        for (const frag of params.urlFragments as string[]) {
          const tab = allTabs.find((t) => t.url?.includes(frag));
          if (tab?.id) targets.push({ tabId: tab.id, url: tab.url || '', title: tab.title || '' });
        }
      } else {
        // Default: all tabs except chrome:// pages
        targets = allTabs
          .filter((t) => t.id && t.url && !t.url.startsWith('chrome'))
          .map((t) => ({ tabId: t.id!, url: t.url!, title: t.title || '' }));
      }

      const results: Record<string, unknown>[] = [];
      for (const target of targets.slice(0, 5)) { // Max 5 tabs
        try {
          await ensureContentScript(target.tabId);
          const textResp = await sendToTab<{ result: any }>(target.tabId, {
            type: 'EXECUTE_TOOL',
            tool: 'extract_page_text',
            params: {},
            requestId: `compare_${Date.now()}`,
          });

          let prices: unknown = null;
          if (params.extractPrices) {
            const priceResp = await sendToTab<{ result: any }>(target.tabId, {
              type: 'EXECUTE_TOOL',
              tool: 'extract_prices',
              params: {},
              requestId: `compare_price_${Date.now()}`,
            });
            prices = priceResp?.result?.data;
          }

          results.push({
            tabId: target.tabId,
            title: target.title,
            url: target.url,
            text: (textResp?.result as any)?.data,
            prices,
          });
        } catch (err) {
          results.push({ tabId: target.tabId, title: target.title, url: target.url, error: String(err) });
        }
      }

      return { success: true, data: { tabs: results, count: results.length } };
    },
  } as Tool);

  // ── execute_in_tab ────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'execute_in_tab',
    description: 'Execute any tool action in a specific tab (not the active one). Use get_all_tabs first.',
    category: 'tab',
    safetyLevel: 'safe',
    parameters: [
      { name: 'tabId', type: 'number', description: 'ID of the target tab', required: true },
      { name: 'toolName', type: 'string', description: 'Tool to execute in the tab', required: true },
      { name: 'params', type: 'object', description: 'Parameters for the tool', required: false },
    ],
    execute: async (params) => {
      const tabId = params.tabId as number;
      await ensureContentScript(tabId);
      const response = await sendToTab<{ result: unknown }>(tabId, {
        type: 'EXECUTE_TOOL',
        tool: params.toolName as string,
        params: (params.params as Record<string, unknown>) || {},
        requestId: `exec_tab_${Date.now()}`,
      });
      return response?.result as any || { success: false, error: 'No response' };
    },
  } as Tool);
}
