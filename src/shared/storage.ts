// ─── Chrome Storage & IndexedDB Utilities ──────────────────────────────────

import type { LLMConfig, LLMProvider, AuditLogEntry, TaskHistoryEntry } from './types/agent';

// ─── Settings (synced across devices) ──────────────────────────────────────

export interface UserSettings {
  /** Active LLM provider */
  activeProvider: LLMProvider;
  /** API keys per provider **/
  apiKeys: Partial<Record<LLMProvider, string>>;
  /** Model per provider */
  models: Partial<Record<LLMProvider, string>>;
  /** Custom base URLs per provider (for OpenAI-compatible endpoints) */
  customEndpoints: Partial<Record<LLMProvider, string>>;
  /** Max plan steps before abort */
  maxPlanSteps: number;
  /** Typing speed: ms between keystrokes */
  typingDelay: number;
  /** Take screenshot after each action */
  autoScreenshot: boolean;
  /** Safety strictness */
  safetyLevel: 'strict' | 'moderate' | 'relaxed';
  /** UI theme */
  theme: 'dark' | 'light' | 'system';
  /** Temperature for LLM */
  temperature: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  activeProvider: 'google',
  apiKeys: {},
  models: {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-2.0-flash',
    nvidia: 'meta/llama-3.1-70b-instruct',
  },
  customEndpoints: {
    nvidia: 'https://integrate.api.nvidia.com/v1',
  },
  maxPlanSteps: 20,
  typingDelay: 80,
  autoScreenshot: false,
  safetyLevel: 'strict',
  theme: 'dark',
  temperature: 0.3,
};

export async function getSettings(): Promise<UserSettings> {
  const data = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
}

export async function setSettings(partial: Partial<UserSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.sync.set({ settings: { ...current, ...partial } });
}

export async function getActiveLLMConfig(): Promise<LLMConfig> {
  const settings = await getSettings();
  const provider = settings.activeProvider;
  const apiKey = settings.apiKeys[provider];
  if (!apiKey) {
    throw new Error(`No API key configured for ${provider}. Go to Options to set one.`);
  }
  return {
    provider,
    apiKey,
    model: settings.models[provider] || DEFAULT_SETTINGS.models[provider]!,
    maxTokens: 4096,
    temperature: settings.temperature,
    baseUrl: settings.customEndpoints?.[provider],
  };
}

// ─── Session State (local, not synced) ─────────────────────────────────────

export interface SessionState {
  lastActiveTabId?: number;
  lastPageUrl?: string;
  currentTaskId?: string;
}

export async function getSessionState(): Promise<SessionState> {
  const data = await chrome.storage.local.get('session');
  return (data.session || {}) as SessionState;
}

export async function setSessionState(partial: Partial<SessionState>): Promise<void> {
  const current = await getSessionState();
  await chrome.storage.local.set({ session: { ...current, ...partial } });
}

// ─── IndexedDB: Task History & Audit Log ───────────────────────────────────

const DB_NAME = 'sanchalak_db';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('startedAt', 'startedAt');
      }
      if (!db.objectStoreNames.contains('audit')) {
        const auditStore = db.createObjectStore('audit', { keyPath: 'id' });
        auditStore.createIndex('timestamp', 'timestamp');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addTaskHistory(entry: TaskHistoryEntry): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('tasks', 'readwrite');
  tx.objectStore('tasks').put(entry);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTaskHistory(limit = 50): Promise<TaskHistoryEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const index = store.index('startedAt');
    const request = index.openCursor(null, 'prev');
    const results: TaskHistoryEntry[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as TaskHistoryEntry);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addAuditLog(entry: AuditLogEntry): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('audit', 'readwrite');
  tx.objectStore('audit').put(entry);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('audit', 'readonly');
    const store = tx.objectStore('audit');
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev');
    const results: AuditLogEntry[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as AuditLogEntry);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
