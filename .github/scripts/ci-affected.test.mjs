import assert from 'node:assert/strict';
import test from 'node:test';
import { main, needsFull, outputs, packageDirs } from './ci-affected.mjs';

const DIRS = ['apps/api', 'apps/web', 'packages/game', 'tooling/eslint-config'];

test('package dirs come from workspace folders with package.json', () => {
  const dirs = packageDirs();
  assert.ok(dirs.includes('apps/api'));
  assert.ok(dirs.includes('packages/contracts'));
  assert.ok(!dirs.includes('tooling/scripts'));
});

test('paths inside packages, docs and release notes stay narrow', () => {
  assert.equal(
    needsFull(
      ['apps/web/src/ui/Home.svelte', 'docs/tracking/board.md', '.release-notes/x.json'],
      DIRS,
    ),
    false,
  );
});

test('root config, CI, scripts and the lockfile run everything', () => {
  for (const p of [
    'pnpm-lock.yaml',
    'eslint.config.js',
    '.github/workflows/ci.yml',
    'tooling/scripts/sim-smoke.mjs',
    'turbo.json',
  ])
    assert.equal(needsFull([p], DIRS), true, p);
});

test('outputs: narrow web change skips API tests and the sim smoke', () => {
  const o = outputs(false, ['@offside/app-core', '@offside/web']);
  assert.equal(o.check_filter, '--filter=@offside/app-core --filter=@offside/web');
  assert.equal(o.test_filter, '--filter=@offside/app-core --filter=@offside/web');
  assert.equal(o.api, 'false');
  assert.equal(o.web, 'true');
  assert.equal(o.sim, 'false');
});

test('outputs: API-only change runs API shards but no other package tests', () => {
  const o = outputs(false, ['@offside/api']);
  assert.equal(o.api, 'true');
  assert.equal(o.test_any, 'false');
  assert.equal(o.web, 'false');
});

test('outputs: full run checks every package and keeps API tests in shards', () => {
  const o = outputs(true, []);
  assert.equal(o.check_filter, '');
  assert.equal(o.test_filter, '--filter=!@offside/api');
  assert.equal(o.api, 'true');
  assert.equal(o.sim, 'true');
});

test('failures fall back to a full run', () => {
  const writes = [];
  const o = main(
    { CI_BASE_SHA: 'a'.repeat(40), CI_HEAD_SHA: 'b'.repeat(40), GITHUB_OUTPUT: 'x' },
    () => {
      throw new Error('boom');
    },
    (_p, v) => writes.push(v),
  );
  assert.equal(o.full, 'true');
  assert.match(writes[0], /full=true/);
});
