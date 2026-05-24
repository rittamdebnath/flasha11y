// Canvas context type compatible with both DOM and node-canvas packages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CanvasCtx = any;

export interface LayoutOptions {
  maxWidth: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  maxWidth: 800,
  fontSize: 14,
  lineHeight: 1.6,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export interface WrappedLine {
  text: string;
  y: number;
  height: number;
  isBold: boolean;
  fontSize: number;
  color: string;
}

export function measureText(
  ctx: CanvasCtx,
  text: string,
  font: string,
): number {
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function wrapText(
  ctx: CanvasCtx,
  text: string,
  maxWidth: number,
  font: string,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureText(ctx, testLine, font);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function computeTextHeight(
  ctx: CanvasCtx,
  text: string,
  maxWidth: number,
  options: Partial<LayoutOptions> = {},
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const font = `${opts.fontSize}px ${opts.fontFamily}`;
  const lines = wrapText(ctx, text, maxWidth, font);
  return lines.length * opts.fontSize * opts.lineHeight;
}

export function drawFormattedText(
  ctx: CanvasCtx,
  x: number,
  startY: number,
  lines: WrappedLine[],
): number {
  let currentY = startY;

  for (const line of lines) {
    const font = `${line.isBold ? 'bold ' : ''}${line.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.font = font;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, x, currentY);
    currentY += line.height;
  }

  return currentY;
}

export function layoutFindingText(
  ctx: CanvasCtx,
  title: string,
  description: string,
  recommendation: string,
  wcagCriteria: string[] | undefined,
  maxWidth: number,
): { lines: WrappedLine[]; totalHeight: number } {
  const bodySize = 14;
  const headingSize = 18;
  const smallSize = 12;
  const lineHeight = 1.6;
  const titleColor = '#111827';
  const bodyColor = '#374151';
  const recColor = '#1D4ED8';
  const wcagColor = '#6B7280';

  const headingFont = `bold ${headingSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const bodyFont = `${bodySize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  const lines: WrappedLine[] = [];

  // Title (bold, larger)
  const titleLines = wrapText(ctx, title, maxWidth, headingFont);
  for (const line of titleLines) {
    lines.push({
      text: line,
      y: 0,
      height: headingSize * lineHeight,
      isBold: true,
      fontSize: headingSize,
      color: titleColor,
    });
  }

  // Spacing after title
  lines.push({
    text: '',
    y: 0,
    height: 8,
    isBold: false,
    fontSize: bodySize,
    color: bodyColor,
  });

  // Description
  const descLines = wrapText(ctx, description, maxWidth, bodyFont);
  for (const line of descLines) {
    lines.push({
      text: line,
      y: 0,
      height: bodySize * lineHeight,
      isBold: false,
      fontSize: bodySize,
      color: bodyColor,
    });
  }

  // Spacing before recommendation
  lines.push({
    text: '',
    y: 0,
    height: 12,
    isBold: false,
    fontSize: bodySize,
    color: bodyColor,
  });

  // Recommendation heading
  lines.push({
    text: 'Recommendation:',
    y: 0,
    height: bodySize * lineHeight,
    isBold: true,
    fontSize: bodySize,
    color: recColor,
  });

  // Recommendation text
  const recLines = wrapText(ctx, recommendation, maxWidth, bodyFont);
  for (const line of recLines) {
    lines.push({
      text: line,
      y: 0,
      height: bodySize * lineHeight,
      isBold: false,
      fontSize: bodySize,
      color: bodyColor,
    });
  }

  // WCAG criteria if present
  if (wcagCriteria && wcagCriteria.length > 0) {
    lines.push({
      text: '',
      y: 0,
      height: 8,
      isBold: false,
      fontSize: bodySize,
      color: bodyColor,
    });

    lines.push({
      text: `WCAG: ${wcagCriteria.join(', ')}`,
      y: 0,
      height: smallSize * lineHeight,
      isBold: false,
      fontSize: smallSize,
      color: wcagColor,
    });
  }

  // Calculate total height
  let totalHeight = 0;
  for (const line of lines) {
    totalHeight += line.height;
  }

  return { lines, totalHeight };
}
