#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ADR-005 의존 방향 표. 표와 같은 순서로 적는다.
 * @type {Record<string, string[]>}
 */
export const ALLOWED_DEPENDENCIES = {
  // T-9-001c: T-9-001a/b가 @offside/domain·content·engine-client·fixtures·ui·platform을 모두
  // 삭제했다. 남은 워크스페이스는 web(클라이언트 전용, localStorage 저장)·api(프로필/Google 로그인)·
  // contracts뿐이다.
  '@offside/web': [],
  '@offside/api': ['@offside/contracts'],
  '@offside/contracts': [],
};

const WORKSPACE_DIRS = ['apps', 'packages'];

/**
 * ADR-005 표 밖의 공용 개발 도구 패키지. 모든 워크스페이스가 devDependency로 쓸 수 있다.
 * @type {Set<string>}
 */
const TOOLING_PACKAGES = new Set(['@offside/tsconfig', '@offside/eslint-config']);

/**
 * @param {string} pkgName
 * @param {Record<string, string> | undefined} deps
 * @param {Set<string>} allowed
 * @returns {{ package: string; dependency: string; reason?: string }[]}
 */
function checkDeps(pkgName, deps, allowed) {
  const violations = [];
  for (const dependencyName of Object.keys(deps ?? {})) {
    if (!dependencyName.startsWith('@offside/') || TOOLING_PACKAGES.has(dependencyName)) continue;

    if (!allowed.has(dependencyName)) {
      violations.push({ package: pkgName, dependency: dependencyName });
    }
  }
  return violations;
}

/**
 * @param {string} repoRoot
 * @returns {{ package: string; dependency: string; reason?: string }[]}
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

      violations.push(...checkDeps(pkg.name, pkg.dependencies, allowed));
      violations.push(...checkDeps(pkg.name, pkg.devDependencies, allowed));
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
      const suffix = violation.reason ? ` (${violation.reason})` : '';
      console.error(`  ${violation.package} -> ${violation.dependency}${suffix}`);
    }
    process.exit(1);
  }

  console.log('lint:deps OK');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
