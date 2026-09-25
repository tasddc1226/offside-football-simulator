import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// 운영 배포마다 붙이는 릴리즈 태그: KST 날짜 + 그날의 배포 순번 (v2026.09.25.1, v2026.09.25.2 …).
const TAG_PATTERN = /^v(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;

/** KST(UTC+9) 기준 날짜를 YYYY.MM.DD 로. */
export function kstDate(now) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}.${pad(kst.getUTCMonth() + 1)}.${pad(kst.getUTCDate())}`;
}

/**
 * 기존 릴리즈 태그 목록([{ name, sha }])으로 이번 배포의 태그를 정한다.
 * 같은 커밋에 이미 릴리즈 태그가 있으면(같은 SHA 재배포) { tag, existing: true } 를 돌려준다.
 * previous 는 가장 최근 릴리즈 태그(릴리즈 노트 시작점)다.
 */
export function planReleaseTag(tags, sha, now) {
  if (!SHA_PATTERN.test(sha)) throw new Error('sha must be a 40-character commit SHA');
  const ours = tags
    .map((t) => ({ ...t, m: TAG_PATTERN.exec(t.name) }))
    .filter((t) => t.m)
    .sort((a, b) => {
      for (let i = 1; i <= 4; i++) if (+a.m[i] !== +b.m[i]) return +a.m[i] - +b.m[i];
      return 0;
    });
  const same = ours.find((t) => t.sha === sha);
  if (same) return { tag: same.name, existing: true, previous: null };
  const day = kstDate(now);
  const seq = ours.filter((t) => t.name.startsWith(`v${day}.`)).length + 1;
  return { tag: `v${day}.${seq}`, existing: false, previous: ours.at(-1)?.name ?? null };
}

// CLI: stdin 으로 `gh api repos/<repo>/git/matching-refs/tags/v` 응답(JSON)을 받아
// GITHUB_OUTPUT 형식(tag=…, existing=…, previous=…)을 stdout 에 쓴다.
async function main() {
  const sha = process.argv[2] ?? '';
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const refs = JSON.parse(raw);
  const tags = refs.map((r) => ({ name: r.ref.replace(/^refs\/tags\//, ''), sha: r.object.sha }));
  const plan = planReleaseTag(tags, sha, new Date());
  process.stdout.write(
    `tag=${plan.tag}\nexisting=${plan.existing}\nprevious=${plan.previous ?? ''}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
