// ─── Shared Type Definitions: Agent ────────────────────────────────────────
// Agent planning, execution state, and task types.

import type { ToolResult } from './tools';
import type { PageState } from './dom';

export type PlanStepStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface PlanStep {
  /** Step index (0-based) */
  index: number;
  /** Tool to invoke */
  tool: string;
  /** Parameters for the tool */
  params: Record<string, unknown>;
  /** What the agent expects to happen */
  expectedOutcome: string;
  /** Current status */
  status: PlanStepStatus;
  /** Result after execution */
  result?: ToolResult;
  /** Agent's reasoning for this step */
  reasoning: string;
}

export interface AgentPlan {
  /** Original user goal */
  goal: string;
  /** Decomposed steps */
  steps: PlanStep[];
  /** Current step index */
  currentStepIndex: number;
  /** Overall plan status */
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'cancelled';
  /** Timestamp when plan was created */
  createdAt: number;
  /** Timestamp when plan completed/failed */
  completedAt?: number;
}

export type ReflectionDecision = 'continue' | 'retry' | 'replan' | 'abort';

export interface ReflectionResult {
  decision: ReflectionDecision;
  reasoning: string;
  /** If replanning, the new steps to add */
  newSteps?: Omit<PlanStep, 'index' | 'status'>[];
}

export interface AgentState {
  /** Current plan being executed (null if idle) */
  currentPlan: AgentPlan | null;
  /** Whether the agent is busy */
  isBusy: boolean;
  /** Last page state received from content script */
  lastPageState: PageState | null;
  /** Pending confirmation request ID */
  pendingConfirmation: string | null;
}

export interface TaskHistoryEntry {
  id: string;
  goal: string;
  plan: AgentPlan;
  startedAt: number;
  completedAt: number;
  success: boolean;
  pageUrl: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  tool: string;
  params: Record<string, unknown>;
  result: ToolResult;
  safetyLevel: string;
  userApproved?: boolean;
  pageUrl: string;
  tabId: number;
}

// ─── LLM Types ──────────────────────────────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'nvidia';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  /** Custom base URL for OpenAI-compatible endpoints (e.g., NVIDIA NIM) */
  baseUrl?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
