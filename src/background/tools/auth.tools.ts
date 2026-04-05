// ─── Authentication & Account Tools ─────────────────────────────────────────
// Phase 4: Login, logout, 2FA, account creation and profile management.
// All destructive/irreversible operations are safetyLevel: 'confirm'.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';

function createAuthTool(tool: Omit<Tool, 'execute'>): Tool {
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

export function registerAuthTools(): void {

  // ── login_to_account ───────────────────────────────────────────────────────
  toolRegistry.register(createAuthTool({
    name: 'login_to_account',
    description: 'Fill in and submit a login form on the current page. Detects username/email and password fields automatically.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'username', type: 'string', description: 'Username or email address', required: true },
      { name: 'password', type: 'string', description: 'Account password', required: true },
      { name: 'usernameSelector', type: 'string', description: 'CSS selector for the username field (auto-detected if omitted)', required: false },
      { name: 'passwordSelector', type: 'string', description: 'CSS selector for the password field (auto-detected if omitted)', required: false },
      { name: 'submitSelector', type: 'string', description: 'CSS selector for the submit button (auto-detected if omitted)', required: false },
      { name: 'waitForNavigation', type: 'boolean', description: 'Wait for page navigation after submit (default: true)', required: false },
    ],
  }));

  // ── logout ─────────────────────────────────────────────────────────────────
  toolRegistry.register(createAuthTool({
    name: 'logout',
    description: 'Find and click the logout or sign-out button on the current page.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector for the logout button (auto-detected if omitted)', required: false },
    ],
  }));

  // ── reset_password ─────────────────────────────────────────────────────────
  toolRegistry.register(createAuthTool({
    name: 'reset_password',
    description: 'Trigger and fill the forgot-password / reset-password flow on the current page.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'email', type: 'string', description: 'Email address to send reset link to', required: true },
      { name: 'forgotPasswordSelector', type: 'string', description: 'CSS selector for the "Forgot password?" link (auto-detected if omitted)', required: false },
    ],
  }));

  // ── handle_2fa ─────────────────────────────────────────────────────────────
  toolRegistry.register(createAuthTool({
    name: 'handle_2fa',
    description: 'Enter a two-factor authentication (2FA) or OTP code on the current page.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'code', type: 'string', description: 'The 2FA or OTP code to enter', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector of the OTP/2FA input field (auto-detected if omitted)', required: false },
    ],
  }));

  // ── create_account ─────────────────────────────────────────────────────────
  toolRegistry.register(createAuthTool({
    name: 'create_account',
    description: 'Fill in and submit a registration / sign-up form on the current page.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'email', type: 'string', description: 'Email address for the new account', required: true },
      { name: 'password', type: 'string', description: 'Password for the new account', required: true },
      { name: 'firstName', type: 'string', description: 'First name', required: false },
      { name: 'lastName', type: 'string', description: 'Last name', required: false },
      { name: 'additionalFields', type: 'object', description: 'Any extra registration fields as {fieldLabel: value}', required: false },
      { name: 'acceptTerms', type: 'boolean', description: 'Automatically check the "agree to terms" checkbox (default: false)', required: false },
    ],
  }));

  // ── update_profile ─────────────────────────────────────────────────────────
  toolRegistry.register(createAuthTool({
    name: 'update_profile',
    description: 'Update profile fields on the current account settings or profile page.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'fields', type: 'object', description: 'Profile fields to update as {fieldName: newValue}, e.g. {"displayName": "Alice", "bio": "Engineer"}', required: true },
      { name: 'saveSelector', type: 'string', description: 'CSS selector of the Save button (auto-detected if omitted)', required: false },
    ],
  }));

  // ── change_password ────────────────────────────────────────────────────────
  toolRegistry.register(createAuthTool({
    name: 'change_password',
    description: 'Fill in the change-password form on the current page (current password → new password).',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'currentPassword', type: 'string', description: 'Current account password', required: true },
      { name: 'newPassword', type: 'string', description: 'New password to set', required: true },
      { name: 'confirmPassword', type: 'string', description: 'Confirm new password (same as newPassword if omitted)', required: false },
    ],
  }));

  // ── add_security_info ──────────────────────────────────────────────────────
  toolRegistry.register(createAuthTool({
    name: 'add_security_info',
    description: 'Add or update security information on an account settings page (recovery email, phone number, security questions).',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'type', type: 'string', description: 'Type of security info: "recovery_email", "phone", "security_question"', required: true, enum: ['recovery_email', 'phone', 'security_question'] },
      { name: 'value', type: 'string', description: 'Value to set (email, phone number, or answer)', required: true },
      { name: 'question', type: 'string', description: 'Security question text (only for type="security_question")', required: false },
    ],
  }));
}
