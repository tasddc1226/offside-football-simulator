import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '.');

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path.relative(SRC_DIR, fullPath) === 'test') continue;
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Workers 런타임(nodejs_compat 없음)에는 없는 Node 전용 API·모듈 시스템 사용을 막는다. */
const FORBIDDEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: `from 'node:`, pattern: /from 'node:/ },
  { name: 'Buffer', pattern: /\bBuffer\b/ },
  { name: 'process.', pattern: /\bprocess\./ },
  { name: 'require(', pattern: /\brequire\(/ },
  { name: '__dirname', pattern: /__dirname/ },
];

describe('Workers runtime purity', () => {
  it.each(FORBIDDEN_PATTERNS)('has no `$name` usage outside tests and src/test', ({ pattern }) => {
    const offenders = collectSourceFiles(SRC_DIR)
      .filter((file) => pattern.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_DIR, file));

    expect(offenders).toEqual([]);
  });
});
