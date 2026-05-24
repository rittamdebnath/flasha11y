import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmMessage, LlmResponse } from './llm-provider.js';

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateContent(params: {
    model: string;
    systemPrompt?: string;
    messages: LlmMessage[];
    maxTokens: number;
  }): Promise<LlmResponse> {
    const anthropicMessages = params.messages.map((msg) => ({
      role: 'user' as const,
      content: msg.parts.map((part) => {
        if ('text' in part) {
          return { type: 'text' as const, text: part.text };
        }
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: part.inlineData.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: part.inlineData.data,
          },
        };
      }),
    }));

    const request: Anthropic.MessageCreateParams = {
      model: params.model,
      max_tokens: params.maxTokens,
      messages: anthropicMessages,
    };

    if (params.systemPrompt) {
      request.system = params.systemPrompt;
    }

    const response = await this.client.messages.create(request);

    const rawText = response.content
      .filter((c) => c.type === 'text')
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('\n');

    return {
      text: rawText,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
        cacheCreateTokens: response.usage.cache_creation_input_tokens ?? undefined,
      },
    };
  }
}
