import type { DeviceCategory } from './exports.js';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingCategory =
  | 'accessibility'
  | 'usability'
  | 'cognitive_clarity'
  | 'design_consistency'
  | 'readability'
  | 'interaction_predictability'
  | 'flow_consistency'
  | 'responsive_consistency';

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: FindingCategory;
  priority: number;
  affectedUsers: string[];
  wcagCriteria?: string[];
  recommendation: string;
  isCompanyRule: boolean;
}

export interface ScreenFinding extends Finding {
  screenPath: string;
  screenName: string;
  deviceCategory: DeviceCategory;
  region?: { x: number; y: number; width: number; height: number };
}

export interface FlowFinding extends Finding {
  affectedScreens: string[];
  flowName: string;
}

export interface CrossDeviceFinding extends Finding {
  screensByDevice: Record<DeviceCategory, string>;
  screenName: string;
}

export interface MergedFinding extends Finding {
  occurrenceCount: number;
  affectedScreens: { path: string; device: DeviceCategory }[];
  findingIds: string[];
}

export interface PrioritizedAction {
  rank: number;
  finding: Finding | ScreenFinding | FlowFinding | CrossDeviceFinding;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  suggestedOwner: 'design' | 'engineering' | 'product';
}

export interface AnalysisResponse {
  findings: ScreenFinding[];
  summary: {
    totalFindings: number;
    severityBreakdown: Record<Severity, number>;
    categoryBreakdown: Record<FindingCategory, number>;
    topIssues: string[];
  };
  rawResponse: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreateTokens?: number;
  };
}
