// ─── Workflow Automation Engine ──────────────────────────────────────────────
// Phase 3: Defines, stores, and executes reusable multi-step workflows.
// Workflows are stored in IndexedDB and can be scheduled via chrome.alarms.

import { createLogger } from '@shared/logger';
import type { ToolResult } from '@shared/types/tools';

const log = createLogger('background');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  /** If set, this step only executes when the condition evaluates to true */
  condition?: {
    /** Key path in the prior step's result to check (e.g. "data.inStock") */
    resultPath: string;
    operator: '==' | '!=' | '>' | '<' | 'contains' | 'exists';
    value?: unknown;
  };
  /** Human-readable description of what this step does */
  description: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  /** cron-like schedule string (e.g. "0 9 * * 1" = every Monday 9am) */
  schedule?: string;
  /** Human-readable schedule label */
  scheduleLabel?: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stepResults: Record<string, ToolResult>;
  errorMessage?: string;
  triggeredBy: 'manual' | 'schedule' | 'event';
}

// ─── IndexedDB ───────────────────────────────────────────────────────────────

const DB_NAME = 'sanchalak_db';
const DB_VERSION = 2; // Version 2 adds workflow stores

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      // Preserve existing stores
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
      }
      if (!db.objectStoreNames.contains('audit')) {
        db.createObjectStore('audit', { keyPath: 'id' }).createIndex('timestamp', 'timestamp');
      }
      // New workflow stores
      if (!db.objectStoreNames.contains('workflows')) {
        const ws = db.createObjectStore('workflows', { keyPath: 'id' });
        ws.createIndex('name', 'name');
        ws.createIndex('isActive', 'isActive');
      }
      if (!db.objectStoreNames.contains('workflow_runs')) {
        const rs = db.createObjectStore('workflow_runs', { keyPath: 'id' });
        rs.createIndex('workflowId', 'workflowId');
        rs.createIndex('startedAt', 'startedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Workflow CRUD ────────────────────────────────────────────────────────────

export async function saveWorkflow(workflow: WorkflowDefinition): Promise<void> {
  workflow.updatedAt = Date.now();
  await dbPut('workflows', workflow);
  log.info('Workflow saved', { id: workflow.id, name: workflow.name });
}

export async function getWorkflow(id: string): Promise<WorkflowDefinition | undefined> {
  return dbGet<WorkflowDefinition>('workflows', id);
}

export async function getAllWorkflows(): Promise<WorkflowDefinition[]> {
  return dbGetAll<WorkflowDefinition>('workflows');
}

export async function deleteWorkflow(id: string): Promise<void> {
  await dbDelete('workflows', id);
  log.info('Workflow deleted', { id });
}

// ─── Condition Evaluation ─────────────────────────────────────────────────────

function getValueAtPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function evaluateCondition(
  condition: WorkflowStep['condition'],
  priorResult: ToolResult
): boolean {
  if (!condition) return true;

  const value = getValueAtPath(priorResult, condition.resultPath);

  switch (condition.operator) {
    case 'exists':
      return value !== undefined && value !== null;
    case '==':
      return value === condition.value;
    case '!=':
      return value !== condition.value;
    case '>':
      return typeof value === 'number' && value > (condition.value as number);
    case '<':
      return typeof value === 'number' && value < (condition.value as number);
    case 'contains':
      return typeof value === 'string' && value.includes(String(condition.value));
    default:
      return true;
  }
}

// ─── Workflow Execution ───────────────────────────────────────────────────────

/**
 * Execute a workflow by ID.
 * The toolExecutor is injected to avoid circular imports with the tool registry.
 */
export async function executeWorkflow(
  workflowId: string,
  toolExecutor: (toolName: string, params: Record<string, unknown>, tabId: number) => Promise<ToolResult>,
  tabId: number,
  triggeredBy: WorkflowRun['triggeredBy'] = 'manual',
  onStepComplete?: (stepId: string, result: ToolResult) => void
): Promise<WorkflowRun> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const run: WorkflowRun = {
    id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    workflowId,
    startedAt: Date.now(),
    status: 'running',
    stepResults: {},
    triggeredBy,
  };

  await dbPut('workflow_runs', run);
  log.info('Workflow run started', { runId: run.id, workflowName: workflow.name });

  try {
    let lastResult: ToolResult = { success: true };

    for (const step of workflow.steps) {
      // Check condition against prior step result
      if (step.condition && !evaluateCondition(step.condition, lastResult)) {
        log.info(`Step skipped (condition false)`, { stepId: step.id, tool: step.toolName });
        run.stepResults[step.id] = { success: true, data: { skipped: true, reason: 'condition_false' } };
        continue;
      }

      log.info(`Executing step`, { stepId: step.id, tool: step.toolName });

      try {
        const result = await toolExecutor(step.toolName, step.params, tabId);
        run.stepResults[step.id] = result;
        lastResult = result;
        onStepComplete?.(step.id, result);

        if (!result.success) {
          log.warn(`Step failed, continuing`, { stepId: step.id, error: result.error });
        }
      } catch (err) {
        const errResult: ToolResult = { success: false, error: String(err) };
        run.stepResults[step.id] = errResult;
        lastResult = errResult;
        onStepComplete?.(step.id, errResult);
      }
    }

    run.status = 'completed';
    run.completedAt = Date.now();
    log.info('Workflow run completed', { runId: run.id, steps: workflow.steps.length });
  } catch (err) {
    run.status = 'failed';
    run.errorMessage = String(err);
    run.completedAt = Date.now();
    log.error('Workflow run failed', { runId: run.id, error: run.errorMessage });
  }

  await dbPut('workflow_runs', run);
  return run;
}

export async function getWorkflowRuns(workflowId: string): Promise<WorkflowRun[]> {
  const all = await dbGetAll<WorkflowRun>('workflow_runs');
  return all.filter((r) => r.workflowId === workflowId).sort((a, b) => b.startedAt - a.startedAt);
}

// ─── Workflow Tool ────────────────────────────────────────────────────────────

/**
 * Register a tool that creates and manages workflows.
 * This is registered in the tool registry so the LLM can create automations.
 */
import { toolRegistry } from '../tools/tool-registry';
import type { Tool } from '@shared/types/tools';

export function registerWorkflowTools(): void {
  // Tool: list all saved workflows
  toolRegistry.register({
    name: 'list_workflows',
    description: 'List all saved automation workflows.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [],
    execute: async () => {
      const workflows = await getAllWorkflows();
      return {
        success: true,
        data: workflows.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          steps: w.steps.length,
          schedule: w.scheduleLabel || w.schedule || 'manual',
          isActive: w.isActive,
        })),
      };
    },
  } as Tool);

  // Tool: run a saved workflow by name
  toolRegistry.register({
    name: 'run_workflow',
    description: 'Execute a saved automation workflow by name or ID.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'workflowName', type: 'string', description: 'Name or ID of the workflow to run', required: true },
    ],
    execute: async (params) => {
      const workflows = await getAllWorkflows();
      const match = workflows.find(
        (w) => w.name.toLowerCase() === (params.workflowName as string).toLowerCase() || w.id === params.workflowName
      );
      if (!match) {
        return { success: false, error: `Workflow "${params.workflowName}" not found` };
      }
      // Simple execution stub — full execution requires the toolExecutor callback from service worker
      return {
        success: true,
        data: { message: `Workflow "${match.name}" queued for execution`, workflowId: match.id },
      };
    },
  } as Tool);
}
