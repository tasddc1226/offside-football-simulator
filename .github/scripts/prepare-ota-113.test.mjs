import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertRuntime, prepare, removed, restored, runtimes, source } from './prepare-ota-113.mjs';
import { STORE_RUNTIMES } from './ota-store-runtime.mjs';

test('only the reviewed 1.1.3 store runtimes can receive the 1.1.3 bundle', () => {
  for (const [platform, runtime] of Object.entries(runtimes)) {
    assert.doesNotThrow(() => assertRuntime(platform, runtime));
    assert.throws(() => assertRuntime(platform, 'different-native-build'), /mismatch/);
    assert.throws(
      () => assertRuntime(platform, runtimes[platform === 'ios' ? 'android' : 'ios']),
      /mismatch/,
    );
    // 1.1.4(current)와 1.1.3 경로가 같은 런타임에 두 번 게시하지 않는다.
    assert.notEqual(runtime, STORE_RUNTIMES[platform]);
  }
  assert.throws(() => assertRuntime('web', undefined), /mismatch/);
});

test('preparation protects dirty work and existing native test environments', () => {
  const root = mkdtempSync(join(tmpdir(), 'ota113-protect-'));
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

test('the overlay restores the reviewed app config and drops the mediation plugin', (t) => {
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  // PR 검사는 얕은 체크아웃이라 기준 커밋이 없다. 운영 배포 OTA 잡은 fetch-depth: 0으로 받는다.
  try {
    execFileSync('git', ['-C', repo, 'cat-file', '-e', `${source}^{commit}`], { stdio: 'ignore' });
  } catch {
    return t.skip('reviewed 1.1.3 commit is not in this shallow checkout');
  }
  const root = mkdtempSync(join(tmpdir(), 'ota113-'));
  try {
    execFileSync('git', ['clone', '-q', '--no-checkout', '--shared', repo, root]);
    execFileSync('git', ['-C', root, 'checkout', '-q', 'HEAD']);
    for (const file of removed) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), 'later native change\n');
    }
    execFileSync('git', ['-C', root, 'add', '-A']);
    execFileSync('git', [
      '-C',
      root,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '-qm',
      't',
    ]);
    prepare(root);
    for (const file of restored)
      assert.equal(
        readFileSync(join(root, file), 'utf8'),
        execFileSync('git', ['-C', repo, 'show', `${source}:${file}`], { encoding: 'utf8' }),
      );
    for (const file of removed) assert.equal(existsSync(join(root, file)), false);
    assert.equal(JSON.parse(readFileSync(join(root, restored[0]), 'utf8')).expo.version, '1.1.3');
    assert.doesNotMatch(readFileSync(join(root, restored[1]), 'utf8'), /withAdMediation/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the deploy workflow publishes current, 1.1.4, 1.1.3 and 1.1.2 with their own runtime checks', () => {
  const workflow = readFileSync(
    new URL('../workflows/deploy-production.yml', import.meta.url),
    'utf8',
  );
  const job = workflow.split('  app-update:')[1].split('  release-tag:')[0];
  assert.match(job, /target: \[current, '1\.1\.5', '1\.1\.4', '1\.1\.3', '1\.1\.2'\]/);
  assert.match(
    job,
    /matrix\.target == '1\.1\.3'\s*\n\s*run: node \.github\/scripts\/prepare-ota-113\.mjs prepare/,
  );
  assert.match(job, /prepare-ota-113\.mjs check "\$PLATFORM" "\$FP"/);
  // 1.1.3 overlay가 바뀌면 같은 커밋이라도 다시 게시해야 하므로 변경 판정에 넣는다.
  assert.match(job, /git diff --quiet[^;]*prepare-ota-113\.mjs[^;]*deploy-production\.yml; then/);
});
