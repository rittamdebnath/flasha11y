import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DesignContext, ScannedFile, ScreenGroup } from '../types/exports.js';
import type { LlmMessage } from './llm-provider.js';

export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'prompt-templates');

async function loadTemplate(name: string): Promise<string> {
  return readFile(join(TEMPLATES_DIR, name), 'utf-8');
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  // Remove unused template variables (optional sections)
  result = result.replace(/\{\{#if \w+\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  return result;
}

function buildDesignContextString(context: DesignContext): string {
  const parts: string[] = [];

  if (context.accessibilityGuidelines) {
    parts.push('## Accessibility Guidelines');
    parts.push(context.accessibilityGuidelines);
  }

  if (context.productPrinciples) {
    parts.push('## Product Principles');
    parts.push(context.productPrinciples);
  }

  if (context.designTokens) {
    parts.push('## Design Tokens');
    parts.push(JSON.stringify(context.designTokens, null, 2));
  }

  if (context.designSystem) {
    parts.push('## Design System');
    parts.push(JSON.stringify(context.designSystem, null, 2));
  }

  if (context.severityRules && context.severityRules.length > 0) {
    parts.push('## Company Severity Rules (OVERRIDE generic recommendations)');
    for (const rule of context.severityRules) {
      parts.push(`- "${rule.pattern}" → ${rule.severity.toUpperCase()} (${rule.reason})`);
    }
  }

  return parts.join('\n\n');
}

export async function buildSystemPrompt(context: DesignContext): Promise<string> {
  const template = await loadTemplate('system.md');
  const designContextStr = buildDesignContextString(context);

  if (designContextStr) {
    return template + '\n\n' + designContextStr;
  }
  return template;
}

export async function buildScreenMessage(
  screen: ScannedFile,
  designContext: DesignContext,
  imageData: string,
  mediaType: ImageMimeType,
): Promise<LlmMessage> {
  const template = await loadTemplate('screen.md');
  const vars: Record<string, string> = {
    filename: screen.filename,
    deviceCategory: screen.deviceCategory || 'unknown',
    screenType: screen.screenType,
  };

  let textPrompt = fillTemplate(template, vars);

  if (designContext.accessibilityGuidelines || designContext.severityRules?.length) {
    const ctxStr = buildDesignContextString(designContext);
    textPrompt = textPrompt.replace(
      '{{#if designContext}}\n## COMPANY DESIGN CONTEXT',
      '## COMPANY DESIGN CONTEXT',
    );
    textPrompt = textPrompt.replace(
      '{{designContext}}\n{{/if}}',
      ctxStr,
    );
  }

  return {
    parts: [
      { text: textPrompt },
      { inlineData: { mimeType: mediaType, data: imageData } },
    ],
  };
}

export async function buildFlowMessage(
  group: ScreenGroup,
  _designContext: DesignContext,
  imageDataList: { data: string; mediaType: ImageMimeType; filename: string }[],
): Promise<LlmMessage> {
  const template = await loadTemplate('flow.md');
  const screenNames = imageDataList.map((i) => i.filename).join(', ');

  const textPrompt = fillTemplate(template, {
    screenCount: String(group.screens.length),
    flowName: group.name,
    screenNames,
  });

  const parts: LlmMessage['parts'] = [{ text: textPrompt }];

  for (const img of imageDataList) {
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
  }

  return { parts };
}

export async function buildCrossDeviceMessage(
  group: ScreenGroup,
  _designContext: DesignContext,
  imageDataList: { data: string; mediaType: ImageMimeType; filename: string; deviceCategory: string }[],
): Promise<LlmMessage> {
  const template = await loadTemplate('cross-device.md');
  const devices = imageDataList.map((i) => i.deviceCategory).join(', ');

  const textPrompt = fillTemplate(template, {
    screenName: group.name,
    deviceCount: String(imageDataList.length),
    devices,
  });

  const parts: LlmMessage['parts'] = [{ text: textPrompt }];

  for (const img of imageDataList) {
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
  }

  return { parts };
}
