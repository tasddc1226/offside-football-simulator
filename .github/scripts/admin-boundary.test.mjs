import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ESLint } from 'eslint';
import { findDependencyViolations } from '../../tooling/scripts/check-deps.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root, overrideConfigFile: path.join(root, 'eslint.config.js') });

function workspace(name, dependencies = {}, field = 'dependencies', workspaceDir = 'apps') {
  const dir = mkdtempSync(path.join(tmpdir(), 'offside-admin-boundary-'));
  const pkgDir = path.join(dir, workspaceDir, 'fixture');
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name, [field]: dependencies }));
  try {
    return findDependencyViolations(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const field of [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]) {
  test(`admin manifest checks ${field} without widening workspace access`, () => {
    assert.deepEqual(
      workspace('@offside/admin', { '@offside/contracts': 'workspace:*' }, field),
      [],
    );
    for (const dependency of ['@offside/api', '@offside/game', '@offside/not-registered']) {
      assert.deepEqual(workspace('@offside/admin', { [dependency]: 'workspace:*' }, field), [
        { package: '@offside/admin', dependency },
      ]);
    }
  });
}

test('all current apps/packages workspaces satisfy an explicit dependency policy', () => {
  assert.deepEqual(findDependencyViolations(root), []);
});

for (const workspaceDir of ['apps', 'packages']) {
  test(`an unregistered @offside workspace in ${workspaceDir} is rejected without dependencies`, () => {
    const violations = workspace('@offside/new-client', {}, 'dependencies', workspaceDir);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].package, '@offside/new-client');
    assert.match(violations[0].reason, /unregistered workspace/);
    assert.deepEqual(workspace('external-fixture', {}, 'dependencies', workspaceDir), []);
  });
}

// lintText uses real tracked paths and the repository config/parsers;
// fixtures never write into product source directories or disable type-aware rules.
for (const extension of ['ts', 'svelte']) {
  const filePath = path.join(
    root,
    `apps/admin/src/${extension === 'ts' ? 'main.ts' : 'App.svelte'}`,
  );
  const source = (statement) =>
    extension === 'ts'
      ? statement
      : `<script ${statement.startsWith('export ') ? 'module ' : ''}lang="ts">\n${statement}\n</script>`;

  test(`admin ${extension}: contracts imports pass real ESLint`, async () => {
    const [result] = await eslint.lintText(
      source("import '@offside/contracts'; import '@offside/contracts/admin-items';"),
      { filePath },
    );
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
    assert.equal(result.warningCount, 0, JSON.stringify(result.messages));
  });

  test(`admin ${extension}: local API-named folders remain client imports`, async () => {
    for (const statement of [
      "import './api/client.js';",
      "void import('./api/client.js');",
      "const loaders = { api: () => import('./api/client.js') }; export { loaders };",
      "void import('@offside/contracts');",
      'void import(`@offside/contracts/admin-items`);',
      "void import('../../api/../admin/src/api.js');",
    ]) {
      const [result] = await eslint.lintText(source(statement), { filePath });
      assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
    }
  });

  for (const statement of [
    "import '@offside/api';",
    "import '@offside/api/env';",
    "import '../../api/src/env.js';",
    "import '../../api';",
    "import '../../admin/../api/src/env.js';",
    "import '../../api/src/env.js?raw';",
    "export * from '@offside/api';",
    "export { getDb } from '../../api/src/env.js';",
    "void import('@offside/api');",
    "void import('@offside/api/env');",
    "void import('../../api/src/env.js');",
    "void import('../../api');",
    'void import(`@offside/api`);',
    'void import(`../../api/src/env.js`);',
    "void import('../../api/src/env.js?raw');",
    "type Server = import('@offside/api').Bindings; export type { Server };",
    "require('@offside/api');",
    "const target = '@offside/api'; void import(target);",
    "void import('@offside/' + 'api');",
    'const name = "env"; void import(`../../api/src/${name}.js`);',
  ]) {
    test(`admin ${extension}: blocks ${statement}`, async () => {
      const [result] = await eslint.lintText(source(statement), { filePath });
      assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
      assert.ok(
        result.messages.some(
          (m) =>
            m.ruleId === 'no-restricted-imports' || m.ruleId === 'boundaries/no-server-imports',
        ),
        JSON.stringify(result.messages),
      );
    });
  }
}
