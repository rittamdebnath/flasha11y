import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import type { ScannedFile, DeviceCategory, ScreenType } from '../types/exports.js';

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const DEVICE_FOLDERS: Record<string, DeviceCategory> = {
  mobile: 'mobile',
  tablet: 'tablet',
  desktop: 'desktop',
};

function inferDeviceCategory(folderName: string): DeviceCategory | undefined {
  const lower = folderName.toLowerCase();
  return DEVICE_FOLDERS[lower];
}

function inferScreenType(folderName: string, _filename: string): ScreenType {
  const lower = folderName.toLowerCase();
  if (lower === 'flows') return 'flow';
  if (lower === 'states') return 'state';
  return 'screen';
}

function parseFlowInfo(filename: string): { flowName?: string; flowStep?: number } {
  const match = filename.match(/^(\d+)[-_](.+?)(?:_(empty|loading|error|success))?\.(png|jpe?g)$/i);
  if (match) {
    return {
      flowStep: parseInt(match[1], 10),
      flowName: match[2].replace(/[-_]/g, ' '),
    };
  }
  return {};
}

function parseStateVariant(filename: string): string | undefined {
  const match = filename.match(/_(empty|loading|error|success|disabled|hover|focus|active)\.(png|jpe?g)$/i);
  return match ? match[1].toLowerCase() : undefined;
}

export async function walkExports(exportsPath: string): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  async function walk(dir: string, relativePath: string, folderName: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // folder doesn't exist, skip
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(fullPath, relPath, entry.name);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

        const fileStat = await stat(fullPath);
        const deviceCategory = inferDeviceCategory(folderName);
        const screenType = inferScreenType(folderName, entry.name);
        const flowInfo = parseFlowInfo(entry.name);
        const stateVariant = parseStateVariant(entry.name);
        const screenBaseName = basename(entry.name, ext)
          .replace(/_(empty|loading|error|success|disabled|hover|focus|active)$/i, '');

        results.push({
          path: fullPath,
          filename: entry.name,
          extension: ext === '.jpeg' ? 'jpeg' : ext === '.jpg' ? 'jpg' : 'png',
          sizeBytes: fileStat.size,
          deviceCategory,
          screenType,
          flowName: flowInfo.flowName,
          flowStep: flowInfo.flowStep,
          screenBaseName,
          stateVariant,
        });
      }
    }
  }

  await walk(exportsPath, '', '');
  return results;
}
