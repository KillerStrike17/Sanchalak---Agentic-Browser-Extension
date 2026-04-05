// ─── Email & Contact Management Tools ───────────────────────────────────────
// Phase 2: Read, send, filter, organise emails and manage contacts.
// Works with Gmail, Outlook, Yahoo Mail, and other web email clients.

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

export function registerEmailTools(): void {

  // ── Email Management (17 tools) ───────────────────────────────────────────

  toolRegistry.register(createContentTool({
    name: 'read_emails',
    description: 'Read and extract emails from the current inbox view. Returns subject, sender, date, and preview.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'filter', type: 'string', description: 'Optional filter: "unread", "starred", "important", or "all" (default: "unread")', required: false },
      { name: 'limit', type: 'number', description: 'Maximum number of emails to return (default: 10)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'send_email',
    description: 'Compose and send an email. Requires user confirmation before sending.',
    category: 'email',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'to', type: 'string', description: 'Recipient email address(es), comma-separated', required: true },
      { name: 'subject', type: 'string', description: 'Email subject line', required: true },
      { name: 'body', type: 'string', description: 'Email body text', required: true },
      { name: 'cc', type: 'string', description: 'CC recipients, comma-separated', required: false },
      { name: 'bcc', type: 'string', description: 'BCC recipients, comma-separated', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'compose_email',
    description: 'Open the compose window and fill in email fields without sending (creates a draft for the user to review).',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'to', type: 'string', description: 'Recipient email address(es)', required: false },
      { name: 'subject', type: 'string', description: 'Email subject line', required: false },
      { name: 'body', type: 'string', description: 'Email body text', required: false },
      { name: 'cc', type: 'string', description: 'CC recipients', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'search_emails',
    description: 'Search emails using a query — finds emails by sender, subject, content, date, or labels.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query, e.g. "from:boss@company.com subject:project"', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'filter_emails',
    description: 'Apply a filter to the inbox to show emails matching certain criteria.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'from', type: 'string', description: 'Filter by sender address or name', required: false },
      { name: 'subject', type: 'string', description: 'Filter by subject containing this text', required: false },
      { name: 'dateRange', type: 'string', description: 'Date range filter, e.g. "last week", "last month", "today"', required: false },
      { name: 'hasAttachment', type: 'boolean', description: 'Only show emails with attachments', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'reply_to_email',
    description: 'Open the reply compose window for the currently open email. Requires confirmation before sending.',
    category: 'email',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'body', type: 'string', description: 'The reply text to type', required: true },
      { name: 'replyAll', type: 'boolean', description: 'Reply to all recipients (default: false)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'forward_email',
    description: 'Forward the currently open email to a new recipient. Requires confirmation.',
    category: 'email',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'to', type: 'string', description: 'Recipient to forward to', required: true },
      { name: 'additionalNote', type: 'string', description: 'Optional note to add before the forwarded content', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'create_draft',
    description: 'Save a composed email as a draft without sending.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'to', type: 'string', description: 'Recipient', required: false },
      { name: 'subject', type: 'string', description: 'Subject', required: false },
      { name: 'body', type: 'string', description: 'Email body', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'mark_read_unread',
    description: 'Mark one or more emails as read or unread.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'markAs', type: 'string', description: '"read" or "unread"', required: true, enum: ['read', 'unread'] },
      { name: 'selector', type: 'string', description: 'CSS selector of the email row (default: currently open email)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'delete_email',
    description: 'Move an email to the trash. Requires user confirmation.',
    category: 'email',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the email (default: currently open email)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'archive_email',
    description: 'Archive the currently open or selected email.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the email to archive (default: currently open)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'add_label',
    description: 'Add a label or tag to an email for organisation.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'label', type: 'string', description: 'The label to apply, e.g. "urgent", "work", "follow-up"', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector of the email (default: currently open)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_email_address',
    description: 'Extract the email address(es) of the sender and recipients from the currently open email.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'unsubscribe',
    description: 'Find and click the unsubscribe link in the currently open email or navigate to the unsubscribe page.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'mark_spam',
    description: 'Mark the currently open email as spam/junk.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the email (default: currently open)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'create_folder',
    description: 'Create a new email folder or label in the email client.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'folderName', type: 'string', description: 'Name of the folder to create', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'move_to_folder',
    description: 'Move an email to a specific folder.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'folderName', type: 'string', description: 'Destination folder name', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector of the email (default: currently open)', required: false },
    ],
  }));

  // ── Contact Management (4 tools) ──────────────────────────────────────────

  toolRegistry.register(createContentTool({
    name: 'extract_contact_info',
    description: 'Extract the name, email, phone, and company from the currently open email or contact card.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'create_contact',
    description: 'Create a new contact in the email client\'s address book.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'name', type: 'string', description: 'Full name', required: true },
      { name: 'email', type: 'string', description: 'Email address', required: true },
      { name: 'phone', type: 'string', description: 'Phone number', required: false },
      { name: 'company', type: 'string', description: 'Company name', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'update_contact',
    description: 'Update an existing contact\'s information.',
    category: 'email',
    safetyLevel: 'safe',
    parameters: [
      { name: 'contactName', type: 'string', description: 'Name or email to find the contact', required: true },
      { name: 'phone', type: 'string', description: 'New phone number', required: false },
      { name: 'company', type: 'string', description: 'New company', required: false },
      { name: 'notes', type: 'string', description: 'Notes to add', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'delete_contact',
    description: 'Delete a contact from the address book. Requires confirmation.',
    category: 'email',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'contactName', type: 'string', description: 'Name or email of the contact to delete', required: true },
    ],
  }));
}
