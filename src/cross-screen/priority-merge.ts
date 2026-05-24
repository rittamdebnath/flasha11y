import type {
  ScreenFinding,
  FlowFinding,
  CrossDeviceFinding,
  MergedFinding,
  PrioritizedAction,
  Finding,
  Severity,
  FindingCategory,
} from '../types/findings.js';
import type { SeverityOverride } from '../types/exports.js';

const CATEGORY_PRIORITY: Record<FindingCategory, number> = {
  accessibility: 6,
  usability: 5,
  cognitive_clarity: 4,
  design_consistency: 3,
  readability: 2,
  interaction_predictability: 1,
  flow_consistency: 1,
  responsive_consistency: 1,
};

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2,
  info: 0,
};

type AnyFinding = ScreenFinding | FlowFinding | CrossDeviceFinding | MergedFinding;

function computeBasePriority(finding: Finding): number {
  const catWeight = CATEGORY_PRIORITY[finding.category] || 3;
  const sevWeight = SEVERITY_WEIGHT[finding.severity] || 4;
  return catWeight * sevWeight;
}

function applySeverityOverrides(
  finding: AnyFinding,
  overrides: SeverityOverride[],
  noBoost: boolean,
): AnyFinding {
  if (noBoost || overrides.length === 0) return finding;

  for (const rule of overrides) {
    const pattern = rule.pattern.toLowerCase();
    const title = finding.title.toLowerCase();
    const desc = finding.description.toLowerCase();

    if (title.includes(pattern) || desc.includes(pattern)) {
      const sevOrder: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
      const currentIdx = sevOrder.indexOf(finding.severity);
      const ruleIdx = sevOrder.indexOf(rule.severity);

      if (ruleIdx > currentIdx) {
        return {
          ...finding,
          severity: rule.severity,
          priority: computeBasePriority({ ...finding, severity: rule.severity }),
          isCompanyRule: true,
          recommendation: `${finding.recommendation}\n\n[Company Rule] ${rule.reason}`,
        };
      }
    }
  }

  return finding;
}

function estimateEffort(finding: Finding): 'low' | 'medium' | 'high' {
  const desc = finding.description.toLowerCase();
  if (desc.includes('animation') || desc.includes('motion') || desc.includes('color')) return 'low';
  if (desc.includes('layout') || desc.includes('spacing') || desc.includes('typography')) return 'medium';
  return 'high';
}

function estimateImpact(severity: Severity): 'low' | 'medium' | 'high' {
  if (severity === 'critical' || severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function suggestOwner(category: FindingCategory): 'design' | 'engineering' | 'product' {
  switch (category) {
    case 'accessibility':
    case 'interaction_predictability':
      return 'engineering';
    case 'usability':
    case 'cognitive_clarity':
      return 'product';
    default:
      return 'design';
  }
}

export function mergeAndPrioritize(
  screenFindings: ScreenFinding[],
  flowFindings: FlowFinding[],
  crossDeviceFindings: CrossDeviceFinding[],
  mergedFindings: MergedFinding[],
  severityOverrides: SeverityOverride[],
  noBoost: boolean,
): { allFindings: AnyFinding[]; priorities: PrioritizedAction[] } {
  const allFindings: AnyFinding[] = [
    ...screenFindings,
    ...flowFindings,
    ...crossDeviceFindings,
    ...mergedFindings,
  ];

  // Apply severity overrides
  const boosted = allFindings.map((f) =>
    applySeverityOverrides(f, severityOverrides, noBoost),
  );

  // Sort by priority (highest first)
  boosted.sort((a, b) => {
    const aPriority = computeBasePriority(a);
    const bPriority = computeBasePriority(b);
    return bPriority - aPriority;
  });

  // Generate prioritized actions
  const priorities: PrioritizedAction[] = boosted
    .filter((f) => f.severity !== 'info')
    .map((finding, index) => ({
      rank: index + 1,
      finding,
      effort: estimateEffort(finding),
      impact: estimateImpact(finding.severity),
      suggestedOwner: suggestOwner(finding.category),
    }));

  return { allFindings: boosted, priorities };
}
