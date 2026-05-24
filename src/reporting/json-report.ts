import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ScreenFinding,
  FlowFinding,
  CrossDeviceFinding,
  MergedFinding,
  PrioritizedAction,
  Severity,
  FindingCategory,
} from '../types/findings.js';
import type { FlashA11YReport } from '../types/report.js';

interface ReportInputs {
  screenFindings: ScreenFinding[];
  flowFindings: FlowFinding[];
  crossDeviceFindings: CrossDeviceFinding[];
  mergedFindings: MergedFinding[];
  priorities: PrioritizedAction[];
  metadata: {
    screensAnalyzed: number;
    totalCost: number;
    duration: string;
    modelUsed: string;
    companyRuleOverridesApplied: number;
  };
}

function buildSeverityDistribution(
  screenFindings: ScreenFinding[],
  flowFindings: FlowFinding[],
  crossDeviceFindings: CrossDeviceFinding[],
  mergedFindings: MergedFinding[],
): Record<Severity, number> {
  const dist: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const f of [...screenFindings, ...flowFindings, ...crossDeviceFindings]) {
    dist[f.severity] = (dist[f.severity] || 0) + 1;
  }
  for (const m of mergedFindings) {
    dist[m.severity] = (dist[m.severity] || 0) + 1;
  }

  return dist;
}

function buildCategoryDistribution(
  screenFindings: ScreenFinding[],
  flowFindings: FlowFinding[],
  crossDeviceFindings: CrossDeviceFinding[],
  mergedFindings: MergedFinding[],
): Record<FindingCategory, number> {
  const dist: Record<FindingCategory, number> = {
    accessibility: 0,
    usability: 0,
    cognitive_clarity: 0,
    design_consistency: 0,
    readability: 0,
    interaction_predictability: 0,
    flow_consistency: 0,
    responsive_consistency: 0,
  };

  for (const f of [...screenFindings, ...flowFindings, ...crossDeviceFindings]) {
    dist[f.category] = (dist[f.category] || 0) + 1;
  }
  for (const m of mergedFindings) {
    dist[m.category] = (dist[m.category] || 0) + 1;
  }

  return dist;
}

function computeOverallScore(severityDistribution: Record<Severity, number>): number {
  const weights: Record<Severity, number> = {
    critical: -5,
    high: -3,
    medium: -1,
    low: 0,
    info: 1,
  };

  let score = 100;
  for (const [severity, count] of Object.entries(severityDistribution)) {
    score += (weights[severity as Severity] || 0) * count;
  }
  return Math.max(0, Math.min(100, score));
}

export async function generateJsonReport(
  inputs: ReportInputs,
  outputPath: string,
): Promise<string> {
  const allFindings = [
    ...inputs.screenFindings,
    ...inputs.flowFindings,
    ...inputs.crossDeviceFindings,
  ];

  const severityDistribution = buildSeverityDistribution(
    inputs.screenFindings,
    inputs.flowFindings,
    inputs.crossDeviceFindings,
    inputs.mergedFindings,
  );

  const categoryDistribution = buildCategoryDistribution(
    inputs.screenFindings,
    inputs.flowFindings,
    inputs.crossDeviceFindings,
    inputs.mergedFindings,
  );

  const report: FlashA11YReport = {
    metadata: {
      toolVersion: '0.1.0',
      scanDate: new Date().toISOString(),
      duration: inputs.metadata.duration,
      modelUsed: inputs.metadata.modelUsed,
      totalCost: inputs.metadata.totalCost,
      screensAnalyzed: inputs.metadata.screensAnalyzed,
      totalFindings: allFindings.length + inputs.mergedFindings.length,
    },
    summary: {
      overallScore: computeOverallScore(severityDistribution),
      severityDistribution,
      categoryDistribution,
      topIssues: inputs.priorities.slice(0, 5).map((p) => p.finding.title),
      companyRuleOverridesApplied: inputs.metadata.companyRuleOverridesApplied,
    },
    findings: {
      individual: inputs.screenFindings,
      flow: inputs.flowFindings,
      crossDevice: inputs.crossDeviceFindings,
      merged: inputs.mergedFindings,
    },
    priorities: inputs.priorities,
  };

  const filePath = join(outputPath, 'flasha11y-report.json');
  await writeFile(filePath, JSON.stringify(report, null, 2));
  return filePath;
}
