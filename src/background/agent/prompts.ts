// ─── Agent Prompts ─────────────────────────────────────────────────────────
// System prompts and templates for the ReAct agent loop.

import type { ToolDescription } from '@shared/types/tools';
import type { PageState } from '@shared/types/dom';

/**
 * Build the system prompt for the agent.
 */
export function buildSystemPrompt(tools: ToolDescription[]): string {
  const toolList = tools
    .map((t) => {
      const params = Object.entries(t.parameters.properties)
        .map(([name, p]) => `    - ${name} (${p.type}${t.parameters.required.includes(name) ? ', required' : ''}): ${p.description}`)
        .join('\n');
      return `  • ${t.name}: ${t.description}\n${params}`;
    })
    .join('\n\n');

  return `You are Sanchalak, an AI-powered browser agent. You help users accomplish tasks in their web browser.

## Your Capabilities
You can interact with web pages using these tools:

${toolList}

## How You Work
1. When the user gives you a task, FIRST use 'get_page_state' or 'extract_page_text' to understand the current page.
2. Plan your actions step by step. Execute one tool at a time.
3. Observe the result before deciding the next step.
4. If a tool fails, DO NOT complain to the user. Try a different approach.
5. **CRITICAL**: When asked to find specific information (like "speakers" or "prices" or "names"), DO NOT look for a specific tool. YOU MUST use general tools like 'extract_page_text' or 'get_page_state' to read the page, and then USE YOUR OWN INTELLIGENCE to find the answer in the text and report it back to the user.

## Important Rules
- Use element selectors from the page state (elementIndex is most reliable).
- To answer user questions about the page, ALWAYS read the page text first, then formulate your answer.
- You are a smart reasoning agent. Read the text and deduce the answers.
- Wait for pages to load after navigation before extracting data.
- Never make up information — only report what you actually see on the page.

## Safety
- Never enter payment information
- Always show the user what you're about to do for sensitive actions
- If asked to do something that could cause harm, explain the risks first`;
}

/**
 * Format page state as context for the LLM.
 */
export function formatPageContext(state: PageState): string {
  let context = `## Current Page\n`;
  context += `- URL: ${state.url}\n`;
  context += `- Title: ${state.title}\n\n`;

  if (state.interactiveElements.length > 0) {
    context += `## Interactive Elements (${state.interactiveElements.length} total)\n`;
    for (const el of state.interactiveElements.slice(0, 50)) {
      const details = [
        el.tag,
        el.type ? `type=${el.type}` : '',
        el.role ? `role=${el.role}` : '',
        el.href ? `href=${el.href.substring(0, 60)}` : '',
        !el.isEnabled ? 'DISABLED' : '',
      ].filter(Boolean).join(', ');
      context += `  [${el.index}] ${el.text.substring(0, 80)} (${details})\n`;
    }
    context += '\n';
  }

  if (state.forms.length > 0) {
    context += `## Forms (${state.forms.length})\n`;
    for (const form of state.forms) {
      context += `  Form: ${form.selector}\n`;
      for (const field of form.fields) {
        context += `    - ${field.label || field.name || field.type}: ${field.type}${field.required ? ' (required)' : ''}${field.value ? ` = "${field.value}"` : ''}\n`;
      }
    }
    context += '\n';
  }

  if (state.visibleText) {
    const truncated = state.visibleText.substring(0, 3000);
    context += `## Visible Text (first 3000 chars)\n${truncated}\n\n`;
  }

  if (state.headings.length > 0) {
    context += `## Page Headings\n`;
    for (const h of state.headings) {
      context += `  ${'#'.repeat(h.level)} ${h.text}\n`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Build the user message with task + page context.
 */
export function buildTaskMessage(userGoal: string, pageState?: PageState): string {
  let message = `## User Task\n${userGoal}\n\n`;

  if (pageState) {
    message += formatPageContext(pageState);
  } else {
    message += `No page state available yet. Use 'get_page_state' first to understand the current page.\n`;
  }

  return message;
}

/**
 * Build a reflection prompt after a tool execution.
 */
export function buildReflectionMessage(
  toolName: string,
  params: Record<string, unknown>,
  result: { success: boolean; data?: unknown; error?: string },
  expectedOutcome: string
): string {
  return `## Last Action
- Tool: ${toolName}
- Parameters: ${JSON.stringify(params)}
- Success: ${result.success}
- Result: ${JSON.stringify(result.data || result.error).substring(0, 1000)}

## Expected Outcome
${expectedOutcome}

Based on this result, what should I do next? Continue with plan, retry, adjust approach, or report to user?`;
}
