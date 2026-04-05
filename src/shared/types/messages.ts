// ─── Shared Type Definitions: Messages ─────────────────────────────────────
// Every message flowing between extension contexts is strictly typed here.

import type { ToolResult } from './tools';
import type { PageState } from './dom';

/** Unique identifier for request/response correlation */
export type RequestId = string;

// ─── Side Panel → Service Worker ────────────────────────────────────────────

export interface UserCommandMessage {
  type: 'USER_COMMAND';
  text: string;
  requestId: RequestId;
}

export interface UserConfirmationMessage {
  type: 'USER_CONFIRMATION';
  requestId: RequestId;
  approved: boolean;
}

export interface GetPageStateMessage {
  type: 'GET_PAGE_STATE';
  requestId: RequestId;
}

export interface CancelTaskMessage {
  type: 'CANCEL_TASK';
  requestId: RequestId;
}

export interface ClearConversationMessage {
  type: 'CLEAR_CONVERSATION';
  requestId: RequestId;
}

// ─── Service Worker → Content Script ────────────────────────────────────────

export interface ExecuteToolMessage {
  type: 'EXECUTE_TOOL';
  tool: string;
  params: Record<string, unknown>;
  requestId: RequestId;
}

export interface AnalyzePageMessage {
  type: 'ANALYZE_PAGE';
  requestId: RequestId;
}

// ─── Content Script → Service Worker ────────────────────────────────────────

export interface ToolResultMessage {
  type: 'TOOL_RESULT';
  requestId: RequestId;
  result: ToolResult;
}

export interface PageStateMessage {
  type: 'PAGE_STATE';
  requestId: RequestId;
  state: PageState;
}

// ─── Service Worker → Side Panel ────────────────────────────────────────────

export interface AgentResponseMessage {
  type: 'AGENT_RESPONSE';
  text: string;
  actions?: ActionLogEntry[];
  requestId: RequestId;
}

export interface ConfirmActionMessage {
  type: 'CONFIRM_ACTION';
  action: string;
  description: string;
  details: Record<string, unknown>;
  requestId: RequestId;
}

export interface TaskStatusMessage {
  type: 'TASK_STATUS';
  status: TaskStatus;
  currentStep?: number;
  totalSteps?: number;
  stepDescription?: string;
  requestId: RequestId;
}

export interface AgentThinkingMessage {
  type: 'AGENT_THINKING';
  thought: string;
  requestId: RequestId;
}

export interface AgentErrorMessage {
  type: 'AGENT_ERROR';
  error: string;
  requestId: RequestId;
}

// ─── Unions ─────────────────────────────────────────────────────────────────

export type UIToBackgroundMessage =
  | UserCommandMessage
  | UserConfirmationMessage
  | GetPageStateMessage
  | CancelTaskMessage
  | ClearConversationMessage;

export type BackgroundToContentMessage =
  | ExecuteToolMessage
  | AnalyzePageMessage;

export type ContentToBackgroundMessage =
  | ToolResultMessage
  | PageStateMessage;

export type BackgroundToUIMessage =
  | AgentResponseMessage
  | ConfirmActionMessage
  | TaskStatusMessage
  | AgentThinkingMessage
  | AgentErrorMessage;

export type AgentMessage =
  | UIToBackgroundMessage
  | BackgroundToContentMessage
  | ContentToBackgroundMessage
  | BackgroundToUIMessage;

// ─── Supporting Types ───────────────────────────────────────────────────────

export type TaskStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'waiting_confirmation'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface ActionLogEntry {
  tool: string;
  params: Record<string, unknown>;
  result: ToolResult;
  timestamp: number;
  durationMs: number;
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function isUserCommand(msg: AgentMessage): msg is UserCommandMessage {
  return msg.type === 'USER_COMMAND';
}

export function isExecuteTool(msg: AgentMessage): msg is ExecuteToolMessage {
  return msg.type === 'EXECUTE_TOOL';
}

export function isToolResult(msg: AgentMessage): msg is ToolResultMessage {
  return msg.type === 'TOOL_RESULT';
}

export function isPageState(msg: AgentMessage): msg is PageStateMessage {
  return msg.type === 'PAGE_STATE';
}

export function isConfirmAction(msg: AgentMessage): msg is ConfirmActionMessage {
  return msg.type === 'CONFIRM_ACTION';
}

export function isAgentResponse(msg: AgentMessage): msg is AgentResponseMessage {
  return msg.type === 'AGENT_RESPONSE';
}

export function isTaskStatus(msg: AgentMessage): msg is TaskStatusMessage {
  return msg.type === 'TASK_STATUS';
}

export function isAgentThinking(msg: AgentMessage): msg is AgentThinkingMessage {
  return msg.type === 'AGENT_THINKING';
}

export function isAgentError(msg: AgentMessage): msg is AgentErrorMessage {
  return msg.type === 'AGENT_ERROR';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function generateRequestId(): RequestId {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
