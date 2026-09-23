#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ADR-005 의존 방향 표. 표와 같은 순서로 적는다.
 * @type {Record<string, string[]>}
 */
export const ALLOWED_DEPENDENCIES = {
  // T-9-001a: @offside/api는 이제 프로필·Google 로그인만 다룬다 — @offside/domain·@offside/content
  // 의존이 없다. @offside/web은 아직 별도 작업(T-9-001b)이 진행 중이라 옛 표를 그대로 둔다(그 작업이
  // 끝나면 이 표도 함께 정리되어야 한다).
  '@offside/web': [
    '@offside/platform',
    '@offside/engine-client',
    '@offside/ui',
    '@offside/contracts',
    '@offside/domain',
    '@offside/content',
  ],
  '@offside/api': ['@offside/contracts'],
  '@offside/platform': ['@offside/engine-client', '@offside/contracts'],
  '@offside/engine-client': ['@offside/domain', '@offside/contracts', '@offside/content'],
  '@offside/ui': ['@offside/contracts'],
  '@offside/domain': [],
  '@offside/content': ['@offside/domain'],
  '@offside/contracts': [],
};

const WORKSPACE_DIRS = ['apps', 'packages'];

/**
 * ADR-005 표 밖의 공용 개발 도구 패키지. 모든 워크스페이스가 devDependency로 쓸 수 있다.
 * @type {Set<string>}
 */
const TOOLING_PACKAGES = new Set(['@offside/tsconfig', '@offside/eslint-config']);

/**
 * 테스트 전용 패키지(ADR-005 표 밖). 어떤 워크스페이스든 devDependencies로는 허용하고,
 * dependencies로 선언하면(런타임 번들에 섞여 들어갈 수 있으므로) 위반이다.
 * @type {Set<string>}
 */
const TEST_ONLY_PACKAGES = new Set(['@offside/fixtures']);

/**
 * @param {string} pkgName
 * @param {Record<string, string> | undefined} deps
 * @param {Set<string>} allowed
 * @param {'dependencies' | 'devDependencies'} field
 * @returns {{ package: string; dependency: string; reason?: string }[]}
 */
function checkDeps(pkgName, deps, allowed, field) {
  const violations = [];
  for (const dependencyName of Object.keys(deps ?? {})) {
    if (!dependencyName.startsWith('@offside/') || TOOLING_PACKAGES.has(dependencyName)) continue;

    if (TEST_ONLY_PACKAGES.has(dependencyName)) {
      if (field === 'dependencies') {
        violations.push({
          package: pkgName,
          dependency: dependencyName,
          reason: '테스트 전용 패키지는 devDependencies에서만 허용된다.',
        });
      }
      continue;
    }

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

      violations.push(...checkDeps(pkg.name, pkg.dependencies, allowed, 'dependencies'));
      violations.push(...checkDeps(pkg.name, pkg.devDependencies, allowed, 'devDependencies'));
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
