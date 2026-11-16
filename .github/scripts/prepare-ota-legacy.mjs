// Only run in a disposable checkout. Older store builds keep receiving current JS through this overlay:
// - T-11-698 1.1.8 added expo-tracking-transparency (iOS ATT). The 1.1.7 lane removes the dependency; the JS treats a
//   missing module as "tracking not allowed".
// - T-11-719 1.1.6, 1.1.5 and 1.1.4 OTA ended. The minimum app version is 1.1.7 (apps/api/src/routes/appVersion.ts), so
//   those apps get a store update popup they cannot close. Their Skia and Meta app events overlays went with them.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORE_BUILDS } from './ota-store-runtime.mjs';

/** Last main commit that changed app.json while it matched each reviewed store build. */
export const targets = Object.freeze({
  '1.1.7': {
    source: '025367c0babded0844b8fff7803657897332cf4c',
    runtimes: {
      ios: '8c1db9d6e62b11915847297d65fc09b7e63573a8', // 1.1.7 iOS build 24 (T-11-563)
      android: '3b6819b34ba45425ee879e20f824f81da095fa05', // 1.1.7 Android build 27 (T-11-563)
    },
  },
});
export const APP_JSON = 'apps/mobile/app.json';
export const MOBILE_PACKAGE = 'apps/mobile/package.json';
/** Native inputs only; screen, engine and platform JavaScript stay at the deployment commit. */
export const NATIVE_PATHS = [
  APP_JSON,
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
  'apps/mobile/plugins',
  'apps/mobile/modules',
];
/** npm native modules added in 1.1.8 that every legacy lane removes. */
export const NATIVE_ADDED_118 = ['expo-tracking-transparency'];

function target(name, platform) {
  if (name === 'current') {
    const build = STORE_BUILDS[platform];
    if (!build) throw new Error(`Unknown store platform: ${platform}`);
    return { ...build, runtimes: { [platform]: build.runtime } };
  }
  const t = targets[name];
  if (!t) throw new Error(`Unknown legacy OTA target: ${name}`);
  return t;
}
export function assertRuntime(name, platform, actual) {
  const t = target(name, platform);
  if (!t.runtimes[platform] || actual !== t.runtimes[platform]) {
    throw new Error(`${name} ${platform}: native fingerprint mismatch; do not publish (${actual})`);
  }
}
export function prepare(root, name, platform) {
  const t = target(name, platform);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  if (git('status', '--porcelain', '--untracked-files=normal').trim()) {
    throw new Error('Use a clean disposable checkout; existing work must be preserved.');
  }
  for (const platform of ['ios', 'android']) {
    if (existsSync(resolve(root, 'apps/mobile', platform))) {
      throw new Error('Generated native project exists; use a fresh disposable checkout.');
    }
  }
  git('restore', '--source', t.source, '--worktree', '--', ...NATIVE_PATHS);
  const pkgPath = resolve(root, MOBILE_PACKAGE);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const dropped = name === '1.1.7' ? NATIVE_ADDED_118 : [];
  for (const dep of dropped) delete pkg.dependencies?.[dep];
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(
    `Prepared ${name} / ${platform ?? 'both'} native snapshot from ${t.source.slice(0, 7)}; removed npm modules: ${dropped.join(', ') || 'none'}`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, name, platform, fp] = process.argv.slice(2);
  if (cmd === 'check') assertRuntime(name, platform, fp);
  else if (cmd === 'prepare') prepare(process.cwd(), name, platform);
  else
    throw new Error(
      'Usage: prepare-ota-legacy.mjs prepare <current|1.1.7> <platform> | check <current|1.1.7> <platform> <fingerprint>',
    );
}
