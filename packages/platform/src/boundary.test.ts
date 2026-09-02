import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * ADR-005: platform → engine-client는 "LocalStore 포트 타입만" 허용한다. `LocalStoreConstraintError`는
 * 포트가 정의하는 값(에러 클래스)이라 예외로 둔다 — 구현체가 계약 테스트의 `instanceof` 검사를
 * 통과하려면 이 클래스를 직접 던져야 한다. 그 밖의 런타임 값(예: `MemoryLocalStore`, `createEngineClient`)
 * import는 금지한다.
 */
const ALLOWED_VALUE_IMPORTS = new Set(['LocalStoreConstraintError']);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function findViolations(filePath: string, source: string): string[] {
  const violations: string[] = [];
  const importRegex = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]@offside\/engine-client['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source)) !== null) {
    const isWholeImportType = match[1] !== undefined;
    if (isWholeImportType) continue;

    const bindings = (match[2] ?? '')
      .split(',')
      .map((binding) => binding.trim())
      .filter((binding) => binding.length > 0);

    for (const binding of bindings) {
      if (binding.startsWith('type ')) continue;
      const name = (binding.split(' as ')[0] ?? '').trim();
      if (ALLOWED_VALUE_IMPORTS.has(name)) continue;
      violations.push(`${filePath}: '${binding}'는 @offside/engine-client에서 런타임 import할 수 없다.`);
    }
  }
  return violations;
}

describe('packages/platform 경계(ADR-005)', () => {
  it('@offside/engine-client는 LocalStore 포트 타입과 LocalStoreConstraintError만 런타임으로 쓴다', () => {
    const srcDir = path.dirname(fileURLToPath(import.meta.url));
    const files = collectSourceFiles(srcDir);
    const violations = files.flatMap((file) => findViolations(file, readFileSync(file, 'utf8')));
    expect(violations).toEqual([]);
  });
});
