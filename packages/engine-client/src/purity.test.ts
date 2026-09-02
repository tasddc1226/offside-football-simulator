import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN = [`from 'node:`, 'window.', 'document.', 'indexedDB', 'localStorage'];

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(entryPath);
    }
  }
  return files;
}

describe('순수성 스캔', () => {
  it('src/**(테스트 제외)에 node:/window/document/indexedDB/localStorage가 없다', () => {
    const srcDir = path.join(import.meta.dirname, '.');
    const files = listSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const offenders: Array<{ file: string; needle: string }> = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const needle of FORBIDDEN) {
        if (content.includes(needle)) {
          offenders.push({ file: path.relative(srcDir, file), needle });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
