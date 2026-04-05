// ─── LLM Provider Interface ────────────────────────────────────────────────

import type { LLMConfig, LLMMessage, LLMResponse, LLMProvider } from '@shared/types/agent';
import type { ToolDescription } from '@shared/types/tools';

export interface LLMClient {
  chat(
    messages: LLMMessage[],
    tools?: ToolDescription[],
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse>;
}

/**
 * Create an LLM client for the given config.
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case 'openai':
    case 'nvidia':
      return new OpenAIClient(config);
    case 'anthropic':
      return new AnthropicClient(config);
    case 'google':
      return new GoogleClient(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

// ─── OpenAI Client ──────────────────────────────────────────────────────────

class OpenAIClient implements LLMClient {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], tools?: ToolDescription[]): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => this.formatMessage(m)),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const msg = choice.message;

    const toolCalls = msg.tool_calls?.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content: msg.content || '',
      toolCalls,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  private formatMessage(msg: LLMMessage): Record<string, unknown> {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: msg.content,
      };
    }
    const result: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    };
    if (msg.toolCalls) {
      result.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }
    return result;
  }
}

// ─── Anthropic Client ───────────────────────────────────────────────────────

class AnthropicClient implements LLMClient {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], tools?: ToolDescription[]): Promise<LLMResponse> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: nonSystemMessages.map((m) => this.formatMessage(m)),
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => m.content).join('\n\n');
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json();

    let content = '';
    const toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];

    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  private formatMessage(msg: LLMMessage): Record<string, unknown> {
    if (msg.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            content: msg.content,
          },
        ],
      };
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const content: unknown[] = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      return { role: 'assistant', content };
    }

    return { role: msg.role, content: msg.content };
  }
}

// ─── Google Gemini Client ───────────────────────────────────────────────────

class GoogleClient implements LLMClient {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], tools?: ToolDescription[]): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const contents = this.formatContents(messages);
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    // Add system instruction
    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('No response from Google API');

    let content = '';
    const toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];

    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        content += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  private formatContents(messages: LLMMessage[]): unknown[] {
    const contents: unknown[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue; // Handled separately

      if (msg.role === 'tool') {
        // Gemini expects functionResponse with the function NAME (not call ID)
        // and response as a parsed JSON object
        let parsedContent: unknown;
        try {
          parsedContent = JSON.parse(msg.content);
        } catch {
          parsedContent = { result: msg.content };
        }
        contents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: msg.toolName || msg.toolCallId || 'unknown',
                response: parsedContent,
              },
            },
          ],
        });
      } else if (msg.toolCalls && msg.toolCalls.length > 0) {
        const parts: unknown[] = [];
        if (msg.content) parts.push({ text: msg.content });
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: { name: tc.name, args: tc.arguments },
          });
        }
        contents.push({ role: 'model', parts });
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return contents;
  }
}
