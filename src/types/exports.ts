export type DeviceCategory = 'mobile' | 'tablet' | 'desktop';

export type ScreenType = 'screen' | 'flow' | 'state' | 'other';

export interface ScannedFile {
  path: string;
  filename: string;
  extension: 'png' | 'jpg' | 'jpeg';
  sizeBytes: number;
  deviceCategory?: DeviceCategory;
  screenType: ScreenType;
  flowName?: string;
  flowStep?: number;
  screenBaseName?: string;
  stateVariant?: string;
}

export interface ScreenGroup {
  id: string;
  screens: ScannedFile[];
  type: 'individual' | 'flow' | 'states' | 'cross-device';
  name: string;
}

export interface DesignContext {
  designSystem?: Record<string, unknown>;
  designTokens?: Record<string, unknown>;
  accessibilityGuidelines?: string;
  brandGuidelines?: Record<string, unknown>;
  productPrinciples?: string;
  severityRules?: SeverityOverride[];
}

import type { Severity, FindingCategory } from './findings.js';

export interface SeverityOverride {
  pattern: string;
  severity: Severity;
  category?: FindingCategory;
  reason: string;
}
