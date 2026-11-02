import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ALLOWED_DEPENDENCIES, findDependencyViolations } from './check-deps.mjs';

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
  it('keeps existing workspace permissions and adds only admin -> contracts', () => {
    expect(ALLOWED_DEPENDENCIES).toEqual({
      '@offside/admin': ['@offside/contracts'],
      '@offside/web': ['@offside/contracts', '@offside/game', '@offside/app-core'],
      '@offside/mobile': ['@offside/contracts', '@offside/game', '@offside/app-core'],
      '@offside/api': ['@offside/contracts'],
      '@offside/agents': [],
      '@offside/app-core': ['@offside/contracts', '@offside/game'],
      '@offside/game': ['@offside/contracts'],
      '@offside/contracts': [],
    });
  });

  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    it(`checks admin's ${field} without permitting other workspaces`, () => {
      workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-admin-'));
      writePackage(workDir, 'apps', 'admin', {
        name: '@offside/admin',
        [field]: { '@offside/contracts': 'workspace:*', '@offside/api': 'workspace:*' },
      });
      expect(findDependencyViolations(workDir)).toEqual([
        { package: '@offside/admin', dependency: '@offside/api' },
      ]);
    });
  }

  for (const dir of ['apps', 'packages']) {
    it(`requires an explicit policy for unregistered @offside packages in ${dir}`, () => {
      workDir = mkdtempSync(path.join(tmpdir(), 'check-deps-new-'));
      writePackage(workDir, dir, 'new', { name: '@offside/new' });
      expect(findDependencyViolations(workDir)).toEqual([
        {
          package: '@offside/new',
          dependency: '<workspace>',
          reason: 'unregistered workspace: add an explicit dependency policy',
        },
      ]);
    });
  }

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
