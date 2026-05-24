import type { CrossDeviceFinding } from '../types/findings.js';

export function summarizeCrossDeviceIssues(
  findings: CrossDeviceFinding[],
): {
  totalScreenGroups: number;
  totalIssues: number;
  criticalBreakages: number;
  affectedScreenNames: string[];
} {
  const screenNames = [...new Set(findings.map((f) => f.screenName))];
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;

  return {
    totalScreenGroups: screenNames.length,
    totalIssues: findings.length,
    criticalBreakages: criticalCount,
    affectedScreenNames: screenNames,
  };
}
