// Only run in a disposable checkout. Keep current JS features, but retain the
// native dependencies and advertising adapter embedded in the reviewed 1.1.2.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const source = 'ae10f12f33768bdccd0162e8ee6b2de863e005b0';
export const runtimes = {
  ios: '02c18f49a582cc94e7d525584c498d6ef3c3d9d6',
  android: '94ee25f1d3bd329506e67b84049119fa61d64746',
};
export function assertRuntime(platform, actual) {
  if (!runtimes[platform] || actual !== runtimes[platform]) {
    throw new Error(`1.1.2 ${platform}: native fingerprint mismatch; do not publish (${actual})`);
  }
}
/** pnpm-lock.yaml `importers:` 절의 워크스페이스 경로. */
export function lockImporters(lock) {
  const section = /^importers:\n([\s\S]*?)(?=^\S)/m.exec(lock)?.[1] ?? '';
  return [...section.matchAll(/^  ([^\s:][^:]*):$/gm)].map((m) => m[1]).filter((p) => p !== '.');
}
/**
 * 1.1.2 뒤에 생긴 워크스페이스 패키지(예: T-11-277 apps/agents). 옛 lockfile에 없어 frozen 설치가 깨지므로 지운다.
 * 앱이 쓸 수 있는 packages/* 가 새로 생겼으면 지우지 않고 멈춘다(앱 코드가 그 패키지를 쓰면 묶음이 깨진다).
 */
export function addedWorkspaces(currentLock, reviewedLock) {
  const reviewed = new Set(lockImporters(reviewedLock));
  const added = lockImporters(currentLock).filter((p) => !reviewed.has(p));
  const shared = added.filter((p) => !/^(apps|tooling)\//.test(p) || p === 'apps/mobile');
  if (shared.length)
    throw new Error(`1.1.2: new shared workspace packages need review: ${shared.join(', ')}`);
  return added;
}
export function prepare(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  if (git('status', '--porcelain', '--untracked-files=normal').trim()) {
    throw new Error('Use a clean disposable checkout; existing work must be preserved.');
  }
  for (const platform of ['ios', 'android']) {
    if (existsSync(resolve(root, 'apps/mobile', platform))) {
      throw new Error('Generated native project exists; use a fresh disposable checkout.');
    }
  }
  const files = [
    'apps/mobile/app.json',
    // #651 added Android build properties and a config plugin here; both change the native fingerprint.
    'apps/mobile/app.config.js',
    'apps/mobile/package.json',
    // pnpm frozen installation also checks this excluded server workspace's manifest.
    // This disposable mobile overlay is never used to deploy the API.
    'apps/api/package.json',
    'pnpm-lock.yaml',
    // The frozen reviewed lock must use its reviewed resolution settings too.
    'pnpm-workspace.yaml',
    'apps/mobile/src/components/AdSlot.tsx',
    'apps/mobile/src/platform/rewarded.ts',
    'apps/mobile/src/platform/rewarded.test.mjs',
    'apps/mobile/src/platform/adConsent.ts',
  ];
  // Read everything first: a missing historical object must not leave a partial overlay.
  const contents = files.map((file) => git('show', `${source}:${file}`));
  const added = addedWorkspaces(
    readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8'),
    contents[files.indexOf('pnpm-lock.yaml')],
  );
  // The 1.1.2 store builds were made before OFFSIDE_FIREBASE_ANDROID_FILE existed on EAS. Server
  // variables override the process environment, so the reviewed config must stop reading it here.
  const config = files.indexOf('apps/mobile/app.config.js');
  const androidFile = 'const androidFile = process.env.OFFSIDE_FIREBASE_ANDROID_FILE;';
  if (!contents[config].includes(androidFile))
    throw new Error('1.1.2 app.config.js changed shape.');
  contents[config] = contents[config].replace(androidFile, 'const androidFile = undefined;');
  // T-11-558 화면이 보상 버튼을 그릴 때 부르는 미리 불러오기. 1.1.2의 rewarded.ts는 누른 뒤에 불러오므로 아무것도 하지 않는다.
  const rewarded = files.indexOf('apps/mobile/src/platform/rewarded.ts');
  if (contents[rewarded].includes('prepareReward'))
    throw new Error('1.1.2 rewarded.ts changed shape.');
  contents[rewarded] +=
    '\n/** T-11-558 1.1.2 호환: 미리 불러오기 없음. */\nexport function prepareReward(_placement: string) {}\n';
  files.forEach((file, i) => {
    const target = resolve(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents[i]);
  });
  for (const file of [
    'apps/mobile/src/platform/ads.ts',
    'apps/mobile/plugins/with-applovin-max.js',
    'apps/mobile/plugins/skadnetwork-ids.json',
    'apps/mobile/plugins/withAndroidOptimization.js',
  ])
    rmSync(resolve(root, file), { force: true });
  for (const dir of added) rmSync(resolve(root, dir), { recursive: true, force: true });
  console.log(
    `Prepared 1.1.2 AdMob compatibility overlay from ${source}` +
      (added.length ? ` (removed workspaces added later: ${added.join(', ')})` : ''),
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'check') assertRuntime(process.argv[3], process.argv[4]);
  else if (process.argv[2] === 'prepare') prepare(process.cwd());
  else throw new Error('Usage: prepare-ota-112.mjs prepare | check <platform> <fingerprint>');
}
