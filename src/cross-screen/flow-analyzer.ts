export function summarizeFlowConsistency(
  flowFindings: import('../types/findings.js').FlowFinding[],
): {
  totalFlows: number;
  totalIssues: number;
  mostCommonIssue: string;
  flowsWithIssues: string[];
} {
  const flowNames = [...new Set(flowFindings.map((f) => f.flowName))];
  const severityCounts: Record<string, number> = {};

  for (const f of flowFindings) {
    severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
  }

  const mostCommonIssue = flowFindings.length > 0
    ? flowFindings.sort((a, b) => (severityCounts[b.severity] || 0) - (severityCounts[a.severity] || 0))[0].title
    : 'None';

  return {
    totalFlows: flowNames.length,
    totalIssues: flowFindings.length,
    mostCommonIssue,
    flowsWithIssues: flowNames,
  };
}
