// ─── Workflow Scheduler ──────────────────────────────────────────────────────
// Phase 3: Schedule workflows using chrome.alarms.
// Service workers can be woken from sleep by alarms, making this the right
// mechanism for recurring automations in a Manifest V3 extension.

import { createLogger } from '@shared/logger';
import { getAllWorkflows, getWorkflow, executeWorkflow } from './engine';
import type { ToolResult } from '@shared/types/tools';
import { broadcastToUI } from '@shared/messaging';

const log = createLogger('background');

const ALARM_PREFIX = 'sanchalak_workflow_';
const CHECK_ALARM = 'sanchalak_schedule_check';

// ─── Alarm Setup ─────────────────────────────────────────────────────────────

/**
 * Called once when the service worker starts.
 * Sets up a periodic check alarm that fires every minute to evaluate schedules.
 */
export function initScheduler(): void {
  // Check schedules every minute
  chrome.alarms.create(CHECK_ALARM, { periodInMinutes: 1 });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CHECK_ALARM) {
      checkScheduledWorkflows();
    } else if (alarm.name.startsWith(ALARM_PREFIX)) {
      const workflowId = alarm.name.slice(ALARM_PREFIX.length);
      triggerWorkflow(workflowId, 'schedule');
    }
  });

  log.info('Workflow scheduler initialised');
}

/**
 * Schedule a workflow to run at specific intervals.
 * Uses chrome.alarms which survive service worker restarts.
 */
export async function scheduleWorkflow(
  workflowId: string,
  schedule: {
    /** 'daily' | 'hourly' | 'weekly' | 'custom' */
    type: 'daily' | 'hourly' | 'weekly' | 'custom';
    /** Hour of day for daily/weekly (0-23) */
    hour?: number;
    /** Minute for daily/weekly/custom (0-59) */
    minute?: number;
    /** Day of week for weekly (0=Sun, 1=Mon, ..., 6=Sat) */
    dayOfWeek?: number;
    /** Period in minutes for custom schedules */
    periodInMinutes?: number;
  }
): Promise<void> {
  const alarmName = `${ALARM_PREFIX}${workflowId}`;

  // Remove any existing alarm
  await chrome.alarms.clear(alarmName);

  const now = new Date();
  let delayInMinutes = 1;
  let periodInMinutes: number | undefined;

  switch (schedule.type) {
    case 'hourly':
      delayInMinutes = 60 - now.getMinutes();
      periodInMinutes = 60;
      break;

    case 'daily': {
      const targetHour = schedule.hour ?? 9;
      const targetMin = schedule.minute ?? 0;
      const target = new Date();
      target.setHours(targetHour, targetMin, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      delayInMinutes = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
      periodInMinutes = 24 * 60;
      break;
    }

    case 'weekly': {
      const targetDay = schedule.dayOfWeek ?? 1; // Monday
      const targetHour = schedule.hour ?? 9;
      const targetMin = schedule.minute ?? 0;
      const target = new Date();
      const daysUntilTarget = ((targetDay - now.getDay()) + 7) % 7 || 7;
      target.setDate(now.getDate() + daysUntilTarget);
      target.setHours(targetHour, targetMin, 0, 0);
      delayInMinutes = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
      periodInMinutes = 7 * 24 * 60;
      break;
    }

    case 'custom':
      delayInMinutes = schedule.periodInMinutes ?? 60;
      periodInMinutes = schedule.periodInMinutes ?? 60;
      break;
  }

  chrome.alarms.create(alarmName, { delayInMinutes, periodInMinutes });
  log.info('Workflow scheduled', { workflowId, schedule, delayInMinutes, periodInMinutes });
}

/** Remove a scheduled workflow alarm */
export async function unscheduleWorkflow(workflowId: string): Promise<void> {
  await chrome.alarms.clear(`${ALARM_PREFIX}${workflowId}`);
  log.info('Workflow unscheduled', { workflowId });
}

/** List all currently scheduled workflow alarms */
export async function getScheduledWorkflows(): Promise<string[]> {
  const alarms = await chrome.alarms.getAll();
  return alarms
    .filter((a) => a.name.startsWith(ALARM_PREFIX))
    .map((a) => a.name.slice(ALARM_PREFIX.length));
}

// ─── Schedule Checking ────────────────────────────────────────────────────────

/**
 * Called every minute by the CHECK_ALARM.
 * Checks if any workflows with inline cron-like schedules need to run.
 */
async function checkScheduledWorkflows(): Promise<void> {
  try {
    const workflows = await getAllWorkflows();
    const activeScheduled = workflows.filter((w) => w.isActive && w.schedule);

    for (const workflow of activeScheduled) {
      if (shouldRunNow(workflow.schedule!)) {
        log.info('Schedule triggered', { workflowId: workflow.id, name: workflow.name });
        triggerWorkflow(workflow.id, 'schedule');
      }
    }
  } catch (err) {
    log.warn('Schedule check error', err);
  }
}

/**
 * Simple cron expression evaluator for "minute hour * * dayOfWeek" format.
 * Supports: * for any, specific numbers.
 */
function shouldRunNow(schedule: string): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const [minExpr, hourExpr, , , dowExpr] = parts;
  const now = new Date();
  const minute = now.getMinutes();
  const hour = now.getHours();
  const dow = now.getDay();

  const matchesPart = (expr: string, value: number): boolean => {
    if (expr === '*') return true;
    if (expr.includes('/')) {
      const [, step] = expr.split('/');
      return value % parseInt(step) === 0;
    }
    return parseInt(expr) === value;
  };

  return matchesPart(minExpr, minute) && matchesPart(hourExpr, hour) && matchesPart(dowExpr, dow);
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

async function triggerWorkflow(
  workflowId: string,
  triggeredBy: 'manual' | 'schedule'
): Promise<void> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow || !workflow.isActive) return;

  broadcastToUI({
    type: 'TASK_STATUS',
    status: 'executing',
    stepDescription: `Running workflow: ${workflow.name}`,
    requestId: `wf_${workflowId}`,
  });

  try {
    // Stub tool executor — in production this would go through the full tool registry
    const stubExecutor = async (
      toolName: string,
      params: Record<string, unknown>,
      _tabId: number
    ): Promise<ToolResult> => {
      log.info('Workflow step executing', { toolName, params });
      return { success: true, data: { scheduled: true, toolName } };
    };

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id ?? 0;

    await executeWorkflow(workflowId, stubExecutor, tabId, triggeredBy);

    broadcastToUI({
      type: 'AGENT_RESPONSE',
      text: `Workflow "${workflow.name}" completed successfully.`,
      requestId: `wf_${workflowId}`,
    });
  } catch (err) {
    broadcastToUI({
      type: 'AGENT_ERROR',
      error: `Workflow "${workflow.name}" failed: ${String(err)}`,
      requestId: `wf_${workflowId}`,
    });
  }
}
