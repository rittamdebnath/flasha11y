import { GoogleGenAI } from '@google/genai';
import type { LlmProvider, LlmMessage, LlmResponse } from './llm-provider.js';

export class GeminiProvider implements LlmProvider {
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_KEY environment variable is required');
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateContent(params: {
    model: string;
    systemPrompt?: string;
    messages: LlmMessage[];
    maxTokens: number;
  }): Promise<LlmResponse> {
    const contents = params.messages.map((msg) => ({
      role: 'user' as const,
      parts: msg.parts.map((part) => {
        if ('text' in part) {
          return { text: part.text };
        }
        return {
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          },
        };
      }),
    }));

    const request = {
      model: params.model,
      contents,
      config: {
        maxOutputTokens: params.maxTokens,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: params.systemPrompt
          ? { parts: [{ text: params.systemPrompt }] }
          : undefined,
      },
    };

    if (params.systemPrompt) {
      request.config.systemInstruction = {
        parts: [{ text: params.systemPrompt }],
      };
    }

    const response = await this.client.models.generateContent(request);

    const rawText = response.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text)
      .map((p) => p.text ?? '')
      .join('\n') ?? '';

    return {
      text: rawText,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        cacheReadTokens: response.usageMetadata?.cachedContentTokenCount ?? undefined,
        cacheCreateTokens: undefined,
      },
    };
  }
}
