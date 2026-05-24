import type { LlmModel } from './claude.js';

export interface FlashA11YConfig {
  exportsPath: string;
  contextPath: string;
  outputPath: string;
  model: LlmModel;
  concurrency: number;
  batchThreshold: number;
  noBoost: boolean;
  verbose: boolean;
  jsonOnly: boolean;
  mdOnly: boolean;
}
