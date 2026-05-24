import sharp from 'sharp';
import type { ImageMimeType } from '../analysis/prompt-builder.js';

const MAX_LONG_EDGE = 1568;

export function getMimeType(extension: string): ImageMimeType {
  switch (extension) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    default: return 'image/png';
  }
}

export async function imageToBase64(filePath: string): Promise<{ data: string; mediaType: ImageMimeType }> {
  let image = sharp(filePath);
  const metadata = await image.metadata();

  // Downsample if image is larger than max long edge
  const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  if (longestEdge > MAX_LONG_EDGE) {
    const ratio = MAX_LONG_EDGE / longestEdge;
    const newWidth = Math.round((metadata.width ?? MAX_LONG_EDGE) * ratio);
    const newHeight = Math.round((metadata.height ?? MAX_LONG_EDGE) * ratio);
    image = image.resize(newWidth, newHeight, { fit: 'inside' });
  }

  // Convert to PNG for consistent handling
  const buffer = await image.png().toBuffer();
  return {
    data: buffer.toString('base64'),
    mediaType: 'image/png',
  };
}

export async function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const metadata = await sharp(filePath).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}
