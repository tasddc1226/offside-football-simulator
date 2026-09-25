import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// 공개 저장소 위생 검사: 커밋된 텍스트에 개인 메일·로컬 사용자 경로·에이전트 임시 경로가 들어가면 실패한다.
// 문서만 바뀐 PR도 반드시 돌린다(지금까지의 유출은 대부분 docs 에 있었다).
// 로그에는 file:line 과 종류만 쓰고, 찾은 값 자체는 출력하지 않는다.

const RULES = [
  { kind: 'home-path', re: /\/(?:Users|home)\/(?!runner\/)[A-Za-z0-9._-]+\//g },
  { kind: 'agent-tmp-path', re: /\/tmp\/claude-/g },
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
];

// 가짜·예약 도메인과 서비스 주소는 허용한다.
const ALLOWED_EMAIL =
  /@(?:(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net)|test|invalid|localhost)|users\.noreply\.github\.com|anthropic\.com)$/i;

// 검사하지 않는 파일: 해시만 가득한 lockfile, 규칙 예시를 일부러 담은 이 검사의 테스트.
const SKIP_FILES = new Set(['pnpm-lock.yaml', '.github/scripts/public-hygiene.test.mjs']);

// 운영자 공개 연락처(이용약관·개인정보처리방침)는 이 파일에만 둔다.
const EMAIL_ALLOWED_FILES = new Set(['apps/web/scripts/seo.mjs']);

/** 한 파일의 텍스트에서 위반을 찾는다. [{ line, kind }] */
export function findViolations(path, text) {
  const out = [];
  text.split('\n').forEach((lineText, i) => {
    for (const { kind, re } of RULES) {
      for (const [match] of lineText.matchAll(re)) {
        if (kind === 'email' && (ALLOWED_EMAIL.test(match) || EMAIL_ALLOWED_FILES.has(path)))
          continue;
        out.push({ line: i + 1, kind });
      }
    }
  });
  return out;
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  let failures = 0;
  for (const path of files) {
    if (SKIP_FILES.has(path)) continue;
    let buf;
    try {
      buf = readFileSync(path);
    } catch {
      continue; // 삭제 예정·심볼릭 링크 등
    }
    if (buf.includes(0)) continue; // 바이너리
    for (const v of findViolations(path, buf.toString('utf8'))) {
      console.error(`${path}:${v.line}: ${v.kind}`);
      failures++;
    }
  }
  if (failures) {
    console.error(
      `public-hygiene: ${failures}건 — 공개 저장소에 개인 메일·로컬 경로를 커밋하지 않는다.`,
    );
    process.exit(1);
  }
  console.log(`public-hygiene: ${files.length} files clean`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
