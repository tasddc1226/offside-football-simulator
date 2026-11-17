// Only run in a disposable checkout. Older store builds keep receiving current JS through this overlay:
// - T-11-698 1.1.8 added expo-tracking-transparency (iOS ATT). The 1.1.7 lane removes the dependency; the JS treats a
//   missing module as "tracking not allowed".
// - T-11-738 1.1.10 adds expo-audio (result sounds). Every lane whose store build is older than 1.1.10, current included,
//   removes it; the JS plays no sound when the module is missing. Add each new npm native module to NATIVE_ADDED.
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
  // T-11-751 Android 1.1.10 became current on 2026-11-17. 1.1.9 was public on Android only (iOS 1.1.9 was withdrawn from review and iOS goes 1.1.8 -> 1.1.10),
  // so this lane has no iOS runtime and the workflow excludes 1.1.9 / ios.
  '1.1.9': {
    source: '59fb22277f64b5150235e56a187224b1fcef368c',
    runtimes: {
      android: '84aa755bbc152b4088e0a0e4017b4c009552ad70', // 1.1.9 Android build 30 (T-11-734)
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
/** npm native modules by the store version that first shipped them. Lanes for older store builds remove them. */
export const NATIVE_ADDED = Object.freeze({
  '1.1.8': ['expo-tracking-transparency'],
  '1.1.10': ['expo-audio'],
});
/** pnpm patches (pnpm-workspace.yaml patchedDependencies) by the store version that first shipped them. Patched native
 * code is part of the fingerprint, so lanes for older store builds install the package unpatched. */
export const NATIVE_PATCHED = Object.freeze({
  // T-11-750 Android ANR: skip unmounted views in synchronouslyUpdateUIProps (Reanimated 4.7 backport).
  '1.1.11': ['react-native-reanimated@4.5.1'],
});
export const WORKSPACE_YAML = 'pnpm-workspace.yaml';
const ver = (v) => v.split('.').map(Number);
const older = (a, b) => {
  const [x, y] = [ver(a), ver(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return false;
};
/** npm native modules the store build for this lane lacks. */
export function droppedModules(name, platform) {
  const version = name === 'current' ? STORE_BUILDS[platform]?.version : name;
  if (!version) throw new Error(`Unknown store platform: ${platform}`);
  return Object.entries(NATIVE_ADDED)
    .filter(([since]) => older(version, since))
    .flatMap(([, deps]) => deps);
}

/** pnpm patches the store build for this lane lacks. */
export function droppedPatches(name, platform) {
  const version = name === 'current' ? STORE_BUILDS[platform]?.version : name;
  if (!version) throw new Error(`Unknown store platform: ${platform}`);
  return Object.entries(NATIVE_PATCHED)
    .filter(([since]) => older(version, since))
    .flatMap(([, deps]) => deps);
}
/** Remove patchedDependencies entries (and the key when it empties) from pnpm-workspace.yaml text. */
export function withoutPatches(yaml, deps) {
  if (!deps.length) return yaml;
  const lines = yaml.split('\n');
  const start = lines.indexOf('patchedDependencies:');
  let end = start + 1;
  while (start >= 0 && end < lines.length && /^\s+\S/.test(lines[end])) end++;
  const entries = lines.slice(start + 1, end);
  const keyOf = (l) =>
    l
      .trim()
      .split(':')[0]
      .replace(/^['"]|['"]$/g, '');
  const missing = deps.filter((d) => !entries.some((l) => keyOf(l) === d));
  if (start < 0 || missing.length)
    throw new Error(`pnpm patch missing: ${missing.join(', ') || deps.join(', ')}`);
  const kept = entries.filter((l) => !deps.includes(keyOf(l)));
  const block = kept.length ? ['patchedDependencies:', ...kept] : [];
  return [...lines.slice(0, start), ...block, ...lines.slice(end)].join('\n');
}

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
  const dropped = droppedModules(name, platform);
  for (const dep of dropped) delete pkg.dependencies?.[dep];
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  const patches = droppedPatches(name, platform);
  const yamlPath = resolve(root, WORKSPACE_YAML);
  if (patches.length)
    writeFileSync(yamlPath, withoutPatches(readFileSync(yamlPath, 'utf8'), patches));
  console.log(
    `Prepared ${name} / ${platform ?? 'both'} native snapshot from ${t.source.slice(0, 7)}; removed npm modules: ${dropped.join(', ') || 'none'}; removed pnpm patches: ${patches.join(', ') || 'none'}`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, name, platform, fp] = process.argv.slice(2);
  if (cmd === 'check') assertRuntime(name, platform, fp);
  else if (cmd === 'prepare') prepare(process.cwd(), name, platform);
  else
    throw new Error(
      'Usage: prepare-ota-legacy.mjs prepare <current|1.1.9|1.1.7> <platform> | check <current|1.1.9|1.1.7> <platform> <fingerprint>',
    );
}
