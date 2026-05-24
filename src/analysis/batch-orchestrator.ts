import pLimit from 'p-limit';
import type { DesignContext, ScreenGroup } from '../types/exports.js';
import type {
  ScreenFinding,
  FlowFinding,
  CrossDeviceFinding,
  AnalysisResponse,
} from '../types/findings.js';
import type { FlashA11YConfig } from '../types/config.js';
import type { Logger } from '../utils/logger.js';
import { analyzeScreen, analyzeFlow, analyzeCrossDevice, buildSystemPrompt } from './screen-analyzer.js';

export interface BatchResults {
  screenFindings: ScreenFinding[];
  flowFindings: FlowFinding[];
  crossDeviceFindings: CrossDeviceFinding[];
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreateTokens: number;
}

const COST_PER_1K_INPUT: Record<string, number> = {
  'claude-sonnet-4-6': 0.003,
  'claude-opus-4-7': 0.015,
  'claude-haiku-4-5-20251001': 0.001,
  'gemini-2.0-flash': 0.00015,
  'gemini-2.5-flash': 0.00015,
  'gemini-2.5-pro': 0.00125,
  'gemini-3-flash-preview': 0.00015,
};

const COST_PER_1K_OUTPUT: Record<string, number> = {
  'claude-sonnet-4-6': 0.015,
  'claude-opus-4-7': 0.075,
  'claude-haiku-4-5-20251001': 0.005,
  'gemini-2.0-flash': 0.0006,
  'gemini-2.5-flash': 0.0006,
  'gemini-2.5-pro': 0.005,
  'gemini-3-flash-preview': 0.0006,
};

const COST_PER_1K_CACHE_READ: Record<string, number> = {
  'claude-sonnet-4-6': 0.0003,
  'claude-opus-4-7': 0.0015,
  'claude-haiku-4-5-20251001': 0.0001,
  'gemini-2.0-flash': 0,
  'gemini-2.5-flash': 0,
  'gemini-2.5-pro': 0,
  'gemini-3-flash-preview': 0,
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
): number {
  const inputCost = (inputTokens / 1000) * (COST_PER_1K_INPUT[model] || 0.003);
  const outputCost = (outputTokens / 1000) * (COST_PER_1K_OUTPUT[model] || 0.015);
  const cacheReadCost = (cacheReadTokens / 1000) * (COST_PER_1K_CACHE_READ[model] || 0.0003);
  return inputCost + outputCost + cacheReadCost;
}

export async function runAnalysisBatch(
  groups: ScreenGroup[],
  designContext: DesignContext,
  config: FlashA11YConfig,
  logger: Logger,
): Promise<BatchResults> {
  const systemPrompt = await buildSystemPrompt(designContext);
  const limit = pLimit(config.concurrency);

  const individualGroups = groups.filter((g) => g.type === 'individual');
  const flowGroups = groups.filter((g) => g.type === 'flow');
  const crossDeviceGroups = groups.filter((g) => g.type === 'cross-device');

  logger.info(
    `Analyzing ${individualGroups.length} individual screens, ${flowGroups.length} flows, ${crossDeviceGroups.length} cross-device groups`,
  );

  // Analyze individual screens
  const screenResults: AnalysisResponse[] = [];
  const tasks = individualGroups.map((group) =>
    limit(async () => {
      const screen = group.screens[0];
      logger.debug(`Analyzing: ${screen.filename}`);
      return analyzeScreen(screen, designContext, systemPrompt, config.model);
    }),
  );

  for (const task of tasks) {
    screenResults.push(await task);
  }

  // Analyze flows
  const flowResults: { findings: FlowFinding[]; usage: { inputTokens: number; outputTokens: number } }[] = [];
  for (const group of flowGroups) {
    try {
      const result = await analyzeFlow(group, designContext, systemPrompt, config.model);
      flowResults.push(result);
    } catch (err) {
      logger.error(`Flow analysis failed for ${group.name}: ${err}`);
    }
  }

  // Analyze cross-device groups
  const crossDeviceResults: { findings: CrossDeviceFinding[]; usage: { inputTokens: number; outputTokens: number } }[] = [];
  for (const group of crossDeviceGroups) {
    try {
      const result = await analyzeCrossDevice(group, designContext, systemPrompt, config.model);
      crossDeviceResults.push(result);
    } catch (err) {
      logger.error(`Cross-device analysis failed for ${group.name}: ${err}`);
    }
  }

  // Aggregate
  const allScreenFindings = screenResults.flatMap((r) => r.findings);
  const allFlowFindings = flowResults.flatMap((r) => r.findings);
  const allCrossDeviceFindings = crossDeviceResults.flatMap((r) => r.findings);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreateTokens = 0;

  for (const r of screenResults) {
    totalInputTokens += r.usage.inputTokens;
    totalOutputTokens += r.usage.outputTokens;
    totalCacheReadTokens += r.usage.cacheReadTokens || 0;
    totalCacheCreateTokens += r.usage.cacheCreateTokens || 0;
  }
  for (const r of flowResults) {
    totalInputTokens += r.usage.inputTokens;
    totalOutputTokens += r.usage.outputTokens;
  }
  for (const r of crossDeviceResults) {
    totalInputTokens += r.usage.inputTokens;
    totalOutputTokens += r.usage.outputTokens;
  }

  const totalCost = calculateCost(config.model, totalInputTokens, totalOutputTokens, totalCacheReadTokens);

  logger.info(
    `Analysis complete: ${allScreenFindings.length} screen findings, ${allFlowFindings.length} flow findings, ${allCrossDeviceFindings.length} cross-device findings`,
  );
  logger.info(
    `Tokens: ${totalInputTokens.toLocaleString()} in / ${totalOutputTokens.toLocaleString()} out, Cost: $${totalCost.toFixed(4)}`,
  );

  return {
    screenFindings: allScreenFindings,
    flowFindings: allFlowFindings,
    crossDeviceFindings: allCrossDeviceFindings,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCacheCreateTokens,
  };
}
