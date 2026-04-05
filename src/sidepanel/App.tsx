// ─── Side Panel: App Component ─────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';
import { useChatStore, type ChatMessage } from './stores/chatStore';
import { useAgent } from './hooks/useAgent';
import { getSettings, setSettings, type UserSettings } from '@shared/storage';
import { DEFAULT_MODELS } from '@shared/constants';
import type { LLMProvider } from '@shared/types/agent';
import './styles/index.css';
import './styles/chat.css';

const SUGGESTIONS = [
  '📄 "Extract all text from this page"',
  '🔗 "Get all links on this page"',
  '🔍 "Summarize this article"',
  '📊 "Extract table data from this page"',
  '🛒 "Find the price of this product"',
];

export default function App() {
  const { messages, taskStatus, stepDescription, isLoading, confirmation, sessionTurns } = useChatStore();
  const { sendCommand, confirmAction, cancelTask, newChat } = useAgent();
  const [input, setInput] = useState('');
  const [activeProvider, setActiveProvider] = useState<LLMProvider>('google');
  const [activeModel, setActiveModel] = useState<string>('');
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getSettings().then(s => {
      setUserSettings(s);
      setActiveProvider(s.activeProvider);
      setActiveModel(s.models[s.activeProvider] || '');
    });
  }, []);

  const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as LLMProvider;
    setActiveProvider(provider);
    let newModel = '';
    if (userSettings) {
      newModel = userSettings.models[provider] || DEFAULT_MODELS[provider]?.[0] || '';
      setActiveModel(newModel);
      const newSettings = {
        ...userSettings,
        activeProvider: provider,
        models: { ...userSettings.models, [provider]: newModel }
      };
      setUserSettings(newSettings);
      await setSettings(newSettings);
    } else {
      await setSettings({ activeProvider: provider });
    }
  };

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setActiveModel(model);
    if (userSettings) {
      const newSettings = {
        ...userSettings,
        models: { ...userSettings.models, [activeProvider]: model }
      };
      setUserSettings(newSettings);
      await setSettings(newSettings);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendCommand(text);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    const text = suggestion.replace(/^[^\s]+\s+"(.+)"$/, '$1');
    sendCommand(text);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const isBusy = taskStatus === 'planning' || taskStatus === 'executing' || taskStatus === 'waiting_confirmation';

  return (
    <div className="sidepanel">
      {/* Header */}
      <header className="sp-header">
        <div className="sp-header__logo">🎯</div>
        <span className="sp-header__title">Sanchalak</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select
            value={activeProvider}
            onChange={handleProviderChange}
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              fontSize: 'var(--font-size-xs)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="nvidia">NVIDIA</option>
          </select>

          <select
            value={activeModel}
            onChange={handleModelChange}
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              fontSize: 'var(--font-size-xs)',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '120px',
            }}
          >
            {(DEFAULT_MODELS[activeProvider] || []).map(m => (
              <option key={m} value={m}>{m.split('/').pop()}</option>
            ))}
          </select>
        </div>

        <div className="sp-header__status" style={{ marginLeft: '8px' }}>
          <div className={`sp-status-dot ${isBusy ? 'busy' : ''}`} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {isBusy ? 'Working...' : 'Ready'}
          </span>
        </div>
      </header>

      {/* Session Bar */}
      <div className="sp-session-bar">
        {sessionTurns > 0 ? (
          <span className="sp-session-turns">
            💬 {sessionTurns} turn{sessionTurns !== 1 ? 's' : ''} in session
          </span>
        ) : (
          <span className="sp-session-turns" style={{ opacity: 0.4 }}>
            New session
          </span>
        )}
        <button
          className="sp-new-chat-btn"
          onClick={newChat}
          disabled={isBusy}
          title="Start a new conversation (clears context)"
        >
          + New Chat
        </button>
      </div>

      {/* Task Status Bar */}
      {isBusy && (
        <div className="sp-task-status">
          <div className="sp-task-status__spinner" />
          <span className="sp-task-status__text">
            {stepDescription || 'Thinking...'}
          </span>
          <span className="sp-task-status__cancel" onClick={cancelTask}>
            Cancel
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="sp-messages">
        {messages.length === 0 && (
          <div className="sp-welcome">
            <div className="sp-welcome__icon">🎯</div>
            <h1 className="sp-welcome__title">Welcome to Sanchalak</h1>
            <p className="sp-welcome__subtitle">
              Your AI-powered browser agent. Tell me what you'd like to do and I'll handle it.
            </p>
            <div className="sp-welcome__suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="sp-suggestion"
                  onClick={() => handleSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Confirmation Dialog */}
      {confirmation && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <div className="confirm-dialog__icon">⚠️</div>
            <h2 className="confirm-dialog__title">Confirm Action</h2>
            <p className="confirm-dialog__description">{confirmation.description}</p>
            <div className="confirm-dialog__details">
              <strong>{confirmation.action}</strong>
              <pre>{JSON.stringify(confirmation.details, null, 2)}</pre>
            </div>
            <div className="confirm-dialog__actions">
              <button
                className="btn btn-secondary"
                onClick={() => confirmAction(confirmation.requestId, false)}
              >
                Reject
              </button>
              <button
                className="btn btn-primary"
                onClick={() => confirmAction(confirmation.requestId, true)}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="sp-input-area">
        <div className="sp-input-wrapper">
          <textarea
            ref={inputRef}
            className="sp-input"
            placeholder="Tell me what to do..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            className="sp-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            title="Send (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.type === 'thinking') {
    return (
      <div className="msg msg-agent msg-thinking">
        <div className="msg__bubble">
          <div className="thinking-dots">
            <span /><span /><span />
          </div>
          {message.text}
        </div>
      </div>
    );
  }

  if (message.type === 'action') {
    return (
      <div className={`msg msg-action ${message.actionType || 'info'}`}>
        <div className="msg__bubble">
          <span className="msg__icon">
            {message.actionType === 'success' ? '✅' : message.actionType === 'error' ? '❌' : '⚡'}
          </span>
          {message.text}
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <div className="msg msg-action error">
        <div className="msg__bubble">
          <span className="msg__icon">⚠️</span>
          {message.text}
        </div>
      </div>
    );
  }

  const isUser = message.type === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`msg ${isUser ? 'msg-user' : 'msg-agent'}`}>
      <div className="msg__bubble">{message.text}</div>
      <div className="msg__time">{time}</div>
    </div>
  );
}
