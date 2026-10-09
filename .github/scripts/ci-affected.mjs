// T-11-176 PR에서 바뀐 패키지만 검사한다. 패키지 밖 코드(루트 설정 · CI · 스크립트 · 잠금 파일)가 바뀌었거나 판정에
// 실패하면 전부 검사한다(fail-closed). 패키지끼리의 의존은 turbo가 따라간다(`turbo ls --affected`, 바뀐 패키지와 그
// 패키지를 쓰는 쪽). ci-scope.mjs가 코드 변경이 있다고 본 PR에서만 돈다.
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { isAllowedDocument, readChangedPaths } from './ci-scope.mjs';

const WORKSPACE_ROOTS = ['apps', 'packages', 'tooling'];
const API = '@offside/api';

/** package.json이 있는 워크스페이스 디렉터리(`apps/web` 등). tooling/scripts는 CI · 저장소 전체가 쓰는 스크립트
 * 묶음이라 패키지로 치지 않는다(바뀌면 전부 검사). */
export function packageDirs() {
  return WORKSPACE_ROOTS.flatMap((dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'package.json')))
      .map((d) => `${dir}/${d.name}`),
  ).filter((d) => d !== 'tooling/scripts');
}

/** 패키지 밖에서 코드로 볼 변경이 있으면 true(문서 · 릴리즈 노트는 뺀다). */
export function needsFull(paths, dirs) {
  return paths.some(
    (p) =>
      !isAllowedDocument(p) &&
      !p.startsWith('.release-notes/') &&
      !dirs.some((d) => p.startsWith(`${d}/`)),
  );
}

/** 검사할 패키지 이름들로 GITHUB_OUTPUT 줄을 만든다. full이면 모든 패키지. */
export function outputs(full, names) {
  const has = (n) => full || names.includes(n);
  const filters = (list) => list.map((n) => `--filter=${n}`).join(' ');
  const others = names.filter((n) => n !== API);
  return {
    full: String(full),
    any: String(full || names.length > 0),
    // turbo lint · typecheck · test 인자. full이면 필터 없이 모두(API 테스트는 따로 나눠 돈다).
    check_filter: full ? '' : filters(names),
    test_filter: full ? `--filter=!${API}` : filters(others),
    test_any: String(full || others.length > 0),
    api: String(has(API)),
    web: String(has('@offside/web')),
    mobile: String(has('@offside/mobile')),
    sim: String(has('@offside/game') || has('@offside/fulltime-sim')),
  };
}

/** 설치 없이 도는 판정 job을 위해 루트 package.json의 turbo 버전을 npx로 부른다. */
function affectedNames(env, exec) {
  const turbo = `turbo@${JSON.parse(readFileSync('package.json', 'utf8')).devDependencies.turbo}`;
  const out = exec('npx', ['--yes', turbo, 'ls', '--affected', '--output=json'], {
    encoding: 'utf8',
    env: { ...process.env, TURBO_SCM_BASE: env.CI_BASE_SHA, TURBO_SCM_HEAD: env.CI_HEAD_SHA },
  });
  return JSON.parse(out).packages.items.map((i) => i.name);
}

function detect(env, exec) {
  try {
    const paths = readChangedPaths(env.CI_BASE_SHA ?? '', env.CI_HEAD_SHA ?? '', exec);
    if (needsFull(paths, packageDirs())) return { full: true, names: [] };
    return { full: false, names: affectedNames(env, exec) };
  } catch {
    return { full: true, names: [] }; // 판정 실패는 전부 검사
  }
}

export function main(env = process.env, exec = execFileSync, append = appendFileSync) {
  if (!env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
  const { full, names } = detect(env, exec);
  const o = outputs(full, names);
  append(
    env.GITHUB_OUTPUT,
    Object.entries(o)
      .map(([k, v]) => `${k}=${v}\n`)
      .join(''),
    'utf8',
  );
  console.log(full ? 'affected: full run' : `affected: ${names.join(', ') || '(none)'}`);
  return o;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
