import type { Severity } from '../types/findings.js';

export interface BadgeStyle {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  label: string;
}

const SEVERITY_STYLES: Record<Severity, BadgeStyle> = {
  critical: {
    backgroundColor: '#DC2626',
    textColor: '#FFFFFF',
    borderColor: '#991B1B',
    label: 'CRITICAL',
  },
  high: {
    backgroundColor: '#EA580C',
    textColor: '#FFFFFF',
    borderColor: '#C2410C',
    label: 'HIGH',
  },
  medium: {
    backgroundColor: '#CA8A04',
    textColor: '#1C1917',
    borderColor: '#A16207',
    label: 'MEDIUM',
  },
  low: {
    backgroundColor: '#2563EB',
    textColor: '#FFFFFF',
    borderColor: '#1D4ED8',
    label: 'LOW',
  },
  info: {
    backgroundColor: '#6B7280',
    textColor: '#FFFFFF',
    borderColor: '#4B5563',
    label: 'INFO',
  },
};

export function getBadgeStyle(severity: Severity): BadgeStyle {
  return SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
}
