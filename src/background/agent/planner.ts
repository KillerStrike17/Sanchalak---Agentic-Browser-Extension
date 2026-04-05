// ─── Agent Planner: ReAct Loop ─────────────────────────────────────────────
// The brain of Sanchalak. Decomposes user goals into actions using LLM.

import type { LLMMessage, LLMToolCall } from '@shared/types/agent';
import type { ToolResult } from '@shared/types/tools';
import type { PageState } from '@shared/types/dom';
import { createLLMClient } from '../llm/provider';
import { getActiveLLMConfig } from '@shared/storage';
import { toolRegistry } from '../tools/tool-registry';
import { buildSystemPrompt, buildTaskMessage } from './prompts';
import { classifyAction, getSafetyReason } from '@shared/safety';
import { addAuditLog } from '@shared/storage';
import { createLogger } from '@shared/logger';
import { MAX_PLAN_STEPS } from '@shared/constants';

const log = createLogger('background');

export interface PlannerCallbacks {
  onThinking: (thought: string) => void;
  onAction: (tool: string, params: Record<string, unknown>) => void;
  onResult: (tool: string, result: ToolResult) => void;
  onNeedConfirmation: (tool: string, params: Record<string, unknown>, reason: string) => Promise<boolean>;
  onComplete: (response: string) => void;
  onError: (error: string) => void;
  onStatusChange: (status: string, step?: number, total?: number) => void;
}

/**
 * Execute a user task using the ReAct loop.
 *
 * @param conversationHistory - Prior turns from the conversation buffer, injected
 *   between the system prompt and the current user message for multi-turn context.
 * @returns The agent's final text response (stored in the conversation buffer).
 */
export async function executeTask(
  userGoal: string,
  pageState: PageState | null,
  callbacks: PlannerCallbacks,
  tabId: number,
  conversationHistory: LLMMessage[] = []
): Promise<string> {
  log.info('Starting task', { goal: userGoal, priorTurns: Math.floor(conversationHistory.length / 2) });
  callbacks.onStatusChange('planning');

  try {
    const config = await getActiveLLMConfig();
    const client = createLLMClient(config);
    const tools = toolRegistry.getDescriptions();
    const systemPrompt = buildSystemPrompt(tools);

    // Build conversation: system → prior history → current user message
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: buildTaskMessage(userGoal, pageState || undefined) },
    ];

    let step = 0;

    // ─── ReAct Loop ──────────────────────────────────────────
    while (step < MAX_PLAN_STEPS) {
      step++;
      callbacks.onStatusChange('executing', step, MAX_PLAN_STEPS);
      log.info(`ReAct step ${step}`);

      const response = await client.chat(messages, tools);

      if (response.content) {
        callbacks.onThinking(response.content);
      }

      // No tool calls → LLM is done, this is the final answer
      if (!response.toolCalls || response.toolCalls.length === 0) {
        const finalText = response.content || 'Task completed.';
        callbacks.onStatusChange('complete');
        callbacks.onComplete(finalText);
        log.info('Task complete', { response: finalText.substring(0, 200) });
        return finalText;
      }

      // Add the assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const result = await executeToolCall(toolCall, tabId, callbacks);

        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });

        await addAuditLog({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
          tool: toolCall.name,
          params: toolCall.arguments,
          result,
          safetyLevel: classifyAction(toolCall.name, toolCall.arguments),
          pageUrl: pageState?.url || '',
          tabId,
        });
      }
    }

    // Max steps reached
    const errMsg = `Reached maximum steps (${MAX_PLAN_STEPS}). Task may be too complex.`;
    callbacks.onStatusChange('error');
    callbacks.onError(errMsg);
    return errMsg;
  } catch (err) {
    log.error('Task failed', err);
    callbacks.onStatusChange('error');
    callbacks.onError(String(err));
    return String(err);
  }
}

/**
 * Execute a single tool call with safety checks.
 */
async function executeToolCall(
  toolCall: LLMToolCall,
  tabId: number,
  callbacks: PlannerCallbacks
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolCall.name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolCall.name}` };
  }

  const safetyLevel = classifyAction(toolCall.name, toolCall.arguments);

  if (safetyLevel === 'block') {
    const reason = getSafetyReason(toolCall.name);
    callbacks.onThinking(`⚠️ Blocked: ${toolCall.name}. ${reason}`);
    return { success: false, error: `Action blocked for safety: ${reason}` };
  }

  if (safetyLevel === 'confirm') {
    const reason = getSafetyReason(toolCall.name);
    const approved = await callbacks.onNeedConfirmation(toolCall.name, toolCall.arguments, reason);
    if (!approved) {
      return { success: false, error: 'User rejected the action' };
    }
  }

  callbacks.onAction(toolCall.name, toolCall.arguments);
  const startTime = Date.now();

  try {
    const result = await tool.execute(toolCall.arguments);
    log.info(`Tool executed: ${toolCall.name}`, { durationMs: Date.now() - startTime, success: result.success });
    callbacks.onResult(toolCall.name, result);
    return result;
  } catch (err) {
    const result: ToolResult = { success: false, error: String(err) };
    callbacks.onResult(toolCall.name, result);
    return result;
  }
}
