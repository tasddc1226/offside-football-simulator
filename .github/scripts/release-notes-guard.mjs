import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readChangedPaths } from './ci-scope.mjs';

// 사용자 화면·게임 동작을 바꿀 수 있는 소스. 테스트 파일은 뺀다.
const USER_FACING_ROOTS = ['apps/web/src/', 'apps/mobile/src/', 'apps/api/src/', 'packages/'];
const TEST_FILE = /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const RELEASE_NOTE = /^\.release-notes\/[^/]+\.json$/;
const OPT_OUT_LINE = /^\s*release-notes:\s*none\s*$/im;
export const OPT_OUT_LABEL = 'no-release-note';

export function isUserFacing(path) {
  if (TEST_FILE.test(path)) return false;
  if (path.startsWith('packages/')) return /^packages\/[^/]+\/src\//.test(path);
  return USER_FACING_ROOTS.some((root) => path.startsWith(root));
}

/** PR 본문 한 줄 `release-notes: none` 또는 `no-release-note` 라벨이면 건너뛴다. */
export function optedOut(body = '', labels = []) {
  return OPT_OUT_LINE.test(body) || labels.includes(OPT_OUT_LABEL);
}

/** 사용자에게 보이는 소스가 바뀌었는데 새 릴리즈 노트가 없으면 그 경로들을 돌려준다. */
export function missingReleaseNote({ changed, added, body, labels }) {
  if (optedOut(body, labels) || added.some((path) => RELEASE_NOTE.test(path))) return [];
  return changed.filter(isUserFacing);
}

function parseLabels(raw) {
  try {
    const labels = JSON.parse(raw || '[]');
    return Array.isArray(labels) ? labels.map(String) : [];
  } catch {
    return [];
  }
}

export function main(env = process.env, exec = execFileSync) {
  const base = env.CI_BASE_SHA ?? '';
  const head = env.CI_HEAD_SHA ?? '';
  const changed = readChangedPaths(base, head, exec);
  const added = exec(
    'git',
    ['diff', '--no-renames', '--name-only', '-z', '--diff-filter=A', base, head],
    {
      encoding: 'utf8',
    },
  )
    .split('\0')
    .filter(Boolean);
  const missing = missingReleaseNote({
    changed,
    added,
    body: env.PR_BODY ?? '',
    labels: parseLabels(env.PR_LABELS),
  });
  if (missing.length === 0) {
    console.log('Release notes: OK');
    return true;
  }
  console.error(
    [
      `사용자에게 보이는 소스 ${missing.length}개가 바뀌었는데 새 .release-notes/*.json 이 없어요.`,
      ...missing.slice(0, 10).map((path) => `  - ${path}`),
      missing.length > 10 ? `  … 외 ${missing.length - 10}개` : null,
      '공지할 변경이면 .release-notes/README.md 를 따라 항목을 추가해 주세요.',
      `공지할 게 없으면 PR 본문에 "release-notes: none" 한 줄을 쓰거나 "${OPT_OUT_LABEL}" 라벨을 붙여 주세요.`,
    ]
      .filter((line) => line !== null)
      .join('\n'),
  );
  return false;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (!main()) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
