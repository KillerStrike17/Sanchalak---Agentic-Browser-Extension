// ─── Background Service Worker: Entry Point ───────────────────────────────
// The central hub of Sanchalak. Registers all listeners and orchestrates.

import { registerNavigationTools } from './tools/navigation.tools';
import { registerExtractionTools } from './tools/extraction.tools';
// Phase 2
import { registerFormTools } from './tools/form.tools';
import { registerShoppingTools } from './tools/shopping.tools';
import { registerEmailTools } from './tools/email.tools';
import { registerResearchTools } from './tools/research.tools';
// Phase 3
import { registerCalendarTools } from './tools/calendar.tools';
import { registerContentTools } from './tools/content.tools';
import { registerCRMTools } from './tools/crm.tools';
import { registerWorkflowTools } from './workflow/engine';
import { initScheduler } from './workflow/scheduler';
// Phase 4
import { registerTabCoordinationTools } from './tools/tab.tools';
import { registerAPITools } from './tools/api.tools';
import { registerVisionTools } from './tools/vision.tools';
import { registerAuthTools } from './tools/auth.tools';
import { registerAccessibilityTools } from './tools/accessibility.tools';
import { registerDocumentTools } from './tools/document.tools';
import { registerFinancialTools } from './tools/financial.tools';
import { executeTask, type PlannerCallbacks } from './agent/planner';
import { conversationBuffer } from './agent/conversation-buffer';
import { registerUIPort, broadcastToUI, getActiveTab, ensureContentScript, sendToTab } from '@shared/messaging';
import { PORT_NAMES } from '@shared/constants';
import { createLogger } from '@shared/logger';
import type { AgentMessage, BackgroundToUIMessage } from '@shared/types/messages';
import type { PageState } from '@shared/types/dom';
import type { ToolResult } from '@shared/types/tools';

const log = createLogger('background');

// ─── Initialize ─────────────────────────────────────────────────────────────

log.info('Service worker starting...');

// Phase 1
registerNavigationTools();
registerExtractionTools();
// Phase 2
registerFormTools();
registerShoppingTools();
registerEmailTools();
registerResearchTools();
// Phase 3
registerCalendarTools();
registerContentTools();
registerCRMTools();
registerWorkflowTools();
// Phase 4
registerTabCoordinationTools();
registerAPITools();
registerVisionTools();
registerAuthTools();
registerAccessibilityTools();
registerDocumentTools();
registerFinancialTools();

// Initialize workflow scheduler (sets up chrome.alarms for recurring workflows)
initScheduler();

log.info('Tools registered — Phase 1-4 active');

// Track current task state
let isTaskRunning = false;
let pendingConfirmationResolve: ((approved: boolean) => void) | null = null;

// ─── Message Handling ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: AgentMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    log.debug('Message received', { type: message.type, from: sender.tab ? 'content' : 'ui' });

    switch (message.type) {
      case 'USER_COMMAND':
        handleUserCommand(message.text, message.requestId);
        sendResponse({ received: true });
        break;

      case 'USER_CONFIRMATION':
        if (pendingConfirmationResolve) {
          pendingConfirmationResolve(message.approved);
          pendingConfirmationResolve = null;
        }
        sendResponse({ received: true });
        break;

      case 'CLEAR_CONVERSATION':
        conversationBuffer.clear();
        broadcastToUI({
          type: 'TASK_STATUS',
          status: 'idle',
          requestId: message.requestId,
        });
        sendResponse({ cleared: true });
        break;

      case 'PAGE_STATE':
        log.debug('Page state received', { url: (message as { state: PageState }).state?.url });
        sendResponse({ received: true });
        break;

      case 'CAPTURE_SCREENSHOT':
        chrome.tabs.captureVisibleTab(undefined, { format: 'png' })
          .then((screenshot) => sendResponse({ screenshot }))
          .catch((err) => sendResponse({ error: String(err) }));
        return true;

      case 'GET_PAGE_STATE':
        getPageState().then((state) => sendResponse(state)).catch((err) =>
          sendResponse({ error: String(err) })
        );
        return true;

      case 'CANCEL_TASK':
        isTaskRunning = false;
        broadcastToUI({
          type: 'TASK_STATUS',
          status: 'cancelled',
          requestId: message.requestId,
        });
        sendResponse({ cancelled: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }

    return false;
  }
);

// ─── Port-based Communication (for streaming) ──────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === PORT_NAMES.SIDEPANEL || port.name === PORT_NAMES.POPUP) {
    log.info(`UI port connected: ${port.name}`);
    registerUIPort(port);

    port.onMessage.addListener((message: AgentMessage) => {
      if (message.type === 'USER_COMMAND') {
        handleUserCommand(message.text, message.requestId);
      } else if (message.type === 'USER_CONFIRMATION') {
        if (pendingConfirmationResolve) {
          pendingConfirmationResolve(message.approved);
          pendingConfirmationResolve = null;
        }
      } else if (message.type === 'CLEAR_CONVERSATION') {
        conversationBuffer.clear();
        broadcastToUI({
          type: 'TASK_STATUS',
          status: 'idle',
          requestId: message.requestId,
        });
      }
    });
  }
});

