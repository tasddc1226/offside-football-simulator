import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertRuntime, prepare, runtimes } from './prepare-ota-112.mjs';

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
