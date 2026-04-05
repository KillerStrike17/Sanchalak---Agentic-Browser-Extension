// ─── Side Panel: useAgent Hook ─────────────────────────────────────────────
// Manages communication between the Side Panel UI and the background agent.

import { useEffect, useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { PORT_NAMES } from '@shared/constants';
import { generateRequestId } from '@shared/types/messages';
import type { BackgroundToUIMessage } from '@shared/types/messages';

export function useAgent() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const { addMessage, setTaskStatus, setConfirmation, setLoading, clearMessages, incrementTurns, resetTurns } = useChatStore();

  // Connect to background via port
  useEffect(() => {
    const port = chrome.runtime.connect({ name: PORT_NAMES.SIDEPANEL });
    portRef.current = port;

    port.onMessage.addListener((message: BackgroundToUIMessage) => {
      switch (message.type) {
        case 'AGENT_RESPONSE':
          addMessage({ type: 'agent', text: message.text });
          setTaskStatus('complete');
          incrementTurns();
          break;

        case 'AGENT_THINKING':
          addMessage({ type: 'thinking', text: message.thought });
          break;

        case 'AGENT_ERROR':
          addMessage({ type: 'error', text: message.error });
          setTaskStatus('error');
          break;

        case 'TASK_STATUS':
          setTaskStatus(
            message.status,
            message.currentStep,
            message.totalSteps,
            message.stepDescription
          );
          if (message.stepDescription && message.status === 'executing') {
            addMessage({
              type: 'action',
              text: message.stepDescription,
              actionType: 'info',
            });
          }
          break;

        case 'CONFIRM_ACTION':
          setConfirmation({
            action: message.action,
            description: message.description,
            details: message.details,
            requestId: message.requestId,
          });
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      portRef.current = null;
    });

    return () => {
      port.disconnect();
      portRef.current = null;
    };
  }, []);

  const sendCommand = useCallback((text: string) => {
    addMessage({ type: 'user', text });
    setLoading(true);

    const requestId = generateRequestId();

    if (portRef.current) {
      portRef.current.postMessage({ type: 'USER_COMMAND', text, requestId });
    } else {
      chrome.runtime.sendMessage({ type: 'USER_COMMAND', text, requestId });
    }
  }, [addMessage, setLoading]);

  const confirmAction = useCallback((requestId: string, approved: boolean) => {
    setConfirmation(null);

    if (portRef.current) {
      portRef.current.postMessage({ type: 'USER_CONFIRMATION', requestId, approved });
    } else {
      chrome.runtime.sendMessage({ type: 'USER_CONFIRMATION', requestId, approved });
    }

    addMessage({
      type: 'action',
      text: approved ? '✅ Action approved' : '❌ Action rejected',
      actionType: approved ? 'success' : 'error',
    });
  }, [setConfirmation, addMessage]);

  const cancelTask = useCallback(() => {
    const requestId = generateRequestId();
    chrome.runtime.sendMessage({ type: 'CANCEL_TASK', requestId });
    setTaskStatus('cancelled');
  }, [setTaskStatus]);

  /** Start a new chat session: clears UI messages and resets the background conversation buffer */
  const newChat = useCallback(() => {
    clearMessages();
    resetTurns();
    const requestId = generateRequestId();
    if (portRef.current) {
      portRef.current.postMessage({ type: 'CLEAR_CONVERSATION', requestId });
    } else {
      chrome.runtime.sendMessage({ type: 'CLEAR_CONVERSATION', requestId });
    }
  }, [clearMessages, resetTurns]);

  return { sendCommand, confirmAction, cancelTask, newChat };
}
