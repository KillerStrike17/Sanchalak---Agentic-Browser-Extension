// ─── Vision & ML Tools ───────────────────────────────────────────────────────
// Phase 4: UI element identification, visual content reading, layout description,
// visual change verification, intent prediction, content personalisation, scoring.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';
import { createLogger } from '@shared/logger';

const log = createLogger('background');

/** Helper: capture a screenshot of the active tab as a base64 data URL */
async function captureScreenshot(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(dataUrl);
    });
  });
}

/** Helper: send tool to active tab content script */
async function sendContentTool(toolName: string, params: Record<string, unknown>) {
  const tab = await getActiveTab();
  if (!tab.id) throw new Error('No active tab');
  await ensureContentScript(tab.id);
  const response = await sendToTab<{ result: { success: boolean; data?: unknown; error?: string } }>(
    tab.id,
    { type: 'EXECUTE_TOOL', tool: toolName, params, requestId: `tool_${Date.now()}` }
  );
  return response?.result || { success: false, error: 'No response from content script' };
}

export function registerVisionTools(): void {

  // ── identify_ui_elements ───────────────────────────────────────────────────
  toolRegistry.register({
    name: 'identify_ui_elements',
    description: 'Identify and describe all interactive UI elements (buttons, inputs, links, dropdowns) on the current page using DOM analysis.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'elementType', type: 'string', description: 'Filter by type: "button", "input", "link", "select", "all" (default: "all")', required: false, enum: ['button', 'input', 'link', 'select', 'all'], default: 'all' },
      { name: 'selector', type: 'string', description: 'Limit search to elements within this CSS selector', required: false },
      { name: 'visible', type: 'boolean', description: 'Only return visible elements (default: true)', required: false },
    ],
    execute: async (params) => sendContentTool('identify_ui_elements', params),
  } as Tool);

  // ── read_visual_content ────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'read_visual_content',
    description: 'Read and describe visual content on the page — charts, graphs, images with text, infographics.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the visual element (image, canvas, svg, chart)', required: false },
      { name: 'includeAltText', type: 'boolean', description: 'Include alt text and aria-label descriptions (default: true)', required: false },
      { name: 'describeCharts', type: 'boolean', description: 'Try to extract data series from SVG/canvas charts (default: false)', required: false },
    ],
    execute: async (params) => sendContentTool('read_visual_content', params),
  } as Tool);

  // ── describe_layout ────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'describe_layout',
    description: 'Describe the layout and visual structure of the current page — sections, navigation, main content, sidebars.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'includeCoordinates', type: 'boolean', description: 'Include bounding box positions of major sections (default: false)', required: false },
      { name: 'depth', type: 'number', description: 'DOM depth to analyse for layout (default: 3)', required: false },
    ],
    execute: async (params) => sendContentTool('describe_layout', params),
  } as Tool);

  // ── verify_visual_changes ──────────────────────────────────────────────────
  toolRegistry.register({
    name: 'verify_visual_changes',
    description: 'Verify that an expected visual change has occurred on the page (e.g. a button appeared, text changed, modal closed).',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'expectedState', type: 'string', description: 'Description of the expected visual state, e.g. "success message visible", "modal is closed"', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector to check', required: false },
      { name: 'expectedText', type: 'string', description: 'Exact text that should be visible in the element', required: false },
      { name: 'shouldExist', type: 'boolean', description: 'Whether the element should be present (true) or absent (false, default: true)', required: false },
    ],
    execute: async (params) => sendContentTool('verify_visual_changes', params),
  } as Tool);

  // ── predict_user_intent ────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'predict_user_intent',
    description: 'Analyse the current page context and predict what the user is likely trying to accomplish.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'recentActions', type: 'array', description: 'List of recent actions the user took (for context)', required: false },
      { name: 'focusedElement', type: 'string', description: 'CSS selector or description of what the user is focused on', required: false },
    ],
    execute: async (params) => {
      // Combines page state with action history to predict intent
      const pageState = await sendContentTool('get_page_state', {});
      log.info('predict_user_intent', { focusedElement: params.focusedElement });
      return {
        success: true,
        data: {
          pageContext: (pageState as any)?.data,
          recentActions: params.recentActions || [],
          hint: 'Use this context along with the conversation history to infer user intent.',
        },
      };
    },
  } as Tool);

  // ── generate_variations ───────────────────────────────────────────────────
  toolRegistry.register({
    name: 'generate_variations',
    description: 'Generate content variations for A/B testing — headlines, CTAs, button labels, descriptions.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'content', type: 'string', description: 'Original content to generate variations for', required: true },
      { name: 'count', type: 'number', description: 'Number of variations to generate (default: 3)', required: false },
      { name: 'type', type: 'string', description: 'Content type: "headline", "cta", "description", "email_subject" (default: "headline")', required: false, enum: ['headline', 'cta', 'description', 'email_subject'], default: 'headline' },
      { name: 'tone', type: 'string', description: 'Target tone: "professional", "casual", "urgent", "friendly"', required: false },
    ],
    execute: async (params) => {
      const count = (params.count as number) || 3;
      // The LLM will generate variations — this tool sets up the prompt context
      return {
        success: true,
        data: {
          original: params.content,
          type: params.type || 'headline',
          tone: params.tone || 'professional',
          requestedVariations: count,
          instruction: `Please generate ${count} ${params.type || 'headline'} variations for the original content above, in a ${params.tone || 'professional'} tone.`,
        },
      };
    },
  } as Tool);

  // ── personalise_content ────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'personalise_content',
    description: 'Rewrite or adapt page content to personalise it for a specific audience or user segment.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'audience', type: 'string', description: 'Target audience description, e.g. "enterprise CTOs", "first-time home buyers", "students aged 18-22"', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector of the content to personalise (default: main content area)', required: false },
      { name: 'preserveFormatting', type: 'boolean', description: 'Keep original HTML structure while replacing text (default: true)', required: false },
    ],
    execute: async (params) => sendContentTool('personalise_content', params),
  } as Tool);

  // ── score_rank_options ─────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'score_rank_options',
    description: 'Score and rank a list of options based on given criteria (e.g. rank job listings, compare products).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'options', type: 'array', description: 'List of option objects or strings to rank', required: true },
      { name: 'criteria', type: 'array', description: 'Ranking criteria as strings, e.g. ["salary", "remote-friendly", "growth potential"]', required: true },
      { name: 'weights', type: 'object', description: 'Optional weight per criterion as 0-1 values, e.g. {"salary": 0.5, "remote-friendly": 0.3}', required: false },
    ],
    execute: async (params) => {
      const options = params.options as unknown[];
      const criteria = params.criteria as string[];
      const weights = (params.weights as Record<string, number>) || {};

      // Build a scoring context for the LLM
      return {
        success: true,
        data: {
          options,
          criteria,
          weights,
          instruction: `Rank these ${options.length} options based on the criteria: ${criteria.join(', ')}. Apply weights where specified. Return a ranked list with scores (0-100) and brief reasoning for each.`,
        },
      };
    },
  } as Tool);

  // ── ocr_text_from_image ────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'ocr_text_from_image',
    description: 'Extract text from an image on the current page using the browser\'s built-in capabilities or the image alt text.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the image element to extract text from', required: false },
      { name: 'imageUrl', type: 'string', description: 'Direct URL of the image (alternative to selector)', required: false },
      { name: 'method', type: 'string', description: '"alt" to use alt/aria-label, "canvas" to render image and attempt extraction (default: "alt")', required: false, enum: ['alt', 'canvas'], default: 'alt' },
    ],
    execute: async (params) => sendContentTool('ocr_text_from_image', params),
  } as Tool);

  // ── capture_screenshot ─────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'capture_screenshot',
    description: 'Capture a screenshot of the current tab viewport. Returns a base64-encoded PNG data URL.',
    category: 'page',
    safetyLevel: 'safe',
    parameters: [],
    execute: async () => {
      try {
        const dataUrl = await captureScreenshot();
        return {
          success: true,
          data: {
            screenshot: dataUrl,
            note: 'Screenshot captured as base64 PNG. Use read_visual_content to analyse specific elements.',
          },
        };
      } catch (err) {
        log.warn('Screenshot capture failed', err);
        return { success: false, error: `Screenshot failed: ${String(err)}` };
      }
    },
  } as Tool);
}
