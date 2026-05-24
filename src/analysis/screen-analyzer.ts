import { v4 as uuidv4 } from 'uuid';
import type { ScannedFile, DesignContext, ScreenGroup } from '../types/exports.js';
import type {
  ScreenFinding,
  FlowFinding,
  CrossDeviceFinding,
  AnalysisResponse,
  Severity,
  FindingCategory,
} from '../types/findings.js';
import { imageToBase64 } from '../utils/image.js';
import {
  buildSystemPrompt,
  buildScreenMessage,
  buildFlowMessage,
  buildCrossDeviceMessage,
} from './prompt-builder.js';
import { getProvider } from './llm-provider.js';

function parseAnalysisResponse(
  rawResponse: string,
  screenPath: string,
  screenName: string,
  deviceCategory: string,
): AnalysisResponse {
  try {
    // Extract JSON from response (it may be wrapped in markdown code blocks)
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawResponse.trim();
    const parsed = JSON.parse(jsonStr);

    const findings: ScreenFinding[] = (parsed.findings || []).map((f: Record<string, unknown>) => ({
      id: (f.id as string) || uuidv4(),
      title: f.title as string || 'Untitled finding',
      description: f.description as string || '',
      severity: (f.severity as Severity) || 'medium',
      category: (f.category as FindingCategory) || 'accessibility',
      priority: (f.priority as number) || 5,
      affectedUsers: (f.affectedUsers as string[]) || [],
      wcagCriteria: (f.wcagCriteria as string[]) || undefined,
      recommendation: f.recommendation as string || '',
      isCompanyRule: (f.isCompanyRule as boolean) || false,
      screenPath,
      screenName,
      deviceCategory: deviceCategory as ScreenFinding['deviceCategory'],
    }));

    return {
      findings,
      summary: {
        totalFindings: findings.length,
        severityBreakdown: countBy(findings, 'severity') as Record<Severity, number>,
        categoryBreakdown: countBy(findings, 'category') as Record<FindingCategory, number>,
        topIssues: findings.slice(0, 3).map((f) => f.title),
      },
      rawResponse,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  } catch {
    // If JSON parsing fails, return a minimal response with the raw text
    return {
      findings: [],
      summary: {
        totalFindings: 0,
        severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        categoryBreakdown: {
          accessibility: 0,
          usability: 0,
          cognitive_clarity: 0,
          design_consistency: 0,
          readability: 0,
          interaction_predictability: 0,
          flow_consistency: 0,
          responsive_consistency: 0,
        },
        topIssues: [],
      },
      rawResponse,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

function countBy<T>(items: T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key] ?? 'unknown');
    counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}

export async function analyzeScreen(
  screen: ScannedFile,
  designContext: DesignContext,
  systemPrompt: string,
  model: string,
): Promise<AnalysisResponse> {
  const { data, mediaType } = await imageToBase64(screen.path);
  const message = await buildScreenMessage(screen, designContext, data, mediaType);

  const provider = await getProvider(model);
  const response = await provider.generateContent({
    model,
    systemPrompt,
    messages: [message],
    maxTokens: 8192,
  });

  const deviceCategory = screen.deviceCategory || 'unknown';
  const result = parseAnalysisResponse(response.text, screen.path, screen.filename, deviceCategory);

  result.usage = response.usage;

  return result;
}

export async function analyzeFlow(
  group: ScreenGroup,
  designContext: DesignContext,
  _systemPrompt: string,
  model: string,
): Promise<{ findings: FlowFinding[]; usage: { inputTokens: number; outputTokens: number } }> {
  const imageDataList = await Promise.all(
    group.screens.map(async (s) => {
      const { data, mediaType } = await imageToBase64(s.path);
      return { data, mediaType, filename: s.filename };
    }),
  );

  const message = await buildFlowMessage(group, designContext, imageDataList);

  const provider = await getProvider(model);
  const response = await provider.generateContent({
    model,
    messages: [message],
    maxTokens: 8192,
  });

  // Parse flow findings
  const flowFindings: FlowFinding[] = [];
  try {
    const jsonMatch = response.text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.text.trim();
    const parsed = JSON.parse(jsonStr);

    for (const f of parsed.findings || []) {
      flowFindings.push({
        id: (f.id as string) || uuidv4(),
        title: f.title as string || 'Untitled',
        description: f.description as string || '',
        severity: (f.severity as Severity) || 'medium',
        category: (f.category as FindingCategory) || 'flow_consistency',
        priority: 5,
        affectedUsers: (f.affectedUsers as string[]) || [],
        wcagCriteria: (f.wcagCriteria as string[]) || undefined,
        recommendation: f.recommendation as string || '',
        isCompanyRule: false,
        affectedScreens: group.screens.map((s) => s.path),
        flowName: group.name,
      });
    }
  } catch { /* return empty findings if parsing fails */ }

  return {
    findings: flowFindings,
    usage: response.usage,
  };
}

export async function analyzeCrossDevice(
  group: ScreenGroup,
  designContext: DesignContext,
  _systemPrompt: string,
  model: string,
): Promise<{ findings: CrossDeviceFinding[]; usage: { inputTokens: number; outputTokens: number } }> {
  const imageDataList = await Promise.all(
    group.screens.map(async (s) => {
      const { data, mediaType } = await imageToBase64(s.path);
      return {
        data,
        mediaType,
        filename: s.filename,
        deviceCategory: s.deviceCategory || 'unknown',
      };
    }),
  );

  const message = await buildCrossDeviceMessage(group, designContext, imageDataList);

  const provider = await getProvider(model);
  const response = await provider.generateContent({
    model,
    messages: [message],
    maxTokens: 8192,
  });

  const crossDeviceFindings: CrossDeviceFinding[] = [];
  try {
    const jsonMatch = response.text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.text.trim();
    const parsed = JSON.parse(jsonStr);

    const devices: Record<string, string> = {};
    for (const s of group.screens) {
      devices[s.deviceCategory || 'unknown'] = s.path;
    }

    for (const f of parsed.findings || []) {
      crossDeviceFindings.push({
        id: (f.id as string) || uuidv4(),
        title: f.title as string || 'Untitled',
        description: f.description as string || '',
        severity: (f.severity as Severity) || 'medium',
        category: (f.category as FindingCategory) || 'responsive_consistency',
        priority: 5,
        affectedUsers: (f.affectedUsers as string[]) || [],
        recommendation: f.recommendation as string || '',
        isCompanyRule: false,
        screensByDevice: devices as Record<string, string>,
        screenName: group.name,
      });
    }
  } catch { /* return empty findings */ }

  return {
    findings: crossDeviceFindings,
    usage: response.usage,
  };
}

export { buildSystemPrompt };