// ─── Side Panel Setup ───────────────────────────────────────────────────────

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => log.error('Failed to set side panel behavior', err));

// ─── Context Menu ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sanchalak-ask',
    title: 'Ask Sanchalak about this page',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'sanchalak-extract',
    title: 'Extract text from this page',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'sanchalak-selected',
    title: 'Ask Sanchalak about "%s"',
    contexts: ['selection'],
  });

  log.info('Context menus created');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sanchalak-ask' && tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  } else if (info.menuItemId === 'sanchalak-extract' && tab?.id) {
    handleUserCommand('Extract all text from this page', `ctx_${Date.now()}`);
    chrome.sidePanel.open({ tabId: tab.id });
  } else if (info.menuItemId === 'sanchalak-selected' && info.selectionText) {
    handleUserCommand(
      `Tell me about: "${info.selectionText}"`,
      `ctx_${Date.now()}`
    );
    if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ─── Task Execution ─────────────────────────────────────────────────────────

async function handleUserCommand(text: string, requestId: string): Promise<void> {
  if (isTaskRunning) {
    broadcastToUI({
      type: 'AGENT_ERROR',
      error: 'A task is already running. Please wait for it to complete or cancel it.',
      requestId,
    });
    return;
  }

  isTaskRunning = true;
  log.info('Handling user command', { text, requestId });

  try {
    const pageState = await getPageState();
    const tab = await getActiveTab();
    const tabId = tab.id || 0;

    // Grab prior conversation turns for multi-turn context
    const history = conversationBuffer.toMessages();
    if (history.length > 0) {
      log.info(`Injecting ${conversationBuffer.turnCount} prior turns into context`);
    }

    const callbacks: PlannerCallbacks = {
      onThinking: (thought) => {
        broadcastToUI({ type: 'AGENT_THINKING', thought, requestId });
      },
      onAction: (tool, _params) => {
        broadcastToUI({
          type: 'TASK_STATUS',
          status: 'executing',
          stepDescription: `Running: ${tool}`,
          requestId,
        });
      },
      onResult: (tool, result) => {
        log.debug('Tool result', { tool, success: result.success });
      },
      onNeedConfirmation: (tool, params, reason) => {
        return new Promise<boolean>((resolve) => {
          pendingConfirmationResolve = resolve;
          broadcastToUI({
            type: 'CONFIRM_ACTION',
            action: tool,
            description: reason,
            details: params,
            requestId,
          });

          setTimeout(() => {
            if (pendingConfirmationResolve === resolve) {
              pendingConfirmationResolve = null;
              resolve(false);
            }
          }, 120000);
        });
      },
      onComplete: (response) => {
        broadcastToUI({
          type: 'AGENT_RESPONSE',
          text: response,
          requestId,
        });
      },
      onError: (error) => {
        broadcastToUI({
          type: 'AGENT_ERROR',
          error,
          requestId,
        });
      },
      onStatusChange: (status, step, total) => {
        broadcastToUI({
          type: 'TASK_STATUS',
          status: status as any,
          currentStep: step,
          totalSteps: total,
          requestId,
        });
      },
    };

    // Execute task and capture the final response
    const finalResponse = await executeTask(text, pageState, callbacks, tabId, history);

    // Store this exchange in the conversation buffer for future turns
    if (finalResponse && !finalResponse.startsWith('Reached maximum') && !finalResponse.startsWith('Error')) {
      conversationBuffer.addTurn(text, finalResponse);
    }

    // Broadcast updated turn count to UI
    broadcastToUI({
      type: 'TASK_STATUS',
      status: 'complete',
      stepDescription: `Session: ${conversationBuffer.turnCount} turn${conversationBuffer.turnCount !== 1 ? 's' : ''}`,
      requestId,
    });

  } catch (err) {
    log.error('Command failed', err);
    broadcastToUI({
      type: 'AGENT_ERROR',
      error: String(err),
      requestId,
    });
  } finally {
    isTaskRunning = false;
  }
}

async function getPageState(): Promise<PageState | null> {
  try {
    const tab = await getActiveTab();
    if (!tab.id) return null;
    await ensureContentScript(tab.id);
    const response = await sendToTab<{ state: PageState }>(tab.id, {
      type: 'ANALYZE_PAGE',
      requestId: `state_${Date.now()}`,
    });
    return response?.state || null;
  } catch (err) {
    log.warn('Failed to get page state', err);
    return null;
  }
}

log.info('Service worker ready');
