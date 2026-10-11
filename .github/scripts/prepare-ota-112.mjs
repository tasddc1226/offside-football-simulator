// Only run in a disposable checkout. Keep current JS features, but retain the
// native dependencies and advertising adapter embedded in the reviewed 1.1.2.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
    'apps/mobile/package.json',
    'pnpm-lock.yaml',
    'apps/mobile/src/components/AdSlot.tsx',
    'apps/mobile/src/platform/rewarded.ts',
    'apps/mobile/src/platform/rewarded.test.mjs',
    'apps/mobile/src/platform/adConsent.ts',
  ];
  // Read everything first: a missing historical object must not leave a partial overlay.
  const contents = files.map((file) => git('show', `${source}:${file}`));
  files.forEach((file, i) => {
    const target = resolve(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents[i]);
  });
  for (const file of [
    'apps/mobile/src/platform/ads.ts',
    'apps/mobile/plugins/with-applovin-max.js',
    'apps/mobile/plugins/skadnetwork-ids.json',
  ])
    rmSync(resolve(root, file), { force: true });
  console.log(`Prepared 1.1.2 AdMob compatibility overlay from ${source}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'check') assertRuntime(process.argv[3], process.argv[4]);
  else if (process.argv[2] === 'prepare') prepare(process.cwd());
  else throw new Error('Usage: prepare-ota-112.mjs prepare | check <platform> <fingerprint>');
}
