// ─── Accessibility Tools ─────────────────────────────────────────────────────
// Phase 4: Text-to-speech, contrast modes, font scaling, keyboard navigation.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';

async function sendAccessibilityTool(toolName: string, params: Record<string, unknown> = {}) {
  const tab = await getActiveTab();
  if (!tab.id) throw new Error('No active tab');
  await ensureContentScript(tab.id);
  const response = await sendToTab<{ result: { success: boolean; data?: unknown; error?: string } }>(
    tab.id,
    { type: 'EXECUTE_TOOL', tool: toolName, params, requestId: `tool_${Date.now()}` }
  );
  return response?.result || { success: false, error: 'No response from content script' };
}

export function registerAccessibilityTools(): void {

  // ── text_to_speech ─────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'text_to_speech',
    description: 'Read selected text or the main page content aloud using the browser\'s built-in speech synthesis.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'text', type: 'string', description: 'Text to read aloud. If omitted, reads the current selection or main page content.', required: false },
      { name: 'rate', type: 'number', description: 'Speech rate (0.5–2.0, default: 1.0)', required: false },
      { name: 'pitch', type: 'number', description: 'Pitch (0.0–2.0, default: 1.0)', required: false },
      { name: 'lang', type: 'string', description: 'BCP 47 language tag, e.g. "en-US", "hi-IN" (default: page language)', required: false },
      { name: 'action', type: 'string', description: '"speak" to start, "stop" to stop current speech (default: "speak")', required: false, enum: ['speak', 'stop'], default: 'speak' },
    ],
    execute: async (params) => sendAccessibilityTool('text_to_speech', params),
  } as Tool);

  // ── toggle_high_contrast ───────────────────────────────────────────────────
  toolRegistry.register({
    name: 'toggle_high_contrast',
    description: 'Toggle high-contrast or low-contrast mode for better readability.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'mode', type: 'string', description: '"high" for dark background/light text, "low" for reduced contrast, "off" to restore normal', required: true, enum: ['high', 'low', 'off'] },
    ],
    execute: async (params) => sendAccessibilityTool('toggle_high_contrast', params),
  } as Tool);

  // ── adjust_font_size ───────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'adjust_font_size',
    description: 'Scale up or reset the text size on the current page for better readability.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'action', type: 'string', description: '"increase" to enlarge (1.4×), "decrease" for 0.85×, "reset" to restore default', required: true, enum: ['increase', 'decrease', 'reset'] },
      { name: 'factor', type: 'number', description: 'Custom scale factor (default: 1.4 for increase, 0.85 for decrease)', required: false },
    ],
    execute: async (params) => sendAccessibilityTool('adjust_font_size', params),
  } as Tool);

  // ── enhance_keyboard_navigation ────────────────────────────────────────────
  toolRegistry.register({
    name: 'enhance_keyboard_navigation',
    description: 'Improve keyboard navigation by adding visible focus indicators and making ARIA elements tab-reachable.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'enable', type: 'boolean', description: 'true to enable enhanced focus styles, false to reset (default: true)', required: false },
    ],
    execute: async (params) => sendAccessibilityTool('enhance_keyboard_navigation', params),
  } as Tool);

  // ── focus_next_element ─────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'focus_next_element',
    description: 'Move keyboard focus to the next or previous interactive element on the page.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'direction', type: 'string', description: '"next" or "prev" (default: "next")', required: false, enum: ['next', 'prev'], default: 'next' },
    ],
    execute: async (params) => sendAccessibilityTool('focus_next_element', params),
  } as Tool);
}
