// T-11-453 Only run in a disposable checkout. 1.1.4 added AdMob mediation adapters (native only, plugins/withAdMediation.js);
// the JS is the same, so the 1.1.3 store builds keep receiving current JS once the app config is restored to the
// reviewed 1.1.3 shape (no mediation plugin, version 1.1.3).
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Last main commit whose native fingerprint matched both 1.1.3 store builds (production deploy 2026-10-22). */
export const source = '9cac4fb9252513e8d1393c87ef4976c8186c1f6b';
export const runtimes = {
  ios: '5493303a029b8c9943bb72166e91ffb14a5f1a6b', // 1.1.3(17), build 05b6cd35-42f5-4ec6-9232-ce7a0cc92a9c
  android: 'bdab3b94672d81e85bba4b2a98ca7a8b825d8a66', // 1.1.3(21), build e67af8ac-804e-4ed8-baa9-00ff75e7ab54
};
export function assertRuntime(platform, actual) {
  if (!runtimes[platform] || actual !== runtimes[platform]) {
    throw new Error(`1.1.3 ${platform}: native fingerprint mismatch; do not publish (${actual})`);
  }
}
export const restored = ['apps/mobile/app.json', 'apps/mobile/app.config.js'];
export const removed = [
  'apps/mobile/plugins/withAdMediation.js',
  'apps/mobile/plugins/skadnetwork-ids.json',
];
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
  // Read everything first: a missing historical object must not leave a partial overlay.
  const contents = restored.map((file) => git('show', `${source}:${file}`));
  restored.forEach((file, i) => writeFileSync(resolve(root, file), contents[i]));
  for (const file of removed) rmSync(resolve(root, file), { force: true });
  console.log(
    `Prepared 1.1.3 app config overlay from ${source.slice(0, 7)} (no mediation adapters)`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'check') assertRuntime(process.argv[3], process.argv[4]);
  else if (process.argv[2] === 'prepare') prepare(process.cwd());
  else throw new Error('Usage: prepare-ota-113.mjs prepare | check <platform> <fingerprint>');
}
