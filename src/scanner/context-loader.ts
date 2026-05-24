import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import yaml from 'js-yaml';
import type { DesignContext, SeverityOverride } from '../types/exports.js';

const SUPPORTED_CONTEXT_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.md', '.txt']);

function parseSeverityOverrides(content: string): SeverityOverride[] {
  const rules: SeverityOverride[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Pattern: "rule -> severity" or "rule: severity" with optional reason
    const match = trimmed.match(/^(.+?)\s*[->:]\s*(critical|high|medium|low|info)\s*(?:#\s*(.*))?$/i);
    if (match) {
      rules.push({
        pattern: match[1].trim(),
        severity: match[2].toLowerCase() as SeverityOverride['severity'],
        reason: match[3]?.trim() || 'Company-specific rule',
      });
    }
  }

  return rules;
}

async function parseFile(filePath: string): Promise<Record<string, unknown> | string> {
  const content = await readFile(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case '.json':
      return JSON.parse(content);
    case '.yaml':
    case '.yml':
      return yaml.load(content) as Record<string, unknown>;
    case '.md':
    case '.txt':
      return content;
    default:
      return content;
  }
}

async function loadDirectory(dirPath: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!SUPPORTED_CONTEXT_EXTENSIONS.has(ext)) continue;

    const key = entry.name.replace(ext, '');
    const parsed = await parseFile(join(dirPath, entry.name));
    result[key] = parsed;
  }

  return result;
}

export async function loadContext(contextPath: string): Promise<DesignContext> {
  const context: DesignContext = {};

  try {
    context.designSystem = await loadDirectory(join(contextPath, 'design-system'));
  } catch { /* skip missing directories */ }

  try {
    context.designTokens = await loadDirectory(join(contextPath, 'design-tokens'));
  } catch { /* skip */ }

  try {
    context.brandGuidelines = await loadDirectory(join(contextPath, 'brand-guidelines'));
  } catch { /* skip */ }

  try {
    const accDir = join(contextPath, 'accessibility-guidelines');
    const accData = await loadDirectory(accDir);

    // Look for severity rules in accessibility guidelines
    const rulesContent = Object.values(accData).find(
      (v) => typeof v === 'string' && v.includes('->')
    );

    if (typeof rulesContent === 'string') {
      context.severityRules = parseSeverityOverrides(rulesContent);
    }
    context.accessibilityGuidelines = typeof rulesContent === 'string'
      ? rulesContent
      : JSON.stringify(accData, null, 2);
  } catch { /* skip */ }

  try {
    const ppDir = join(contextPath, 'product-principles');
    const ppData = await loadDirectory(ppDir);
    const textContent = Object.values(ppData).find((v) => typeof v === 'string');
    context.productPrinciples = typeof textContent === 'string' ? textContent : undefined;
  } catch { /* skip */ }

  return context;
}
