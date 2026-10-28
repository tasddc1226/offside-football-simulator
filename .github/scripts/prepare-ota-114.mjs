// T-11-516 Only run in a disposable checkout. 1.1.5 only raised the app version (no native change), so the 1.1.4 store
// builds keep receiving current JS once app.json is restored to the reviewed 1.1.4 shape.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeLaterNative } from './prepare-ota-115.mjs';

/** Last main commit that changed app.json while it matched both 1.1.4 store builds. */
export const source = '0371410e2bdcf3398440d5590c19d05c96002959';
export const runtimes = {
  ios: 'a021d56e856d876b2fa7669de03cefefd274939b', // 1.1.4(18), build 6e13a542-e8fe-41f9-b4e8-00885926d71f
  android: '10d1210456e33bebbb0e7f90198a811ff21b59a0', // 1.1.4(22), build 785dc63b-19a2-446b-ae95-34dda089f737
};
export function assertRuntime(platform, actual) {
  if (!runtimes[platform] || actual !== runtimes[platform]) {
    throw new Error(`1.1.4 ${platform}: native fingerprint mismatch; do not publish (${actual})`);
  }
}
export const restored = ['apps/mobile/app.json'];
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
  // T-11-563 1.1.6에서 더한 네이티브(Meta 앱 이벤트)는 1.1.4 빌드에 없다.
  removeLaterNative(root);
  console.log(`Prepared 1.1.4 app config overlay from ${source.slice(0, 7)}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'check') assertRuntime(process.argv[3], process.argv[4]);
  else if (process.argv[2] === 'prepare') prepare(process.cwd());
  else throw new Error('Usage: prepare-ota-114.mjs prepare | check <platform> <fingerprint>');
}
