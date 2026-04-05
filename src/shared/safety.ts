// ─── Safety Classification Engine ──────────────────────────────────────────
// Classifies every tool action as safe, confirm, or block.

import type { SafetyLevel } from './types/tools';

/** Tools that are BLOCKED — agent cannot execute, user must do it */
const BLOCKED_TOOLS = new Set([
  'complete_purchase',
  'transfer_money',
  'pay_bill',
  'check_balance',
  'change_password',
  'select_payment_method',
]);

/** Tools that require user CONFIRMATION before executing */
const CONFIRM_TOOLS = new Set([
  'send_email',
  'reply_to_email',
  'forward_email',
  'delete_email',
  'delete_file',
  'submit_form',
  'login_to_account',
  'create_account',
  'send_invoice',
  'cancel_booking',
  'create_event',
  'delete_event',
  'publish_content',
  'create_social_post',
  'send_followup_email',
]);

/**
 * Classify a tool action's safety level.
 * Can be overridden by user's safety settings.
 */
export function classifyAction(
  toolName: string,
  _params?: Record<string, unknown>,
  safetyLevel: 'strict' | 'moderate' | 'relaxed' = 'strict'
): SafetyLevel {
  // Blocked tools are always blocked regardless of safety level
  if (BLOCKED_TOOLS.has(toolName)) {
    return 'block';
  }

  // In strict mode, confirm tools require confirmation
  if (CONFIRM_TOOLS.has(toolName)) {
    if (safetyLevel === 'relaxed') return 'safe';
    return 'confirm';
  }

  // In strict mode, some normally-safe actions may also need confirmation
  if (safetyLevel === 'strict') {
    // Navigation to financial/sensitive sites
    if (toolName === 'navigate_to_url') {
      const url = _params?.url as string;
      if (url && isFinancialUrl(url)) {
        return 'confirm';
      }
    }
  }

  return 'safe';
}

function isFinancialUrl(url: string): boolean {
  const financialDomains = [
    'bank', 'chase', 'wellsfargo', 'paypal', 'venmo',
    'stripe', 'square', 'coinbase', 'robinhood',
  ];
  const lower = url.toLowerCase();
  return financialDomains.some((d) => lower.includes(d));
}

/**
 * Get a human-readable description of why an action needs confirmation.
 */
export function getSafetyReason(toolName: string): string {
  if (BLOCKED_TOOLS.has(toolName)) {
    return 'This action involves financial transactions or sensitive account changes. You must complete it yourself.';
  }
  if (CONFIRM_TOOLS.has(toolName)) {
    return 'This action will modify data or send communications. Please review before proceeding.';
  }
  return 'This action is safe to execute automatically.';
}
