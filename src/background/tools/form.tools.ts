// ─── Form Interaction Tools ─────────────────────────────────────────────────
// Phase 2: Advanced form handling — autocomplete, date/time pickers, file
// upload, multi-step forms, validation, rich text, CAPTCHA delegation, popups.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';
import { broadcastToUI } from '@shared/messaging';

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

export function registerFormTools(): void {

  // ── 1. fill_text_field ────────────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'fill_text_field',
    description: 'Fill a single text input field identified by its label, placeholder, or CSS selector.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'label', type: 'string', description: 'The visible label or placeholder text of the field', required: false },
      { name: 'selector', type: 'string', description: 'CSS selector of the input', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from interactive elements list', required: false },
      { name: 'value', type: 'string', description: 'The value to type into the field', required: true },
      { name: 'clearFirst', type: 'boolean', description: 'Clear existing value before typing (default: true)', required: false },
    ],
  }));

  // ── 2. fill_multiple_fields ───────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'fill_multiple_fields',
    description: 'Fill several form fields at once. Provide a fields map of label/name → value pairs.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      {
        name: 'fields',
        type: 'object',
        description: 'Object mapping field label or name to the value to fill. E.g. {"First Name": "John", "Email": "john@example.com"}',
        required: true,
      },
      { name: 'formSelector', type: 'string', description: 'Optional CSS selector of the containing form', required: false },
    ],
  }));

  // ── 3. handle_autocomplete ────────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'handle_autocomplete',
    description: 'Type text into an autocomplete field and click a matching suggestion from the dropdown.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the input field', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from interactive elements list', required: false },
      { name: 'text', type: 'string', description: 'Text to type to trigger suggestions', required: true },
      { name: 'optionText', type: 'string', description: 'Partial text of the suggestion to click. If omitted, clicks the first suggestion.', required: false },
    ],
  }));

  // ── 4. upload_file ────────────────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'upload_file',
    description: 'Trigger a file upload dialog on a file input element. NOTE: Cannot select a file automatically — this opens the picker for the user.',
    category: 'form',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the file input element', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from interactive elements list', required: false },
    ],
  }));

  // ── 5. navigate_multi_step_form ───────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'navigate_multi_step_form',
    description: 'Click the Next, Continue, or Previous button in a multi-step form wizard.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      {
        name: 'direction',
        type: 'string',
        description: 'Which direction to navigate: "next" (default), "previous", or "submit"',
        required: false,
        enum: ['next', 'previous', 'submit'],
        default: 'next',
      },
      { name: 'buttonText', type: 'string', description: 'Override: exact button text to click (e.g. "Continue")', required: false },
    ],
  }));

  // ── 6. handle_form_validation ─────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'handle_form_validation',
    description: 'Read form validation state — returns a list of invalid fields and their error messages.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the form (default: first form on page)', required: false },
    ],
  }));

  // ── 7. fill_conditional_fields ────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'fill_conditional_fields',
    description: 'Fill a field that only appears after selecting a value in another field (e.g. "State" appearing when "United States" is selected as country).',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'triggerSelector', type: 'string', description: 'Selector of the field that triggers the conditional field to appear', required: true },
      { name: 'triggerValue', type: 'string', description: 'Value to set in the trigger field', required: true },
      { name: 'conditionalSelector', type: 'string', description: 'Selector of the conditional field that appears', required: false },
      { name: 'conditionalLabel', type: 'string', description: 'Label of the conditional field if selector is unknown', required: false },
      { name: 'conditionalValue', type: 'string', description: 'Value to fill in the conditional field', required: true },
    ],
  }));

  // ── 8. select_date ────────────────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'select_date',
    description: 'Select a date in a date picker or calendar widget. Handles both native <input type="date"> and custom calendar UIs.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the date input or calendar trigger', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from interactive elements list', required: false },
      { name: 'date', type: 'string', description: 'Target date in YYYY-MM-DD format (e.g. "2026-06-15")', required: true },
    ],
  }));

  // ── 9. select_time ────────────────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'select_time',
    description: 'Select a time in a time picker widget. Handles both native <input type="time"> and custom time selectors.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the time input or picker trigger', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from interactive elements list', required: false },
      { name: 'time', type: 'string', description: 'Target time in HH:MM format (24-hour, e.g. "14:30")', required: true },
    ],
  }));

  // ── 10. multi_select ──────────────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'multi_select',
    description: 'Select multiple options from a multi-select list, checkboxes, or a multi-select dropdown.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the multi-select element or container', required: false },
      {
        name: 'values',
        type: 'array',
        description: 'Array of option texts or values to select. E.g. ["Red", "Blue", "Green"]',
        required: true,
      },
    ],
  }));

  // ── 11. fill_rich_text ────────────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'fill_rich_text',
    description: 'Type content into a rich text editor (contenteditable div, Quill, TinyMCE, Draft.js, etc.).',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the contenteditable element or editor container', required: false },
      { name: 'elementIndex', type: 'number', description: 'Index from interactive elements list', required: false },
      { name: 'text', type: 'string', description: 'Text content to type into the editor', required: true },
      { name: 'clearFirst', type: 'boolean', description: 'Clear existing content first (default: true)', required: false },
    ],
  }));

  // ── 12. delegate_captcha ──────────────────────────────────────────────────
  toolRegistry.register({
    name: 'delegate_captcha',
    description: 'Pause the current task and notify the user to solve a CAPTCHA manually, then resume.',
    category: 'form',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'message', type: 'string', description: 'Optional message to show the user explaining where the CAPTCHA is', required: false },
    ],
    execute: async (params) => {
      // Broadcast a notification to the UI asking user to solve CAPTCHA
      broadcastToUI({
        type: 'AGENT_THINKING',
        thought: `🔒 CAPTCHA detected. ${params.message || 'Please solve the CAPTCHA on the page, then I will continue.'}`,
        requestId: `captcha_${Date.now()}`,
      });
      // Wait 30 seconds for user to solve it
      await new Promise((resolve) => setTimeout(resolve, 30000));
      return { success: true, data: { delegated: true, waitedMs: 30000 } };
    },
  });

  // ── 13. dismiss_popup ─────────────────────────────────────────────────────
  toolRegistry.register(createContentTool({
    name: 'dismiss_popup',
    description: 'Detect and close overlays, cookie banners, modals, newsletter signup popups, and similar obstructions.',
    category: 'form',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the popup/overlay to close (auto-detected if omitted)', required: false },
    ],
  }));
}
