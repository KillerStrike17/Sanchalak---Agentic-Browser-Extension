// ─── CRM & Sales Tools ───────────────────────────────────────────────────────
// Phase 3: Lead management, pipeline tracking, interaction logging.
// Works with Salesforce, HubSpot, Pipedrive, Zoho, and other web CRMs.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';

function createContentTool(tool: Omit<Tool, 'execute'>): Tool {
  return {
    ...tool,
    execute: async (params) => {
      const tab = await getActiveTab();
      if (!tab.id) throw new Error('No active tab');
      await ensureContentScript(tab.id);
      const response = await sendToTab<{ result: { success: boolean; data?: unknown; error?: string } }>(
        tab.id,
        { type: 'EXECUTE_TOOL', tool: tool.name, params, requestId: `tool_${Date.now()}` }
      );
      return response?.result || { success: false, error: 'No response from content script' };
    },
  };
}

export function registerCRMTools(): void {

  toolRegistry.register(createContentTool({
    name: 'create_lead',
    description: 'Create a new lead or contact record in the current CRM (Salesforce, HubSpot, etc.).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'name', type: 'string', description: 'Lead full name', required: true },
      { name: 'email', type: 'string', description: 'Lead email address', required: false },
      { name: 'company', type: 'string', description: 'Company name', required: false },
      { name: 'phone', type: 'string', description: 'Phone number', required: false },
      { name: 'source', type: 'string', description: 'Lead source (e.g. "Website", "Referral", "LinkedIn")', required: false },
      { name: 'notes', type: 'string', description: 'Initial notes about the lead', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'update_lead_status',
    description: 'Move a lead/deal to a different pipeline stage or update its status.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'leadName', type: 'string', description: 'Lead or deal name to update', required: true },
      { name: 'newStatus', type: 'string', description: 'New status or pipeline stage, e.g. "Proposal Sent", "Negotiation", "Won", "Lost"', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'log_interaction',
    description: 'Log a call, email, meeting, or note interaction against a CRM record.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'leadName', type: 'string', description: 'Lead or contact name to log against', required: true },
      { name: 'interactionType', type: 'string', description: 'Type of interaction: "call", "email", "meeting", "note"', required: true, enum: ['call', 'email', 'meeting', 'note'] },
      { name: 'summary', type: 'string', description: 'Summary or notes from the interaction', required: true },
      { name: 'duration', type: 'number', description: 'Duration in minutes (for calls/meetings)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'schedule_followup',
    description: 'Create a follow-up task or reminder for a CRM lead.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'leadName', type: 'string', description: 'Lead or contact name to set follow-up for', required: true },
      { name: 'followUpDate', type: 'string', description: 'Follow-up date in YYYY-MM-DD', required: true },
      { name: 'notes', type: 'string', description: 'What to follow up about', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'add_notes',
    description: 'Add notes to an existing CRM lead or deal record.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'leadName', type: 'string', description: 'Lead or deal name to add notes to', required: true },
      { name: 'notes', type: 'string', description: 'Notes to append to the record', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'send_followup_email',
    description: 'Compose and send a follow-up email to a CRM lead. Requires confirmation.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'leadName', type: 'string', description: 'Lead name to send follow-up to', required: true },
      { name: 'subject', type: 'string', description: 'Email subject', required: true },
      { name: 'body', type: 'string', description: 'Email body text', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'create_opportunity',
    description: 'Create a new sales opportunity or deal in the CRM pipeline.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'name', type: 'string', description: 'Opportunity or deal name', required: true },
      { name: 'company', type: 'string', description: 'Associated company', required: false },
      { name: 'value', type: 'number', description: 'Deal value in USD', required: false },
      { name: 'closeDate', type: 'string', description: 'Expected close date in YYYY-MM-DD', required: false },
      { name: 'stage', type: 'string', description: 'Initial pipeline stage', required: false },
    ],
  }));
}
