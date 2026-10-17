import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ADR-015 3단계: agent-dev.yml publish 잡. Claude가 만든 커밋(patch)을 main 위에 얹어 브랜치를 올리고 PR을 연 뒤
// Worker에 결과를 알린다. 이 스크립트는 main에 있는 그대로 돈다(patch가 .github을 건드리면 거절한다).

const BLOCKED = [
  /^\.github\//,
  /^\.gitignore$/,
  /^\.node-version$/,
  /(^|\/)\.env/,
  /\.(pem|p8|p12|key|keystore|jks)$/,
];

/** patch(format-patch 묶음)가 바꾸는 파일 목록. */
export function patchFiles(patch) {
  const files = new Set();
  for (const m of patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)) {
    files.add(m[1]);
    files.add(m[2]);
  }
  return [...files];
}

/** 막힌 경로를 바꾸면 그 경로들을 돌려준다. */
export const blockedFiles = (files) => files.filter((f) => BLOCKED.some((re) => re.test(f)));

/** pr.md 첫 줄은 제목(`# ` 뗀다), 나머지는 본문(릴리즈 노트 줄은 Claude가 쓴다. 없으면 Release notes 검사가 잡는다). */
export function parsePrFile(text, fallbackTitle) {
  const lines = text.replace(/\r/g, '').split('\n');
  const title =
    (lines[0] ?? '')
      .replace(/^#+\s*/, '')
      .trim()
      .slice(0, 120) || fallbackTitle;
  const body = lines.slice(1).join('\n').trim();
  return { title, body };
}

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], ...opts }).trim();

async function report(payload) {
  const r = await fetch('https://agents.offside-lab.com/internal/run?job=dev-result', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AGENTS_READ_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  console.log('report', r.status);
}

async function main() {
  const { OUT, TITLE, THREAD, WORK_RESULT, RUN_URL, RUN_ID } = process.env;
  const read = (f) => (existsSync(join(OUT, f)) ? readFileSync(join(OUT, f), 'utf8') : '');
  let claude = {};
  try {
    claude = JSON.parse(read('claude.json') || '{}');
  } catch {}
  const base = {
    thread: THREAD,
    run: RUN_URL,
    cost: Number(claude.total_cost_usd ?? 0),
    turns: Number(claude.num_turns ?? 0),
    text: String(claude.result ?? '').slice(0, 2500),
  };
  const fail = (reason) => report({ ...base, ok: false, reason });
  const patch = read('change.patch');
  if (WORK_RESULT !== 'success') return fail(`작업 잡이 ${WORK_RESULT}로 끝났어요`);
  if (!patch.trim()) return fail('커밋한 변경이 없어요');
  const files = patchFiles(patch);
  const blocked = blockedFiles(files);
  if (blocked.length) return fail(`막힌 경로를 바꿔서 올리지 않았어요: ${blocked.join(', ')}`);

  sh('git', ['config', 'user.name', 'offside-dev-agent']);
  sh('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  try {
    sh('git', ['am', '--3way', join(OUT, 'change.patch')]);
  } catch {
    return fail('커밋을 main 위에 얹지 못했어요(git am 실패)');
  }
  try {
    sh('node', ['.github/scripts/public-hygiene.mjs']);
  } catch {
    return fail('공개 저장소 점검(public-hygiene)에 걸려서 올리지 않았어요');
  }
  const branch = `agent-dev/${RUN_ID}`;
  sh('git', ['push', 'origin', `HEAD:refs/heads/${branch}`]);
  const { title, body } = parsePrFile(read('pr.md'), TITLE);
  const bodyFile = join(OUT, 'body.md');
  writeFileSync(
    bodyFile,
    `${body || TITLE}\n\n---\n@dev(손흥민) 작업 · [실행 기록](${RUN_URL}) · Claude ${base.turns}턴 · $${base.cost.toFixed(2)}\n머지는 슬랙 #agent-approvals 승인 버튼으로만 해요.\n`,
  );
  let url;
  try {
    url = sh('gh', [
      'pr',
      'create',
      '--head',
      branch,
      '--base',
      'main',
      '--title',
      title,
      '--body-file',
      bodyFile,
    ]);
  } catch {
    return fail(`브랜치 ${branch}는 올렸는데 PR을 열지 못했어요`);
  }
  const pr = Number(/\/pull\/(\d+)/.exec(url)?.[1] ?? 0);
  // T-11-325 Worker가 실제 바뀐 경로로 위험도를 다시 판정한다(승인 카드 경고).
  await report({ ...base, ok: true, pr, branch, title, files: files.slice(0, 300) });
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
    await report({
      thread: process.env.THREAD,
      run: process.env.RUN_URL,
      ok: false,
      reason: '올리는 중에 오류가 났어요',
    }).catch(() => {});
  });
}
