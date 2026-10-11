import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { ADMIN_SPECS, onlyAdminLocaleIndex, webE2ePlan } from './ci-web-e2e.mjs';
import { main } from './ci-affected.mjs';
import { e2eArgs } from './run-web-e2e.mjs';

const push = 'apps/web/src/ui/admin/AdminCupPush.svelte';
const index = 'packages/app-core/src/i18n/en/index.ts';
const plan = (paths, extra = {}) => webE2ePlan({ full: false, web: true, paths, ...extra });

test('push reporting across API, web, mobile and dictionaries selects one admin shard', () => {
  const p = plan([
    push,
    'apps/mobile/src/screens/settings/admin/AdminPush.tsx',
    'apps/api/src/db/repos/pushPerformance.ts',
    'apps/api/src/push/cupResult.test.ts',
    'packages/contracts/src/push-performance.ts',
    'packages/app-core/src/pushPerformance.ts',
    'packages/app-core/src/i18n/ko/cupPush.ts',
    'packages/app-core/src/i18n/ja/retention.ts',
    'apps/web/e2e/admin-retention.spec.ts',
    'docs/operations/cup-result-push.md',
    '.release-notes/x.json',
  ]);
  assert.deepEqual(p, { web_e2e_scope: 'admin', web_e2e_shards: '[1]' });
});

test('shared, unknown, configuration and mixed changes never narrow coverage', () => {
  for (const path of [
    'packages/game/src/engine.ts',
    'packages/app-core/src/api/client.ts',
    'packages/app-core/src/i18n/ko/account.ts',
    'packages/app-core/src/i18n/en/index.ts',
    'packages/contracts/src/index.ts',
    'apps/web/src/ui/admin/AdminUnknown.svelte',
    'apps/web/src/ui/Admin.svelte',
    'apps/web/src/App.svelte',
    'apps/web/src/style.css',
    'apps/web/playwright.config.ts',
    'apps/web/e2e/helpers.ts',
    'apps/web/e2e/account.spec.ts',
    'apps/api/src/routes/admin.ts',
    'apps/api/src/push/cupResult.ts',
    '.github/workflows/ci.yml',
    'pnpm-lock.yaml',
  ])
    assert.equal(plan([push, path]).web_e2e_scope, 'full', path);
  assert.equal(plan([push], { full: true }).web_e2e_scope, 'full');
  assert.equal(plan([]).web_e2e_scope, 'full');
  assert.equal(plan(['docs/test.md']).web_e2e_scope, 'full');
  assert.equal(plan([push], { web: false }).web_e2e_scope, 'none');
});

test('generated index allows only exact namespace imports and entries', () => {
  const before = 'export const en = {\n};\n';
  const after = "import { cupPush } from './cupPush';\nexport const en = {\n  cupPush,\n};\n";
  assert.ok(onlyAdminLocaleIndex(before, after));
  assert.ok(onlyAdminLocaleIndex(after, before));
  for (const changed of [
    after.replace('const en', 'const other'),
    after.replace('./cupPush', './account'),
    after.replace('  cupPush,', '  cupPush, injected(),'),
    after + 'run();\n',
  ])
    assert.equal(onlyAdminLocaleIndex(before, changed), false);
  assert.equal(plan([push, index], { safeIndexes: [index] }).web_e2e_scope, 'admin');
  assert.equal(plan([push, index]).web_e2e_scope, 'full');
});

test('real planner reads diff and index content, preserving package-level API checks', () => {
  const env = { CI_BASE_SHA: 'a'.repeat(40), CI_HEAD_SHA: 'b'.repeat(40), GITHUB_OUTPUT: 'out' };
  const exec = (cmd, args) => {
    if (cmd === 'npx')
      return JSON.stringify({
        packages: { items: ['@offside/web', '@offside/api'].map((name) => ({ name })) },
      });
    if (args[0] === 'diff') return [push, index].join('\0') + '\0';
    if (args[0] === 'show')
      return args[1].startsWith('a') ? '' : "import { cupPush } from './cupPush';\n";
    return '';
  };
  const o = main(env, exec, () => {});
  assert.equal(o.web_e2e_scope, 'admin');
  assert.equal(o.api, 'true');
  assert.equal(o.web, 'true');
  const failed = main(
    env,
    (cmd, args) => {
      if (args[0] === 'show') throw new Error('missing index');
      return exec(cmd, args);
    },
    () => {},
  );
  assert.equal(failed.web_e2e_scope, 'full');
});

test('runner selects existing admin/login/locale specs with no shell interpolation', () => {
  for (const spec of ADMIN_SPECS) assert.ok(existsSync(`apps/web/e2e/${spec}`), spec);
  assert.deepEqual(e2eArgs('admin', '1/1').slice(5, -1), ADMIN_SPECS);
  assert.deepEqual(e2eArgs('full', '2/3').slice(5), ['--shard=2/3']);
  for (const [scope, shard] of [
    ['unknown', '1/1'],
    ['admin', '2/3'],
    ['full', '4/3'],
    ['full', '2/1'],
  ])
    assert.throws(() => e2eArgs(scope, shard));
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(workflow, /web_e2e_shards: \$\{\{ steps\.affected\.outputs\.web_e2e_shards/);
  assert.match(workflow, /fromJSON\(needs\.pr-plan\.outputs\.web_e2e_shards/);
  assert.match(workflow, /node \.github\/scripts\/run-web-e2e\.mjs/);
});
