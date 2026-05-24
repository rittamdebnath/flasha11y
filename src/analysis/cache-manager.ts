export const CACHE_CONTROL_EPHEMERAL = { type: 'ephemeral' as const };

export function applyCacheControl(
  content: unknown[],
  cacheBreakpoints: number[],
): unknown[] {
  if (!Array.isArray(content)) return content;
  if (cacheBreakpoints.length === 0) return content;

  return content.map((block, index) => {
    if (cacheBreakpoints.includes(index) && (block as Record<string, unknown>).type === 'text') {
      return {
        ...(block as Record<string, unknown>),
        cache_control: CACHE_CONTROL_EPHEMERAL,
      };
    }
    return block;
  });
}

export function getSystemPromptCacheBreakpoint(): number[] {
  // Cache the system prompt as a single block
  return [0];
}

export function extractCacheStats(usage: {
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  input_tokens?: number;
}): { cacheReadTokens: number; cacheCreateTokens: number; cacheHitRate: number } {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheCreate = usage.cache_creation_input_tokens ?? 0;
  const totalInput = usage.input_tokens ?? 0;
  const cacheHitRate = totalInput > 0 ? cacheRead / totalInput : 0;

  return {
    cacheReadTokens: cacheRead,
    cacheCreateTokens: cacheCreate,
    cacheHitRate,
  };
}
