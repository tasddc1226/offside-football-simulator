// T-11-563 Only run in a disposable checkout. 1.1.6 added the Meta app events module (native only, Android:
// modules/meta-app-events + plugins/withMetaAppEvents.js); the JS no-ops without it, so the 1.1.5 store builds keep
// receiving current JS once app.json is restored to the reviewed 1.1.5 shape and the new native pieces are removed.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Last main commit whose native fingerprint matched both 1.1.5 store builds (production deploy 2026-10-28). */
export const source = '7be6b3c75532c8bec71a4bdebc53f38846076044';
export const runtimes = {
  ios: 'ca480d51e4d9afdae6f87685cc601133c9d16f1b', // 1.1.5(19), build f86ccd94-410a-4882-91c3-00773b9683b9
  android: '3fa1453aa50c2866ba47ba7dd040975153bf686a', // 1.1.5(23), build 06f70f81-3fa9-4c21-980e-7d46a6e064fb
};
export function assertRuntime(platform, actual) {
  if (!runtimes[platform] || actual !== runtimes[platform]) {
    throw new Error(`1.1.5 ${platform}: native fingerprint mismatch; do not publish (${actual})`);
  }
}
export const restored = ['apps/mobile/app.json'];
/** Native pieces added after 1.1.5. Older lanes (1.1.2~1.1.4) remove them too. */
export const removed = ['apps/mobile/plugins/withMetaAppEvents.js', 'apps/mobile/modules'];
export function removeLaterNative(root) {
  for (const path of removed) rmSync(resolve(root, path), { recursive: true, force: true });
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
  const contents = restored.map((file) => git('show', `${source}:${file}`));
  restored.forEach((file, i) => writeFileSync(resolve(root, file), contents[i]));
  removeLaterNative(root);
  console.log(`Prepared 1.1.5 app config overlay from ${source.slice(0, 7)} (no Meta app events)`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'check') assertRuntime(process.argv[3], process.argv[4]);
  else if (process.argv[2] === 'prepare') prepare(process.cwd());
  else throw new Error('Usage: prepare-ota-115.mjs prepare | check <platform> <fingerprint>');
}
