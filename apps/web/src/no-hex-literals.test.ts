import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.');

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (/\.(tsx|css)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('컴포넌트 CSS에 hex 직접 사용 금지', () => {
  it('apps/web/src의 .tsx·.css에 hex 리터럴이 없다', () => {
    const offenders = collectFiles(srcDir)
      .filter((file) => HEX_PATTERN.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(srcDir, file));

    expect(offenders).toEqual([]);
  });
});
