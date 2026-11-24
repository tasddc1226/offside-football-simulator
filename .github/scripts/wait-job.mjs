// T-11-824 같은 실행의 다른 잡이 끝날 때까지 기다린다. 앱 OTA 잡은 무거운 준비(설치 · 지문 · 빌드 확인)를 웹 · API 배포와
// 나란히 하고, 게시 직전에만 "Deploy production"이 성공했는지 기다린다. 전에는 잡 전체가 배포 뒤에 시작해 배포 시간에
// 준비 시간이 그대로 더해졌다. 배포가 실패 · 취소되면 실패로 끝나 OTA를 게시하지 않는다.
//
// 사용: GH_TOKEN=… GITHUB_REPOSITORY=… GITHUB_RUN_ID=… node wait-job.mjs "Deploy production"
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const POLL_MS = 10_000;
export const TIMEOUT_MS = 30 * 60_000;

/** 잡 목록에서 이름이 같은 잡의 상태. 다시 실행한 잡은 filter=latest로 마지막 시도만 온다. */
export function jobState(jobs, name) {
  const job = jobs.find((j) => j.name === name);
  if (!job) return { done: false, missing: true };
  if (job.status !== 'completed') return { done: false };
  return { done: true, ok: job.conclusion === 'success', conclusion: job.conclusion };
}

export async function waitForJob(name, env = process.env, deps = {}) {
  const fetcher = deps.fetcher ?? fetch;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const { GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: run, GH_TOKEN: token } = env;
  if (!repo || !run || !token)
    throw new Error('GH_TOKEN, GITHUB_REPOSITORY and GITHUB_RUN_ID are required');
  const url = `https://api.github.com/repos/${repo}/actions/runs/${run}/jobs?filter=latest&per_page=100`;
  const deadline = now() + (deps.timeoutMs ?? TIMEOUT_MS);
  for (;;) {
    const r = await fetcher(url, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`Job lookup failed (HTTP ${r.status})`);
    const state = jobState((await r.json()).jobs ?? [], name);
    if (state.done) {
      if (!state.ok) throw new Error(`${name} finished with ${state.conclusion}; not publishing.`);
      return true;
    }
    if (now() >= deadline) throw new Error(`Timed out waiting for ${name}`);
    await sleep(deps.pollMs ?? POLL_MS);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2];
  try {
    const started = Date.now();
    await waitForJob(name);
    console.log(`${name} succeeded (waited ${Math.round((Date.now() - started) / 1000)}s).`);
  } catch (e) {
    console.error(`::error::${e instanceof Error ? e.message : 'wait failed'}`);
    process.exitCode = 1;
  }
}
