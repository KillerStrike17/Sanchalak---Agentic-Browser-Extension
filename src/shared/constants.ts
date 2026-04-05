// ─── Shared Constants ──────────────────────────────────────────────────────

/** Maximum number of ReAct loop iterations before abort */
export const MAX_PLAN_STEPS = 20;

/** Maximum page text length sent to LLM (in characters) */
export const MAX_PAGE_TEXT_LENGTH = 8000;

/** Maximum number of interactive elements sent to LLM */
export const MAX_INTERACTIVE_ELEMENTS = 100;

/** Default delay between simulated keystrokes (ms) */
export const DEFAULT_TYPING_DELAY = 80;

/** Timeout for waiting for elements to appear (ms) */
export const ELEMENT_WAIT_TIMEOUT = 10000;

/** Timeout for waiting for user confirmation (ms) */
export const CONFIRMATION_TIMEOUT = 120000; // 2 minutes

/** Maximum retries for a single tool execution */
export const MAX_TOOL_RETRIES = 3;

/** Debounce delay for MutationObserver page re-analysis (ms) */
export const PAGE_ANALYSIS_DEBOUNCE = 500;

/** Default models per provider */
export const DEFAULT_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  nvidia: ['meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct', 'meta/llama-3.1-405b-instruct', 'nvidia/nemotron-4-340b-instruct'],
};

/** LLM API endpoints */
export const LLM_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
};

/** Extension messaging port names */
export const PORT_NAMES = {
  SIDEPANEL: 'sanchalak-sidepanel',
  POPUP: 'sanchalak-popup',
} as const;
