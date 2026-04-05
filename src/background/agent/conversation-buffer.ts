// ─── Conversation Buffer ─────────────────────────────────────────────────────
// Maintains multi-turn conversation history across sequential agent tasks.
// Each turn stores the raw user goal + the agent's final text response.
// These are injected as prior context into each new LLM call, giving the agent
// memory of what was discussed without ballooning token usage with stale tool
// call chains.

import type { LLMMessage } from '@shared/types/agent';
import { createLogger } from '@shared/logger';

const log = createLogger('background');

/** Max prior turns to keep (each turn = 1 user msg + 1 assistant msg) */
const MAX_TURNS = 10;

interface ConversationTurn {
  userGoal: string;
  assistantResponse: string;
  timestamp: number;
}

export class ConversationBuffer {
  private turns: ConversationTurn[] = [];

  /**
   * Record a completed user → assistant exchange.
   * Call this after each successful task completion.
   */
  addTurn(userGoal: string, assistantResponse: string): void {
    this.turns.push({ userGoal, assistantResponse, timestamp: Date.now() });

    // Keep only the most recent MAX_TURNS turns
    if (this.turns.length > MAX_TURNS) {
      this.turns = this.turns.slice(this.turns.length - MAX_TURNS);
    }

    log.debug('Conversation turn added', {
      totalTurns: this.turns.length,
      goal: userGoal.substring(0, 60),
    });
  }

  /**
   * Serialize the buffer as LLM message pairs.
   * Only the clean goal/response — no stale page state injected.
   * The current user message will have fresh page context appended separately.
   */
  toMessages(): LLMMessage[] {
    return this.turns.flatMap((turn) => [
      { role: 'user' as const, content: turn.userGoal },
      { role: 'assistant' as const, content: turn.assistantResponse },
    ]);
  }

  /** Number of complete turns stored */
  get turnCount(): number {
    return this.turns.length;
  }

  /** Whether there is any prior context */
  get hasHistory(): boolean {
    return this.turns.length > 0;
  }

  /** Clear all history (new chat session) */
  clear(): void {
    const count = this.turns.length;
    this.turns = [];
    log.info('Conversation buffer cleared', { clearedTurns: count });
  }
}

/** Singleton buffer for the service worker */
export const conversationBuffer = new ConversationBuffer();
