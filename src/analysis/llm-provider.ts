export interface LlmMessage {
  parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  >;
}

export interface LlmResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreateTokens?: number;
  };
}

export interface LlmProvider {
  generateContent(params: {
    model: string;
    systemPrompt?: string;
    messages: LlmMessage[];
    maxTokens: number;
  }): Promise<LlmResponse>;
}

export async function getProvider(model: string): Promise<LlmProvider> {
  if (model.startsWith('gemini-')) {
    const { GeminiProvider } = await import('./gemini-provider.js');
    return new GeminiProvider();
  }
  const { AnthropicProvider } = await import('./anthropic-provider.js');
  return new AnthropicProvider();
}
