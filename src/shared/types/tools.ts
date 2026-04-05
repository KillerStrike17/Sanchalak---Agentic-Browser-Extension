// ─── Shared Type Definitions: Tools ────────────────────────────────────────
// Every browser capability is modeled as a Tool with this interface.

export type ToolCategory =
  | 'navigation'
  | 'interaction'
  | 'extraction'
  | 'form'
  | 'tab'
  | 'shopping'
  | 'email'
  | 'calendar'
  | 'content'
  | 'data'
  | 'api'
  | 'auth'
  | 'vision'
  | 'accessibility'
  | 'safety';

export type SafetyLevel = 'safe' | 'confirm' | 'block';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface Tool {
  /** Unique tool identifier, e.g. "click_element" */
  name: string;
  /** Human-readable description for LLM context */
  description: string;
  /** Category grouping */
  category: ToolCategory;
  /** Input parameter schema */
  parameters: ToolParameter[];
  /** Safety classification */
  safetyLevel: SafetyLevel;
  /** Execute the tool (runs in service worker, may delegate to content script) */
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Base64 screenshot taken after action (optional) */
  screenshot?: string;
}

/** Serialized tool description for LLM function calling */
export interface ToolDescription {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required: string[];
  };
}

/** Convert a Tool to an LLM-friendly function description */
export function toolToDescription(tool: Tool): ToolDescription {
  const properties: Record<string, { type: string; description: string; enum?: string[]; default?: unknown }> = {};
  const required: string[] = [];

  for (const param of tool.parameters) {
    properties[param.name] = {
      type: param.type,
      description: param.description,
    };
    if (param.enum) properties[param.name].enum = param.enum;
    if (param.default !== undefined) properties[param.name].default = param.default;
    if (param.required) required.push(param.name);
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties,
      required,
    },
  };
}
