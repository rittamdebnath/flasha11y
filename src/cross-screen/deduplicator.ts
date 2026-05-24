import type { ScreenFinding, MergedFinding } from '../types/findings.js';
import { v4 as uuidv4 } from 'uuid';

const AUTO_MERGE_THRESHOLD = 0.85;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWords(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter((w) => w.length > 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function deduplicateFindings(
  findings: ScreenFinding[],
): { merged: MergedFinding[]; unique: ScreenFinding[] } {
  if (findings.length <= 1) {
    return { merged: [], unique: findings };
  }

  const used = new Set<number>();
  const merged: MergedFinding[] = [];
  const unique: ScreenFinding[] = [];

  for (let i = 0; i < findings.length; i++) {
    if (used.has(i)) continue;

    const duplicates: number[] = [i];
    const wordSetA = getWords(`${findings[i].title} ${findings[i].description}`);

    for (let j = i + 1; j < findings.length; j++) {
      if (used.has(j)) continue;

      const wordSetB = getWords(`${findings[j].title} ${findings[j].description}`);
      const similarity = jaccardSimilarity(wordSetA, wordSetB);

      if (similarity >= AUTO_MERGE_THRESHOLD) {
        duplicates.push(j);
        used.add(j);
      }
    }

    if (duplicates.length > 1) {
      used.add(i);
      const dupeFindings = duplicates.map((d) => findings[d]);
      merged.push(mergeFindings(dupeFindings));
    } else {
      unique.push(findings[i]);
    }
  }

  return { merged, unique };
}

function mergeFindings(dupes: ScreenFinding[]): MergedFinding {
  const base = dupes[0];
  const severityOrder: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };

  const highestSeverity = dupes.reduce((a, b) =>
    severityOrder[a.severity] > severityOrder[b.severity] ? a : b,
  );

  return {
    id: uuidv4(),
    title: base.title,
    description: base.description,
    severity: highestSeverity.severity,
    category: base.category,
    priority: Math.max(...dupes.map((d) => d.priority)),
    affectedUsers: [...new Set(dupes.flatMap((d) => d.affectedUsers))],
    wcagCriteria: [...new Set(dupes.flatMap((d) => d.wcagCriteria || []))],
    recommendation: base.recommendation,
    isCompanyRule: dupes.some((d) => d.isCompanyRule),
    occurrenceCount: dupes.length,
    affectedScreens: dupes.map((d) => ({
      path: d.screenPath,
      device: d.deviceCategory,
    })),
    findingIds: dupes.map((d) => d.id),
  };
}
