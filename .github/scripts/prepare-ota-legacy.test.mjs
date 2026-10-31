import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  APP_JSON,
  FIELD_ENTRY,
  FIELD_STUB,
  MOBILE_PACKAGE,
  NATIVE_ONLY_IN_NEW,
  assertRuntime,
  prepare,
  targets,
} from './prepare-ota-legacy.mjs';
import { STORE_RUNTIMES } from './ota-store-runtime.mjs';

test('only the reviewed legacy store runtimes can receive their bundle', () => {
  const seen = new Set(Object.values(STORE_RUNTIMES));
  for (const [name, { runtimes }] of Object.entries(targets)) {
    for (const [platform, runtime] of Object.entries(runtimes)) {
      assert.doesNotThrow(() => assertRuntime(name, platform, runtime));
      assert.throws(() => assertRuntime(name, platform, 'different-native-build'), /mismatch/);
      // 같은 런타임에 두 경로가 두 번 게시하지 않는다.
      assert.ok(!seen.has(runtime), `${name} ${platform} runtime is used twice`);
      seen.add(runtime);
    }
    assert.throws(() => assertRuntime(name, 'web', undefined), /mismatch/);
  }
  assert.throws(() => assertRuntime('1.1.3', 'ios', 'x'), /Unknown/);
});

test('preparation protects dirty work and existing native test environments', () => {
  const root = mkdtempSync(join(tmpdir(), 'ota-legacy-protect-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    const keep = join(root, 'work.txt');
    writeFileSync(keep, 'keep my work');
    assert.throws(() => prepare(root, '1.1.5'), /clean disposable/);
    assert.equal(readFileSync(keep, 'utf8'), 'keep my work');
    rmSync(keep);
    mkdirSync(join(root, 'apps/mobile/android'), { recursive: true });
    assert.throws(() => prepare(root, '1.1.5'), /native project exists/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const [name, { source }] of Object.entries(targets)) {
  test(`the ${name} overlay restores the reviewed app config and drops the new native modules`, (t) => {
    const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    // PR 검사는 얕은 체크아웃이라 기준 커밋이 없다. 운영 배포 OTA 잡은 fetch-depth: 0으로 받는다.
    try {
      execFileSync('git', ['-C', repo, 'cat-file', '-e', `${source}^{commit}`], { stdio: 'ignore' });
    } catch {
      return t.skip(`reviewed ${name} commit is not in this shallow checkout`);
    }
    const root = mkdtempSync(join(tmpdir(), 'ota-legacy-'));
    try {
      execFileSync('git', ['clone', '-q', '--no-checkout', '--shared', repo, root]);
      execFileSync('git', ['-C', root, 'checkout', '-q', 'HEAD']);
      const before = JSON.parse(readFileSync(join(root, MOBILE_PACKAGE), 'utf8'));
      prepare(root, name);
      assert.equal(
        readFileSync(join(root, APP_JSON), 'utf8'),
        execFileSync('git', ['-C', repo, 'show', `${source}:${APP_JSON}`], { encoding: 'utf8' }),
      );
      assert.equal(JSON.parse(readFileSync(join(root, APP_JSON), 'utf8')).expo.version, name);
      const after = JSON.parse(readFileSync(join(root, MOBILE_PACKAGE), 'utf8'));
      for (const dep of NATIVE_ONLY_IN_NEW) assert.equal(after.dependencies[dep], undefined);
      // 옛 빌드에 없는 모듈만 빼고 나머지 의존성은 그대로다.
      for (const dep of NATIVE_ONLY_IN_NEW) delete before.dependencies[dep];
      assert.deepEqual(after, before);
      assert.equal(readFileSync(join(root, FIELD_ENTRY), 'utf8'), FIELD_STUB);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('the deploy workflow publishes each legacy lane with its own runtime check', () => {
  const workflow = readFileSync(
    new URL('../workflows/deploy-production.yml', import.meta.url),
    'utf8',
  );
  const job = workflow.split('  app-update:')[1].split('  release-tag:')[0];
  assert.match(job, /target: \[current, '1\.1\.5', '1\.1\.4'\]/);
  assert.doesNotMatch(job, /prepare-ota-11[2-4]/);
  assert.match(
    job,
    /matrix\.target != 'current'\s*\n\s*run: node \.github\/scripts\/prepare-ota-legacy\.mjs prepare "\$OTA_TARGET"/,
  );
  assert.match(job, /prepare-ota-legacy\.mjs check "\$OTA_TARGET" "\$PLATFORM" "\$FP"/);
  // overlay가 바뀌면 같은 커밋이라도 다시 게시해야 하므로 변경 판정에 넣는다.
  assert.match(job, /git diff --quiet[^;]*prepare-ota-legacy\.mjs[^;]*deploy-production\.yml; then/);
});
