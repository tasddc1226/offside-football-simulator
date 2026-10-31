// Only run in a disposable checkout. Older store builds keep receiving current JS through this overlay:
// - T-11-516 1.1.5 only raised the app version (no native change), so 1.1.4 builds get app.json in its reviewed 1.1.4 shape.
// - T-11-600 1.1.6 added @shopify/react-native-skia (native) for the lounge field. 1.1.5 and 1.1.4 builds do not have it,
//   so the overlay removes the dependency (native fingerprint back to the reviewed build) and replaces the lounge field
//   entry with null (the bundle never resolves Skia; the chat screen shows the chat list only).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Last main commit that changed app.json while it matched each reviewed store build. */
export const targets = Object.freeze({
  '1.1.5': {
    source: 'd5ec2d516dfbdb93037b965bab4d9a60ea2cfe3f',
    runtimes: {
      ios: 'ca480d51e4d9afdae6f87685cc601133c9d16f1b', // 1.1.5(19), build f86ccd94-410a-4882-91c3-00773b9683b9
      android: '3fa1453aa50c2866ba47ba7dd040975153bf686a', // 1.1.5(23), build 06f70f81-3fa9-4c21-980e-7d46a6e064fb
    },
  },
  '1.1.4': {
    source: '0371410e2bdcf3398440d5590c19d05c96002959',
    runtimes: {
      ios: 'a021d56e856d876b2fa7669de03cefefd274939b', // 1.1.4(18), build 6e13a542-e8fe-41f9-b4e8-00885926d71f
      android: '10d1210456e33bebbb0e7f90198a811ff21b59a0', // 1.1.4(22), build 785dc63b-19a2-446b-ae95-34dda089f737
    },
  },
});
export const APP_JSON = 'apps/mobile/app.json';
export const MOBILE_PACKAGE = 'apps/mobile/package.json';
export const FIELD_ENTRY = 'apps/mobile/src/screens/chat/lounge/index.ts';
/** Native modules the older builds do not contain. */
export const NATIVE_ONLY_IN_NEW = ['@shopify/react-native-skia'];
export const FIELD_STUB =
  '// T-11-600 prepare-ota-legacy.mjs: this store build has no Skia, so the lounge shows the chat list only.\n' +
  'export const LoungeField = null;\n';

function target(name) {
  const t = targets[name];
  if (!t) throw new Error(`Unknown legacy OTA target: ${name}`);
  return t;
}
export function assertRuntime(name, platform, actual) {
  const t = target(name);
  if (!t.runtimes[platform] || actual !== t.runtimes[platform]) {
    throw new Error(`${name} ${platform}: native fingerprint mismatch; do not publish (${actual})`);
  }
}
export function prepare(root, name) {
  const t = target(name);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  if (git('status', '--porcelain', '--untracked-files=normal').trim()) {
    throw new Error('Use a clean disposable checkout; existing work must be preserved.');
  }
  for (const platform of ['ios', 'android']) {
    if (existsSync(resolve(root, 'apps/mobile', platform))) {
      throw new Error('Generated native project exists; use a fresh disposable checkout.');
    }
  }
  const appJson = git('show', `${t.source}:${APP_JSON}`);
  const pkgPath = resolve(root, MOBILE_PACKAGE);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const dep of NATIVE_ONLY_IN_NEW) delete pkg.dependencies?.[dep];
  writeFileSync(resolve(root, APP_JSON), appJson);
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(resolve(root, FIELD_ENTRY), FIELD_STUB);
  console.log(`Prepared ${name} overlay (app.json from ${t.source.slice(0, 7)}, without ${NATIVE_ONLY_IN_NEW})`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, name, platform, fp] = process.argv.slice(2);
  if (cmd === 'check') assertRuntime(name, platform, fp);
  else if (cmd === 'prepare') prepare(process.cwd(), name);
  else
    throw new Error(
      'Usage: prepare-ota-legacy.mjs prepare <1.1.5|1.1.4> | check <1.1.5|1.1.4> <platform> <fingerprint>',
    );
}
