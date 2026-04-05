// ─── Side Panel: Zustand Store ─────────────────────────────────────────────

import { create } from 'zustand';
import type { TaskStatus } from '@shared/types/messages';

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'thinking' | 'action' | 'error';
  text: string;
  timestamp: number;
  actionType?: 'success' | 'error' | 'info';
}

export interface ConfirmationRequest {
  action: string;
  description: string;
  details: Record<string, unknown>;
  requestId: string;
}

interface ChatState {
  messages: ChatMessage[];
  taskStatus: TaskStatus;
  stepDescription: string;
  currentStep: number;
  totalSteps: number;
  isLoading: boolean;
  confirmation: ConfirmationRequest | null;
  /** Number of completed conversation turns in this session */
  sessionTurns: number;

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setTaskStatus: (status: TaskStatus, step?: number, total?: number, desc?: string) => void;
  setLoading: (loading: boolean) => void;
  setConfirmation: (conf: ConfirmationRequest | null) => void;
  clearMessages: () => void;
  incrementTurns: () => void;
  resetTurns: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  taskStatus: 'idle',
  stepDescription: '',
  currentStep: 0,
  totalSteps: 0,
  isLoading: false,
  confirmation: null,
  sessionTurns: 0,

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
        },
      ],
    })),

  setTaskStatus: (status, step, total, desc) =>
    set({
      taskStatus: status,
      currentStep: step ?? 0,
      totalSteps: total ?? 0,
      stepDescription: desc ?? '',
      isLoading: status === 'planning' || status === 'executing',
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setConfirmation: (conf) => set({ confirmation: conf }),

  clearMessages: () => set({ messages: [], taskStatus: 'idle', sessionTurns: 0 }),

  incrementTurns: () => set((state) => ({ sessionTurns: state.sessionTurns + 1 })),

  resetTurns: () => set({ sessionTurns: 0 }),
}));
