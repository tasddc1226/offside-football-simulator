// T-11-824 앱 네이티브 지문 검사(PR). 운영 배포 OTA는 네이티브 지문(fingerprint)이 스토어 빌드와 같아야 나간다.
// 지금까지는 운영 배포 때에야 알았다:
// - 11-04 app.json plugins 주석 한 줄이 지문을 바꿔 그날 OTA가 모든 경로에서 실패했다.
// - 11-17 새 npm 네이티브 모듈(expo-audio)이 옛 스토어 빌드 경로에서 빠지지 않아 그 빌드가 켜지자마자 멈췄다.
// 머지 전에 다음을 본다.
// 1. (오류) apps/mobile/package.json에 새로 더한 네이티브 모듈이 prepare-ota-legacy.mjs의 NATIVE_ADDED에 없다.
// 2. (오류) pnpm-workspace.yaml patchedDependencies에 새로 더한 네이티브 패키지 패치가 NATIVE_PATCHED에 없다.
// 3. (오류, 라벨로 허용) 지문에 들어가는 네이티브 설정(NATIVE_PATHS · .fingerprintignore)을 바꿨다. 다음 스토어 빌드와 함께
//    내는 의도한 변경이면 PR에 `native-change` 라벨을 붙이고 다시 돌린다(라벨은 실행할 때 API로 읽어 재실행에도 반영된다).
import { execFileSync } from 'node:child_process';
import { appendFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readChangedPaths } from './ci-scope.mjs';
import {
  MOBILE_PACKAGE,
  NATIVE_ADDED,
  NATIVE_PATCHED,
  NATIVE_PATHS,
  WORKSPACE_YAML,
} from './prepare-ota-legacy.mjs';

export const LABEL = 'native-change';
export const FINGERPRINT_PATHS = [...NATIVE_PATHS, 'apps/mobile/.fingerprintignore'];

const under = (path, base) => path === base || path.startsWith(`${base}/`);

/** 지문에 들어가는 네이티브 설정 파일 중 바뀐 것. */
export function nativeConfigChanges(paths) {
  return paths.filter((p) => FINGERPRINT_PATHS.some((b) => under(p, b)));
}

/** 두 package.json 텍스트 사이에 새로 더한 dependencies 이름. */
export function addedDependencies(beforeText, afterText) {
  const deps = (t) => Object.keys((t ? JSON.parse(t) : {}).dependencies ?? {});
  const before = new Set(deps(beforeText));
  return deps(afterText).filter((d) => !before.has(d));
}

