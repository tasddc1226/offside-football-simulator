#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ADR-005 의존 방향 표. 표와 같은 순서로 적는다.
 * @type {Record<string, string[]>}
 */
export const ALLOWED_DEPENDENCIES = {
  '@offside/web': [
    '@offside/platform',
    '@offside/engine-client',
    '@offside/ui',
    '@offside/contracts',
    '@offside/domain',
    '@offside/content',
  ],
  '@offside/api': ['@offside/domain', '@offside/contracts', '@offside/content'],
  '@offside/platform': ['@offside/engine-client', '@offside/contracts'],
  '@offside/engine-client': ['@offside/domain', '@offside/contracts', '@offside/content'],
  '@offside/ui': ['@offside/contracts'],
  '@offside/domain': [],
  '@offside/content': ['@offside/domain'],
  '@offside/contracts': ['@offside/domain'],
  '@offside/fixtures': ['@offside/domain', '@offside/content'],
};

const WORKSPACE_DIRS = ['apps', 'packages'];

/**
 * ADR-005 표 밖의 공용 개발 도구 패키지. 모든 워크스페이스가 devDependency로 쓸 수 있다.
 * @type {Set<string>}
 */
const TOOLING_PACKAGES = new Set(['@offside/tsconfig', '@offside/eslint-config']);

/**
 * @param {string} repoRoot
 * @returns {{ package: string; dependency: string }[]}
 */
export function findDependencyViolations(repoRoot) {
  const violations = [];

  for (const workspaceDir of WORKSPACE_DIRS) {
    const dirPath = path.join(repoRoot, workspaceDir);
    let entries;
    try {
      entries = readdirSync(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgJsonPath = path.join(dirPath, entry.name, 'package.json');

      let pkg;
      try {
        pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      } catch {
        continue;
      }

      if (!pkg.name || !(pkg.name in ALLOWED_DEPENDENCIES)) continue;

      const allowed = new Set(ALLOWED_DEPENDENCIES[pkg.name]);
      const declaredDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const dependencyName of Object.keys(declaredDeps)) {
        if (
          dependencyName.startsWith('@offside/') &&
          !TOOLING_PACKAGES.has(dependencyName) &&
          !allowed.has(dependencyName)
        ) {
          violations.push({ package: pkg.name, dependency: dependencyName });
        }
      }
    }
  }

  return violations;
}

function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..', '..');
  const violations = findDependencyViolations(repoRoot);

  if (violations.length > 0) {
    console.error('ADR-005 의존 방향 위반:');
    for (const violation of violations) {
      console.error(`  ${violation.package} -> ${violation.dependency}`);
    }
    process.exit(1);
  }

  console.log('lint:deps OK');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
