import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  addedWorkspaces,
  assertRuntime,
  lockImporters,
  prepare,
  runtimes,
  source,
} from './prepare-ota-112.mjs';

test('only the reviewed store runtimes can receive the 1.1.2 bundle', () => {
  for (const [platform, runtime] of Object.entries(runtimes)) {
    assert.doesNotThrow(() => assertRuntime(platform, runtime));
    assert.throws(() => assertRuntime(platform, 'different-native-build'), /mismatch/);
    assert.throws(
      () => assertRuntime(platform, runtimes[platform === 'ios' ? 'android' : 'ios']),
      /mismatch/,
    );
  }
  assert.throws(() => assertRuntime('web', undefined), /mismatch/);
});

test('preparation protects dirty work and existing native test environments', () => {
  const root = mkdtempSync(join(tmpdir(), 'ota-protect-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    const keep = join(root, 'work.txt');
    writeFileSync(keep, 'keep my work');
    assert.throws(() => prepare(root), /clean disposable/);
    assert.equal(readFileSync(keep, 'utf8'), 'keep my work');
    rmSync(keep);
    mkdirSync(join(root, 'apps/mobile/ios'), { recursive: true });
    assert.throws(() => prepare(root), /native project exists/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('workspaces added after 1.1.2 are dropped, new shared packages stop the overlay', () => {
  const lock = (...paths) =>
    `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies: {}\n${paths
      .map((p) => `\n  ${p}:\n    dependencies:\n      zod:\n        specifier: ^4\n`)
      .join('')}\npackages:\n\n  zod@4.0.0: {}\n`;
  const reviewed = lock('apps/api', 'apps/mobile', 'packages/game');
  assert.deepEqual(lockImporters(reviewed), ['apps/api', 'apps/mobile', 'packages/game']);
  assert.deepEqual(
    addedWorkspaces(lock('apps/agents', 'apps/api', 'apps/mobile', 'packages/game'), reviewed),
    ['apps/agents'],
  );
  assert.deepEqual(addedWorkspaces(reviewed, reviewed), []);
  assert.throws(
    () =>
      addedWorkspaces(
        lock('apps/api', 'apps/mobile', 'packages/game', 'packages/new-ui'),
        reviewed,
      ),
    /packages\/new-ui/,
  );
});

test('the reviewed 1.1.2 lockfile lists the workspaces the overlay expects', () => {
  const reviewed = execFileSync('git', ['show', `${source}:pnpm-lock.yaml`], { encoding: 'utf8' });
  assert.ok(lockImporters(reviewed).includes('apps/mobile'));
  assert.deepEqual(addedWorkspaces(readFileSync('pnpm-lock.yaml', 'utf8'), reviewed), [
    'apps/agents',
  ]);
});
