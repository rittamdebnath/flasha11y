import { createCanvas, loadImage } from 'canvas';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, relative, extname } from 'node:path';
import type { ScreenFinding, Severity } from '../types/findings.js';
import type { CanvasCtx } from './text-layout.js';
import { getBadgeStyle } from './severity-badge.js';
import { layoutFindingText, drawFormattedText } from './text-layout.js';

interface AnnotatorConfig {
  outputDir: string;
  exportsDir: string;
  cardWidth?: number;
  padding?: number;
  backgroundColor?: string;
  textColor?: string;
}

const CORNER_RADIUS = 8;
const BADGE_PADDING_X = 10;
const BADGE_RADIUS = 4;
const CARD_GAP = 16;

function drawRoundedRect(
  ctx: CanvasCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawSeverityBadge(
  ctx: CanvasCtx,
  x: number,
  y: number,
  severity: Severity,
): { width: number; height: number } {
  const style = getBadgeStyle(severity);
  const label = style.label;
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const textMetrics = ctx.measureText(label);
  const badgeWidth = textMetrics.width + BADGE_PADDING_X * 2;
  const badgeHeight = 20;

  drawRoundedRect(ctx, x, y, badgeWidth, badgeHeight, BADGE_RADIUS);
  ctx.fillStyle = style.backgroundColor;
  ctx.fill();

  ctx.fillStyle = style.textColor;
  ctx.fillText(label, x + BADGE_PADDING_X, y + 14);

  return { width: badgeWidth, height: badgeHeight };
}

async function createAnnotatedImage(
  imagePath: string,
  findings: ScreenFinding[],
  config: Required<AnnotatorConfig>,
): Promise<Buffer> {
  const padding = config.padding;
  const cardWidth = config.cardWidth;

  // Load original image
  const originalImage = await loadImage(imagePath);
  const imgWidth = originalImage.width;
  const imgHeight = originalImage.height;

  // Calculate layout
  const findingsCount = findings.length;

  // Calculate total text content height
  const measureCanvas = createCanvas(cardWidth, 100);
  const measureCtx = measureCanvas.getContext('2d');

  let totalFindingsHeight = 0;
  const findingLayouts: Array<{
    lines: ReturnType<typeof layoutFindingText>['lines'];
    height: number;
  }> = [];

  for (const finding of findings) {
    const { lines, totalHeight } = layoutFindingText(
      measureCtx,
      finding.title,
      finding.description,
      finding.recommendation,
      finding.wcagCriteria,
      cardWidth - padding * 2,
    );
    // Each finding card: badge row (24px) + text content + padding
    const cardHeight = 24 + totalHeight + padding * 2;
    findingLayouts.push({ lines, height: cardHeight });
    totalFindingsHeight += cardHeight + CARD_GAP;
  }

  // Header height
  const headerHeight = 60;
  const findingsSectionHeight = findingsCount > 0
    ? headerHeight + totalFindingsHeight + padding
    : 0;

  // Total canvas
  const canvasWidth = Math.max(imgWidth, cardWidth);
  const canvasHeight = imgHeight + findingsSectionHeight;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw original image at top
  ctx.drawImage(originalImage, (canvasWidth - imgWidth) / 2, 0, imgWidth, imgHeight);

  if (findingsCount === 0) return canvas.toBuffer('image/png');

  // Separator line
  const separatorY = imgHeight + 4;
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, separatorY);
  ctx.lineTo(canvasWidth - padding, separatorY);
  ctx.stroke();

  // Section header
  const headerY = separatorY + 24;
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Accessibility & UX Audit Findings', padding, headerY);

  ctx.fillStyle = '#6B7280';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${findingsCount} finding${findingsCount !== 1 ? 's' : ''} for this screen`, padding, headerY + 22);

  // Draw finding cards
  let cardY = headerY + 48;
  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i];
    const layout = findingLayouts[i];
    const cardHeight = layout.height;

    // Card background
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, padding, cardY, cardWidth - padding * 2, cardHeight, CORNER_RADIUS);
    ctx.fill();
    ctx.stroke();

    // Card content
    const contentX = padding + 16;
    let contentY = cardY + 16;

    // Severity badge
    drawSeverityBadge(ctx, contentX, contentY, finding.severity);
    contentY += 28;

    // Finding number
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`#${i + 1}`, contentX, contentY);
    contentY += 16;

    // Draw formatted text
    drawFormattedText(ctx, contentX, contentY, layout.lines);

    cardY += cardHeight + CARD_GAP;
  }

  return canvas.toBuffer('image/png');
}

export async function annotateScreenImages(
  screenFindings: ScreenFinding[],
  config: AnnotatorConfig,
): Promise<string[]> {
  const resolvedConfig: Required<AnnotatorConfig> = {
    cardWidth: config.cardWidth ?? 900,
    padding: config.padding ?? 24,
    backgroundColor: config.backgroundColor ?? '#F9FAFB',
    textColor: config.textColor ?? '#111827',
    outputDir: config.outputDir,
    exportsDir: config.exportsDir,
  };

  // Group findings by screen path
  const byScreen = new Map<string, ScreenFinding[]>();
  for (const finding of screenFindings) {
    if (!byScreen.has(finding.screenPath)) {
      byScreen.set(finding.screenPath, []);
    }
    byScreen.get(finding.screenPath)!.push(finding);
  }

  const outputPaths: string[] = [];

  for (const [screenPath, findings] of byScreen) {
    // Sort findings by severity priority
    const sevOrder: Record<string, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1,
    };
    findings.sort((a, b) => (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0));

    // Determine output path, preserving folder structure
    const relPath = relative(config.exportsDir, screenPath);
    const ext = extname(relPath);
    const outputRelPath = relPath.replace(ext, '.png');
    const outputPath = join(resolvedConfig.outputDir, 'annotated', outputRelPath);

    await mkdir(dirname(outputPath), { recursive: true });

    const annotatedBuffer = await createAnnotatedImage(screenPath, findings, resolvedConfig);
    await writeFile(outputPath, annotatedBuffer);
    outputPaths.push(outputPath);
  }

  return outputPaths;
}
