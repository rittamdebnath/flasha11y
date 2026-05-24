import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ScreenFinding,
  FlowFinding,
  CrossDeviceFinding,
  MergedFinding,
  PrioritizedAction,
  Severity,
} from '../types/findings.js';

interface MdReportInputs {
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
  flowsCount: number;
  crossDeviceCount: number;
}

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
  info: '⚪',
};

function findingsBySeverity<T extends { severity: Severity }>(
  findings: T[],
  severity: Severity,
): T[] {
  return findings.filter((f) => f.severity === severity);
}

function renderFindingBlock(f: {
  title: string;
  description: string;
  severity: Severity;
  recommendation: string;
  affectedUsers?: string[];
  wcagCriteria?: string[];
  isCompanyRule?: boolean;
}): string {
  const lines: string[] = [];
  lines.push(`#### ${SEVERITY_EMOJI[f.severity]} ${f.title}`);
  lines.push('');
  lines.push(`**Severity:** ${f.severity.toUpperCase()}${f.isCompanyRule ? ' [COMPANY RULE]' : ''}`);
  lines.push('');
  lines.push(f.description);
  lines.push('');

  if (f.affectedUsers && f.affectedUsers.length > 0) {
    lines.push(`**Affected users:** ${f.affectedUsers.join(', ')}`);
    lines.push('');
  }

  if (f.wcagCriteria && f.wcagCriteria.length > 0) {
    lines.push(`**WCAG Criteria:** ${f.wcagCriteria.join(', ')}`);
    lines.push('');
  }

  lines.push(`**Recommendation:** ${f.recommendation}`);
  lines.push('');

  return lines.join('\n');
}

function renderSeveritySection(
  findings: ScreenFinding[],
  severity: Severity,
  title: string,
): string {
  const filtered = findingsBySeverity(findings, severity);
  if (filtered.length === 0) return '';

  const lines: string[] = [];
  lines.push(`### ${title} (${filtered.length})`);
  lines.push('');

  for (const f of filtered) {
    lines.push(renderFindingBlock(f));
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export async function generateMarkdownReport(
  inputs: MdReportInputs,
  outputPath: string,
): Promise<string> {
  const { screenFindings, flowFindings, crossDeviceFindings, mergedFindings } = inputs;

  const allFindings = [...screenFindings, ...flowFindings, ...crossDeviceFindings];
  const critical = findingsBySeverity(allFindings, 'critical').length +
    findingsBySeverity(mergedFindings, 'critical').length;
  const high = findingsBySeverity(allFindings, 'high').length +
    findingsBySeverity(mergedFindings, 'high').length;
  const medium = findingsBySeverity(allFindings, 'medium').length +
    findingsBySeverity(mergedFindings, 'medium').length;
  const low = findingsBySeverity(allFindings, 'low').length +
    findingsBySeverity(mergedFindings, 'low').length;
  const info = findingsBySeverity(allFindings, 'info').length +
    findingsBySeverity(mergedFindings, 'info').length;
  const totalFindings = allFindings.length + mergedFindings.length;

  const lines: string[] = [];

  // Title & Executive Summary
  lines.push('# flashA11Y — Accessibility & UX Audit Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Tool version:** 0.1.0 | **Model:** ${inputs.metadata.modelUsed}`);
  lines.push(`**Duration:** ${inputs.metadata.duration} | **Cost:** $${inputs.metadata.totalCost.toFixed(4)}`);
  lines.push('');

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- **Screens analyzed:** ${inputs.metadata.screensAnalyzed}`);
  lines.push(`- **Total findings:** ${totalFindings}`);
  lines.push(`- **Critical:** ${critical} | **High:** ${high} | **Medium:** ${medium} | **Low:** ${low} | **Info:** ${info}`);
  lines.push(`- **Flows analyzed:** ${inputs.flowsCount}`);
  lines.push(`- **Cross-device groups:** ${inputs.crossDeviceCount}`);
  lines.push(`- **Company rule overrides applied:** ${inputs.metadata.companyRuleOverridesApplied}`);
  lines.push(`- **Duplicate findings merged:** ${mergedFindings.length}`);
  lines.push('');

  // Severity distribution bar
  lines.push('### Severity Distribution');
  lines.push('');
  lines.push('```');
  lines.push(`CRITICAL (${critical}): ${'█'.repeat(Math.min(critical, 40))}`);
  lines.push(`HIGH     (${high}): ${'█'.repeat(Math.min(high, 40))}`);
  lines.push(`MEDIUM   (${medium}): ${'█'.repeat(Math.min(medium, 40))}`);
  lines.push(`LOW      (${low}): ${'█'.repeat(Math.min(low, 40))}`);
  lines.push(`INFO     (${info}): ${'█'.repeat(Math.min(info, 40))}`);
  lines.push('```');
  lines.push('');

  // Top issues
  lines.push('### Top Issues to Address');
  lines.push('');
  for (let i = 0; i < Math.min(inputs.priorities.length, 5); i++) {
    const p = inputs.priorities[i];
    lines.push(`${i + 1}. ${SEVERITY_EMOJI[p.finding.severity]} **${p.finding.title}** (Effort: ${p.effort}, Impact: ${p.impact}, Owner: ${p.suggestedOwner})`);
  }
  lines.push('');

  // Accessibility Findings
  lines.push('## Accessibility Findings');
  lines.push('');
  lines.push(renderSeveritySection(screenFindings, 'critical', 'Critical'));
  lines.push(renderSeveritySection(screenFindings, 'high', 'High'));
  lines.push(renderSeveritySection(screenFindings, 'medium', 'Medium'));
  lines.push(renderSeveritySection(screenFindings, 'low', 'Low'));
  lines.push(renderSeveritySection(screenFindings, 'info', 'Info'));

  // Flow Consistency Findings
  if (flowFindings.length > 0) {
    lines.push('## Flow Consistency Findings');
    lines.push('');
    for (const f of flowFindings) {
      lines.push(renderFindingBlock(f));
      lines.push(`**Affected screens:** ${f.affectedScreens.join(', ')}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // Cross-Device Findings
  if (crossDeviceFindings.length > 0) {
    lines.push('## Cross-Device Consistency Findings');
    lines.push('');
    for (const f of crossDeviceFindings) {
      lines.push(renderFindingBlock(f));
      lines.push(`**Devices affected:** ${Object.keys(f.screensByDevice).join(', ')}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // Merged (recurring) Findings
  if (mergedFindings.length > 0) {
    lines.push('## Recurring Findings (Merged Across Screens)');
    lines.push('');
    lines.push('These findings appear across multiple screens and represent systemic issues.');
    lines.push('');
    for (const m of mergedFindings) {
      lines.push(renderFindingBlock(m));
      lines.push(`**Occurrences:** ${m.occurrenceCount} screens`);
      lines.push(`**Affected screens:** ${m.affectedScreens.map((s) => s.path).join(', ')}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // Prioritized Recommendations
  lines.push('## Prioritized Recommendations');
  lines.push('');
  lines.push('| # | Severity | Finding | Effort | Impact | Owner |');
  lines.push('|---|----------|---------|--------|--------|-------|');

  for (const p of inputs.priorities.slice(0, 20)) {
    lines.push(
      `| ${p.rank} | ${p.finding.severity.toUpperCase()} | ${p.finding.title} | ${p.effort} | ${p.impact} | ${p.suggestedOwner} |`,
    );
  }
  lines.push('');

  const filePath = join(outputPath, 'flasha11y-report.md');
  await writeFile(filePath, lines.join('\n'));
  return filePath;
}
