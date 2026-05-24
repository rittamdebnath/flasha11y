import { readFile, mkdir } from 'node:fs/promises';

export async function readFileBuffer(path: string): Promise<Buffer> {
  return readFile(path);
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}
