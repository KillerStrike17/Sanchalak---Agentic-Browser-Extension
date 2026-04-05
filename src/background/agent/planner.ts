// ─── Agent Planner: ReAct Loop ─────────────────────────────────────────────
// The brain of Sanchalak. Decomposes user goals into actions using LLM.

import type { AgentPlan, LLMMessage, LLMToolCall } from '@shared/types/agent';
import type { ToolResult } from '@shared/types/tools';
import type { PageState } from '@shared/types/dom';
import { createLLMClient } from '../llm/provider';
import { getActiveLLMConfig } from '@shared/storage';
import { toolRegistry } from '../tools/tool-registry';
import { buildSystemPrompt, buildTaskMessage, formatPageContext } from './prompts';
import { classifyAction, getSafetyReason } from '@shared/safety';
import { broadcastToUI } from '@shared/messaging';
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
 * This is the main entry point for the agent.
 */
export async function executeTask(
  userGoal: string,
  pageState: PageState | null,
  callbacks: PlannerCallbacks,
  tabId: number
): Promise<void> {
  log.info('Starting task', { goal: userGoal });
  callbacks.onStatusChange('planning');

  try {
    const config = await getActiveLLMConfig();
    const client = createLLMClient(config);
    const tools = toolRegistry.getDescriptions();
    const systemPrompt = buildSystemPrompt(tools);

    // Build initial conversation
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildTaskMessage(userGoal, pageState || undefined) },
    ];

    let step = 0;

    // ─── ReAct Loop ──────────────────────────────────────────
    while (step < MAX_PLAN_STEPS) {
      step++;
      callbacks.onStatusChange('executing', step, MAX_PLAN_STEPS);
      log.info(`ReAct step ${step}`);

      // Call LLM
      const response = await client.chat(messages, tools);

      // If LLM returned text content, it might be thinking or responding
      if (response.content) {
        callbacks.onThinking(response.content);
      }

      // If no tool calls, the LLM is done — it's providing a final response
      if (!response.toolCalls || response.toolCalls.length === 0) {
        callbacks.onStatusChange('complete');
        callbacks.onComplete(response.content);
        log.info('Task complete', { response: response.content.substring(0, 200) });
        return;
      }

      // Add the assistant message with tool calls (once, before executing tools)
      messages.push({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const result = await executeToolCall(toolCall, tabId, callbacks);

        // Add tool result
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });

        // Log for audit
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
    callbacks.onStatusChange('error');
    callbacks.onError(`Reached maximum steps (${MAX_PLAN_STEPS}). Task may be too complex.`);
  } catch (err) {
    log.error('Task failed', err);
    callbacks.onStatusChange('error');
    callbacks.onError(String(err));
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

  // Blocked actions
  if (safetyLevel === 'block') {
    const reason = getSafetyReason(toolCall.name);
    callbacks.onThinking(`⚠️ Blocked action: ${toolCall.name}. ${reason}`);
    return {
      success: false,
      error: `Action blocked for safety: ${reason}`,
    };
  }

  // Actions requiring confirmation
  if (safetyLevel === 'confirm') {
    const reason = getSafetyReason(toolCall.name);
    const approved = await callbacks.onNeedConfirmation(
      toolCall.name,
      toolCall.arguments,
      reason
    );
    if (!approved) {
      return { success: false, error: 'User rejected the action' };
    }
  }

  // Execute the tool
  callbacks.onAction(toolCall.name, toolCall.arguments);
  const startTime = Date.now();

  try {
    const result = await tool.execute(toolCall.arguments);
    const duration = Date.now() - startTime;
    log.info(`Tool executed: ${toolCall.name}`, { duration, success: result.success });
    callbacks.onResult(toolCall.name, result);
    return result;
  } catch (err) {
    const result: ToolResult = { success: false, error: String(err) };
    callbacks.onResult(toolCall.name, result);
    return result;
  }
}
