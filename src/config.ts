import { resolve } from 'node:path';
import type { FlashA11YConfig } from './types/config.js';
import type { LlmModel } from './types/claude.js';

export function buildConfig(opts: {
  exports?: string;
  context?: string;
  output?: string;
  model?: string;
  concurrency?: string;
  batchThreshold?: string;
  noBoost?: boolean;
  verbose?: boolean;
  jsonOnly?: boolean;
  mdOnly?: boolean;
}): FlashA11YConfig {
  const validModels: LlmModel[] = [
    'claude-sonnet-4-6',
    'claude-opus-4-7',
    'claude-haiku-4-5-20251001',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3-flash-preview',
  ];

  const model = opts.model || 'claude-sonnet-4-6';
  if (!validModels.includes(model as LlmModel)) {
    throw new Error(`Invalid model: ${model}. Valid options: ${validModels.join(', ')}`);
  }

  return {
    exportsPath: resolve(opts.exports || './exports'),
    contextPath: resolve(opts.context || './context'),
    outputPath: resolve(opts.output || './output'),
    model: model as LlmModel,
    concurrency: Math.max(1, parseInt(opts.concurrency || '5', 10)),
    batchThreshold: Math.max(1, parseInt(opts.batchThreshold || '50', 10)),
    noBoost: opts.noBoost || false,
    verbose: opts.verbose || false,
    jsonOnly: opts.jsonOnly || false,
    mdOnly: opts.mdOnly || false,
  };
}
