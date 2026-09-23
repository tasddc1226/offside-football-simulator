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
  it('reports a violation when web depends on an unlisted @offside package', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-violation-'));

    writePackage(workDir, 'apps', 'web', {
      name: '@offside/web',
      dependencies: {
        '@offside/does-not-exist': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([
      { package: '@offside/web', dependency: '@offside/does-not-exist' },
    ]);
  });

  it('reports no violations for an allowed dependency direction', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-valid-'));

    writePackage(workDir, 'apps', 'api', {
      name: '@offside/api',
      dependencies: {
        '@offside/contracts': 'workspace:*',
      },
    });
    writePackage(workDir, 'apps', 'web', {
      name: '@offside/web',
      dependencies: {
        '@offside/contracts': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([]);
  });

  it('allows the shared tooling packages as devDependencies anywhere', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-tooling-'));

    writePackage(workDir, 'apps', 'web', {
      name: '@offside/web',
      devDependencies: {
        '@offside/tsconfig': 'workspace:*',
        '@offside/eslint-config': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([]);
  });

  it('reports a violation for an unknown @offside dependency', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-unknown-'));

    writePackage(workDir, 'apps', 'api', {
      name: '@offside/api',
      dependencies: {
        '@offside/contracts': 'workspace:*',
        '@offside/does-not-exist': 'workspace:*',
      },
    });

    const violations = findDependencyViolations(workDir);

    expect(violations).toEqual([
      { package: '@offside/api', dependency: '@offside/does-not-exist' },
    ]);
  });
});