/** pnpm-workspace.yaml의 patchedDependencies 키(이름@버전). */
export function patchKeys(yaml) {
  const lines = (yaml ?? '').split('\n');
  const start = lines.indexOf('patchedDependencies:');
  if (start < 0) return [];
  const keys = [];
  for (let i = start + 1; i < lines.length && /^\s+\S/.test(lines[i]); i++)
    keys.push(
      lines[i]
        .trim()
        .split(/:\s/)[0]
        .replace(/^['"]|['"]:?$/g, ''),
    );
  return keys;
}

/** node_modules에 설치된 패키지에 iOS · Android 네이티브 코드가 있는지(Expo 모듈 설정 · podspec · ios/apple/android 폴더). */
export function isNativePackage(name, root = process.cwd(), list = readdirSync) {
  const dirs = [
    resolve(root, 'apps/mobile/node_modules', name),
    resolve(root, 'node_modules', name),
  ];
  return dirs.some((d) => {
    let entries;
    try {
      entries = list(d);
    } catch {
      return false;
    }
    return entries.some(
      (e) =>
        e === 'expo-module.config.json' ||
        e === 'ios' ||
        e === 'apple' ||
        e === 'android' ||
        e.endsWith('.podspec'),
    );
  });
}

export function judgeNative({ configChanges, addedNative, addedPatches, labeled }) {
  const listed = new Set(Object.values(NATIVE_ADDED).flat());
  const patched = new Set(Object.values(NATIVE_PATCHED).flat());
  const errors = [];
  const warnings = [];
  const missing = addedNative.filter((d) => !listed.has(d));
  if (missing.length)
    errors.push(
      `새 네이티브 모듈 ${missing.join(', ')}이 .github/scripts/prepare-ota-legacy.mjs NATIVE_ADDED에 없어요. ` +
        '처음 실릴 스토어 버전으로 적어야 옛 스토어 빌드 경로(current 포함)가 이 모듈을 빼고 OTA를 받아요. ' +
        '앱 JS는 모듈이 없을 때 그 기능을 꺼야 해요(동적 import는 async try 안에서).',
    );
  const unpatched = addedPatches.filter((p) => !patched.has(p));
  if (unpatched.length)
    errors.push(
      `새 네이티브 패치 ${unpatched.join(', ')}가 NATIVE_PATCHED에 없어요. 패치도 지문에 들어가요. 처음 실릴 스토어 버전으로 적어 주세요.`,
    );
  if (configChanges.length) {
    const msg =
      `네이티브 지문에 들어가는 설정을 바꿨어요: ${configChanges.join(', ')}. ` +
      '머지하면 새 스토어 빌드가 나올 때까지 운영 배포의 OTA(current)가 실패해요. 주석 한 줄도 지문을 바꿔요(11-04).';
    if (labeled) warnings.push(`${msg} \`${LABEL}\` 라벨이 있어 통과시켜요.`);
    else
      errors.push(
        `${msg} 다음 스토어 빌드와 함께 내는 의도한 변경이면 PR에 \`${LABEL}\` 라벨을 붙이고 이 검사를 다시 돌려 주세요.`,
      );
  }
  return { errors, warnings };
}

const show = (exec, sha, path) => {
  try {
    return exec('git', ['show', `${sha}:${path}`], { encoding: 'utf8' });
  } catch {
    return '';
  }
};

async function prLabels(env, fetcher) {
  if (!env.PR_NUMBER || !env.GITHUB_REPOSITORY) return [];
  const r = await fetcher(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues/${env.PR_NUMBER}/labels?per_page=100`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(env.GH_TOKEN ? { Authorization: `Bearer ${env.GH_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!r.ok) throw new Error(`Label lookup failed (HTTP ${r.status})`);
  return (await r.json()).map((l) => l.name);
}

export async function main(env = process.env, exec = execFileSync, fetcher = fetch, log = console) {
  const base = env.CI_BASE_SHA;
  const head = env.CI_HEAD_SHA;
  const paths = readChangedPaths(base, head, exec);
  const configChanges = nativeConfigChanges(paths);
  const addedNative = paths.includes(MOBILE_PACKAGE)
    ? addedDependencies(show(exec, base, MOBILE_PACKAGE), show(exec, head, MOBILE_PACKAGE)).filter(
        (d) => isNativePackage(d),
      )
    : [];
  const addedPatches = paths.includes(WORKSPACE_YAML)
    ? patchKeys(show(exec, head, WORKSPACE_YAML)).filter(
        (k) =>
          !patchKeys(show(exec, base, WORKSPACE_YAML)).includes(k) &&
          isNativePackage(k.replace(/@[^@]+$/, '')),
      )
    : [];
  const labeled = configChanges.length ? (await prLabels(env, fetcher)).includes(LABEL) : false;
  const { errors, warnings } = judgeNative({ configChanges, addedNative, addedPatches, labeled });
  for (const w of warnings) log.warn(`::warning::${w}`);
  for (const e of errors) log.error(`::error::${e}`);
  if (env.GITHUB_STEP_SUMMARY && (errors.length || warnings.length))
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `## Native fingerprint guard\n\n${[...errors, ...warnings].join('\n\n')}\n`,
    );
  if (!errors.length) log.log('Native fingerprint guard passed.');
  return errors.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
