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
    writePackage(workDir, 'apps', 'api', {
      name: '@offside/api',
      dependencies: {
        '@offside/contracts': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([]);
  });

  it('allows a test-only package as a devDependency', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-test-only-dev-'));

    writePackage(workDir, 'packages', 'engine-client', {
      name: '@offside/engine-client',
      dependencies: {
        '@offside/domain': 'workspace:*',
        '@offside/contracts': 'workspace:*',
        '@offside/content': 'workspace:*',
      },
      devDependencies: {
        '@offside/fixtures': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([]);
  });

  it('reports a violation when a test-only package is a runtime dependency', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-test-only-runtime-'));

    writePackage(workDir, 'packages', 'engine-client', {
      name: '@offside/engine-client',
      dependencies: {
        '@offside/domain': 'workspace:*',
        '@offside/contracts': 'workspace:*',
        '@offside/content': 'workspace:*',
        '@offside/fixtures': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([
      {
        package: '@offside/engine-client',
        dependency: '@offside/fixtures',
        reason: '테스트 전용 패키지는 devDependencies에서만 허용된다.',
      },
    ]);
  });
});
