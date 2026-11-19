import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  APP_JSON,
  MOBILE_PACKAGE,
  NATIVE_PATHS,
  WORKSPACE_YAML,
  droppedModules,
  droppedPatches,
  withoutPatches,
  assertRuntime,
  prepare,
  targets,
} from './prepare-ota-legacy.mjs';
import { STORE_BUILDS, STORE_RUNTIMES } from './ota-store-runtime.mjs';

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
  // T-11-719 최소 앱 버전(1.1.7)보다 낮은 앱에는 OTA를 내보내지 않는다.
  for (const old of ['1.1.6', '1.1.5', '1.1.4'])
    assert.throws(() => assertRuntime(old, 'ios', 'x'), /Unknown/);
});

test('preparation protects dirty work and existing native test environments', () => {
  const root = mkdtempSync(join(tmpdir(), 'ota-legacy-protect-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    const keep = join(root, 'work.txt');
    writeFileSync(keep, 'keep my work');
    assert.throws(() => prepare(root, '1.1.7'), /clean disposable/);
    assert.equal(readFileSync(keep, 'utf8'), 'keep my work');
    rmSync(keep);
    mkdirSync(join(root, 'apps/mobile/android'), { recursive: true });
    assert.throws(() => prepare(root, '1.1.7'), /native project exists/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('each lane drops exactly the npm native modules its store build lacks', () => {
  assert.deepEqual(droppedModules('1.1.7', 'ios'), ['expo-tracking-transparency', 'expo-audio']);
  // T-11-738 1.1.10 전 스토어 빌드는 expo-audio가 없다(T-11-751부터 두 플랫폼 current가 1.1.10 이상).
  for (const platform of Object.keys(STORE_BUILDS))
    assert.deepEqual(droppedModules('current', platform), []);
  // T-11-759 Android 1.1.10 경로: expo-audio가 있다.
  assert.deepEqual(droppedModules('1.1.10', 'android'), []);
  assert.deepEqual(droppedModules('1.1.10', 'ios'), []);
  assert.deepEqual(droppedModules('1.1.9', 'ios'), ['expo-audio']);
  // T-11-751 iOS 1.1.8 경로: ATT 모듈은 있고 expo-audio는 없다.
  assert.deepEqual(droppedModules('1.1.8', 'ios'), ['expo-audio']);
  assert.throws(() => droppedModules('current', 'web'), /Unknown/);
});

test('lanes for store builds before 1.1.11 install Reanimated without the ANR patch', () => {
  // T-11-750 패치는 1.1.11 스토어 빌드부터 실린다. T-11-759부터 Android current는 1.1.11(패치 있음), iOS current는 1.1.10(패치 없음).
  assert.deepEqual(droppedPatches('current', 'android'), []);
  assert.deepEqual(droppedPatches('current', 'ios'), ['react-native-reanimated@4.5.1']);
  assert.deepEqual(droppedPatches('1.1.10', 'android'), ['react-native-reanimated@4.5.1']);
  assert.deepEqual(droppedPatches('1.1.7', 'ios'), ['react-native-reanimated@4.5.1']);
  assert.deepEqual(droppedPatches('1.1.11', 'android'), []);
  const yaml =
    'a: 1\npatchedDependencies:\n  react-native-reanimated@4.5.1: patches/r.patch\n  x@1.0.0: patches/x.patch\nb: 2\n';
  assert.equal(
    withoutPatches(yaml, ['react-native-reanimated@4.5.1']),
    'a: 1\npatchedDependencies:\n  x@1.0.0: patches/x.patch\nb: 2\n',
  );
  assert.equal(withoutPatches('a: 1\npatchedDependencies:\n  x@1.0.0: p\n', ['x@1.0.0']), 'a: 1\n');
  assert.equal(withoutPatches(yaml, []), yaml);
  assert.throws(() => withoutPatches('a: 1\n', ['x@1.0.0']), /missing/);
  // 실제 워크스페이스 파일에 패치가 있어야 overlay가 뺄 수 있다.
  const real = readFileSync(new URL(`../../${WORKSPACE_YAML}`, import.meta.url), 'utf8');
  assert.doesNotMatch(withoutPatches(real, ['react-native-reanimated@4.5.1']), /reanimated/);
});

const lanes = [
  ...Object.entries(targets).map(([name, value]) => ({ name, ...value })),
  ...Object.entries(STORE_BUILDS).map(([platform, value]) => ({
    name: 'current',
    platform,
    ...value,
  })),
];
for (const { name, source, platform, version } of lanes) {
  test(`the ${name} ${platform ?? 'both'} overlay restores native inputs while keeping current JavaScript`, (t) => {
    const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    // PR 검사는 얕은 체크아웃이라 기준 커밋이 없다. 운영 배포 OTA 잡은 fetch-depth: 0으로 받는다.
    try {
      execFileSync('git', ['-C', repo, 'cat-file', '-e', `${source}^{commit}`], {
        stdio: 'ignore',
      });
    } catch {
      return t.skip(`reviewed ${name} commit is not in this shallow checkout`);
    }
    const root = mkdtempSync(join(tmpdir(), 'ota-legacy-'));
    try {
      execFileSync('git', ['clone', '-q', '--no-checkout', '--shared', repo, root]);
      execFileSync('git', ['-C', root, 'checkout', '-q', 'HEAD']);
      const before = JSON.parse(readFileSync(join(root, MOBILE_PACKAGE), 'utf8'));
      const jsPath = 'apps/mobile/src/platform/gameCenter.ts';
      const jsBefore = existsSync(join(root, jsPath))
        ? readFileSync(join(root, jsPath), 'utf8')
        : null;
      prepare(root, name, platform);
      assert.equal(
        execFileSync('git', ['-C', root, 'diff', source, '--', ...NATIVE_PATHS], {
          encoding: 'utf8',
        }),
        '',
      );
      assert.equal(
        existsSync(join(root, jsPath)) ? readFileSync(join(root, jsPath), 'utf8') : null,
        jsBefore,
      );
      assert.equal(
        readFileSync(join(root, APP_JSON), 'utf8'),
        execFileSync('git', ['-C', repo, 'show', `${source}:${APP_JSON}`], { encoding: 'utf8' }),
      );
      assert.equal(
        JSON.parse(readFileSync(join(root, APP_JSON), 'utf8')).expo.version,
        version ?? name,
      );
      const after = JSON.parse(readFileSync(join(root, MOBILE_PACKAGE), 'utf8'));
      // Keep the existing Meta specialty module; drop only npm modules the store build lacks.
      assert.ok(existsSync(join(root, 'apps/mobile/modules/meta-app-events')));
      const dropped = droppedModules(name, platform);
      for (const dep of dropped) assert.equal(after.dependencies[dep], undefined);
      for (const dep of dropped) delete before.dependencies[dep];
      assert.deepEqual(after, before);
      const yaml = readFileSync(join(root, WORKSPACE_YAML), 'utf8');
      for (const dep of droppedPatches(name, platform)) assert.ok(!yaml.includes(`${dep}:`));
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
  // 경로 목록과 matrix가 같다. 런타임이 없는 플랫폼(예: Android에만 공개된 1.1.9의 iOS)은 matrix에서 뺀다.
  // 버전 숫자 순서(새 버전 먼저). 문자열 정렬은 '1.1.10'을 '1.1.7' 뒤에 둔다.
  const names = Object.keys(targets).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  );
  assert.match(job, new RegExp(`target: \\[current, ${names.map((n) => `'${n}'`).join(', ')}\\]`));
  for (const [name, { runtimes }] of Object.entries(targets))
    for (const platform of ['ios', 'android']) {
      const excluded = new RegExp(`- target: '${name}'\\s*\\n\\s*platform: ${platform}`).test(job);
      assert.equal(excluded, !runtimes[platform], `${name} ${platform} matrix exclusion`);
    }
  assert.doesNotMatch(job, /prepare-ota-11[2-4]/);
  assert.match(
    job,
    /if: env\.EXPO_TOKEN != ''\s*\n\s*run: node \.github\/scripts\/prepare-ota-legacy\.mjs prepare "\$OTA_TARGET" "\$PLATFORM"/,
  );
  assert.match(job, /prepare-ota-legacy\.mjs check "\$OTA_TARGET" "\$PLATFORM" "\$FP"/);
  // overlay가 바뀌면 같은 커밋이라도 다시 게시해야 하므로 변경 판정에 넣는다.
  assert.match(
    job,
    /git diff --quiet[^;]*prepare-ota-legacy\.mjs[^;]*deploy-production\.yml; then/,
  );
});
