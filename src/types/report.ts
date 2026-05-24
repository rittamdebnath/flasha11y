import type {
  ScreenFinding,
  FlowFinding,
  CrossDeviceFinding,
  MergedFinding,
  PrioritizedAction,
  Severity,
  FindingCategory,
} from './findings.js';

export interface FlashA11YReport {
  metadata: {
    toolVersion: string;
    scanDate: string;
    duration: string;
    modelUsed: string;
    totalCost: number;
    screensAnalyzed: number;
    totalFindings: number;
  };
  summary: {
    overallScore: number;
    severityDistribution: Record<Severity, number>;
    categoryDistribution: Record<FindingCategory, number>;
    topIssues: string[];
    companyRuleOverridesApplied: number;
  };
  findings: {
    individual: ScreenFinding[];
    flow: FlowFinding[];
    crossDevice: CrossDeviceFinding[];
    merged: MergedFinding[];
  };
  priorities: PrioritizedAction[];
}
