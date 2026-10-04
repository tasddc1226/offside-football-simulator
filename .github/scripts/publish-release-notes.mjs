import { readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ENDPOINT = 'https://api.offside-lab.com/v1/internal/release-notes';

/** 사용자 공지는 PR에서 검토한 JSON만 읽는다. 커밋 제목·AI 출력·PR 본문은 게시하지 않는다. */
export function readEntries(directory) {
  const names = readdirSync(directory)
    .filter((n) => n.endsWith('.json'))
    .sort();
  if (names.length > 100) throw new Error('Keep at most 100 active release-note entries.');
  const entries = names.map((name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8')));
  const ids = new Set();
  for (const e of entries) {
    if (
      !e ||
      typeof e !== 'object' ||
      typeof e.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,79}$/.test(e.id ?? '') ||
      typeof e.title !== 'string' ||
      !e.title.trim() ||
      e.title.length > 100 ||
      /[\r\n]/.test(e.title) ||
      !Array.isArray(e.items) ||
      e.items.length < 1 ||
      e.items.length > 12 ||
      e.items.some(
        (s) => typeof s !== 'string' || !s.trim() || s.length > 500 || /[\r\n]/.test(s),
      ) ||
      !['web', 'web-app', 'web-app-pending'].includes(e.availability) ||
      (e.appVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(e.appVersion)) ||
      (e.availability === 'web-app-pending' && !e.appVersion) ||
      Object.keys(e).some(
        (k) => !['id', 'title', 'items', 'availability', 'appVersion'].includes(k),
      ) ||
      ids.has(e.id)
    )
      throw new Error('Invalid or duplicate release-note entry.');
    ids.add(e.id);
  }
  const payloadBytes = Buffer.byteLength(JSON.stringify({ sha: 'a'.repeat(40), entries }));
  if (payloadBytes > 65_536) throw new Error('Release-note payload exceeds 64 KiB.');
  return entries;
}

export async function publish(entries, env, fetchImpl = fetch, mask = console.log) {
  const sha = env.EXPECTED_SHA ?? '';
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('EXPECTED_SHA must be a full commit SHA.');
  // 빈 목록도 배포 전용 인증 경로를 확인한다. 서버는 DB 조회·쓰기 없이 반환한다.
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)
    throw new Error('GitHub Actions OIDC is required.');
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (url.protocol !== 'https:') throw new Error('OIDC request URL must use HTTPS.');
  url.searchParams.set('audience', ENDPOINT);
  const tokenResponse = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) throw new Error(`GitHub OIDC request failed (${tokenResponse.status}).`);
  const { value: token } = await tokenResponse.json();
  if (typeof token !== 'string' || !token || /[\r\n]/.test(token))
    throw new Error('Missing GitHub OIDC token.');
  mask(`::add-mask::${token}`);
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha, entries }),
  });
  if (!response.ok)
    throw new Error(`Release-note publication failed (${response.status}). Re-run the failed job.`);
  const { data } = await response.json();
  if (!data || typeof data.updated !== 'boolean' || !Array.isArray(data.publishedIds))
    throw new Error('Invalid publication response.');
  return data;
}

export async function main(command, directory, env = process.env) {
  const entries = readEntries(directory);
  if (command === 'validate') {
    console.log(`Validated ${entries.length} reviewed release-note entries.`);
    return;
  }
  if (command !== 'publish')
    throw new Error('Usage: publish-release-notes.mjs validate|publish <directory>');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== env.EXPECTED_SHA)
    throw new Error('Release notes must come from the deployed commit.');
  const result = await publish(entries, env);
  const summary = result.updated
    ? `릴리즈 노트 ${result.postId}에 ${result.publishedIds.length}개 항목을 추가했어요.`
    : '새 릴리즈 항목이 없어 글과 알림을 갱신하지 않았어요.';
  console.log(summary);
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(env.GITHUB_STEP_SUMMARY, `### 게임 내 릴리즈 노트\n${summary}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2], process.argv[3]).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
