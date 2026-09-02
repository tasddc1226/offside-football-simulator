import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findDependencyViolations } from './check-deps.mjs';

let workDir;

function writePackage(repoRoot, workspaceDir, pkgDir, pkgJson) {
  const dir = path.join(repoRoot, workspaceDir, pkgDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2));
}

afterEach(() => {
  if (workDir) {
    rmSync(workDir, { recursive: true, force: true });
    workDir = undefined;
  }
});

describe('findDependencyViolations', () => {
  it('reports a violation when ui depends on domain', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-violation-'));

    writePackage(workDir, 'packages', 'ui', {
      name: '@offside/ui',
      dependencies: {
        '@offside/domain': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([{ package: '@offside/ui', dependency: '@offside/domain' }]);
  });

  it('reports no violations for an allowed dependency direction', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-valid-'));

    writePackage(workDir, 'packages', 'ui', {
      name: '@offside/ui',
      dependencies: {
        '@offside/contracts': 'workspace:*',
      },
    });
    writePackage(workDir, 'packages', 'contracts', {
      name: '@offside/contracts',
      dependencies: {
        '@offside/domain': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([]);
  });
});
