// @ops 주기 작업 목록: GitHub Actions 예약 워크플로와 Cloudflare Worker cron을 모아 최근 결과 · 다음 실행을 돌려준다(읽기 전용).
import type { Tool } from '../claude.ts';
import { ghAuth, type GhToken } from '../github.ts';
import { kstText, nextRuns } from '../cron.ts';

export type ScheduleDeps = {
  repo: string;
  githubToken?: GhToken;
  accountId: string;
  /** Workers 스크립트 읽기 권한이 있는 토큰(CF_MCP_TOKEN). */
  cfToken?: string | undefined;
  /** cron을 볼 Worker 스크립트. */
  workers: string[];
  fetcher?: typeof fetch;
};

type Run = {
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  event: string;
};

export function scheduleTools(d: ScheduleDeps): Tool[] {
  const { collect } = scheduleData(d);
  return [
    {
      name: 'schedules',
      description:
        '운영 인프라의 주기 작업 전체: GitHub Actions 예약 워크플로(cron · 다음 실행 · 최근 예약 실행 5번 결과)와 Cloudflare Worker cron(다음 실행). Worker cron의 실행 결과는 cloudflare_* 도구로 Workers 로그를 본다.',
      input_schema: { type: 'object', properties: {} },
      run: async () => JSON.stringify(await collect(Date.now())).slice(0, 6_000),
    },
  ];
}

/** 주기 작업 목록 모으기(schedules · report_digest가 같이 쓴다). */
/** sinceMs: 그 뒤 예약 실행을 최대 runs번까지(기본 최근 5번). */
export function scheduleData(d: ScheduleDeps, opt: { runs?: number; sinceMs?: number } = {}) {
  const f = d.fetcher ?? fetch;
  const gh = async <T>(path: string): Promise<T> => {
    const r = await f(`https://api.github.com/repos/${d.repo}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'offside-agents',
        ...(await ghAuth(d.githubToken)),
      },
    });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return r.json() as Promise<T>;
  };

  async function actions(now: number) {
    const { workflows } = await gh<{
      workflows: { id: number; name: string; path: string; state: string }[];
    }>('/actions/workflows?per_page=100');
    const out = [];
    for (const w of workflows.filter((x) => x.state === 'active')) {
      const r = await f(`https://raw.githubusercontent.com/${d.repo}/main/${w.path}`);
      if (!r.ok) continue;
      const crons = [...(await r.text()).matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map(
        (m) => m[1]!,
      );
      if (!crons.length) continue;
      const { workflow_runs } = await gh<{ workflow_runs: Run[] }>(
        `/actions/workflows/${w.id}/runs?event=schedule&per_page=${opt.runs ?? 5}${
          opt.sinceMs
            ? `&created=${encodeURIComponent(`>=${new Date(opt.sinceMs).toISOString()}`)}`
            : ''
        }`,
      );
      out.push({
        kind: 'github-actions',
        name: w.name,
        file: w.path.split('/').pop(),
        crons_utc: crons,
        next_kst: crons
          .flatMap((c) => nextRuns(c, now, 2))
          .sort((a, b) => a - b)
          .slice(0, 3)
          .map(kstText),
        recent: workflow_runs.map((x) => ({
          at_kst: kstText(Date.parse(x.created_at)),
          status: x.status,
          conclusion: x.conclusion,
          // 성공한 실행은 링크를 빼 결과를 줄인다.
          ...(x.conclusion === 'success' ? {} : { url: x.html_url }),
        })),
      });
    }
    return out;
  }

  async function workers(now: number) {
    if (!d.cfToken) return [{ kind: 'worker-cron', error: 'Cloudflare 토큰 없음' }];
    const out = [];
    for (const name of d.workers) {
      const r = await f(
        `https://api.cloudflare.com/client/v4/accounts/${d.accountId}/workers/scripts/${name}/schedules`,
        { headers: { Authorization: `Bearer ${d.cfToken}` } },
      );
      const data = (await r.json()) as {
        success: boolean;
        errors?: { message: string }[];
        result?: { schedules: { cron: string }[] };
      };
      if (!data.success) {
        out.push({
          kind: 'worker-cron',
          worker: name,
          error: data.errors?.map((e) => e.message).join('; '),
        });
        continue;
      }
      const crons = (data.result?.schedules ?? []).map((s) => s.cron);
      out.push({
        kind: 'worker-cron',
        worker: name,
        crons_utc: crons,
        next_kst: crons
          .flatMap((c) => nextRuns(c, now, 2))
          .sort((a, b) => a - b)
          .slice(0, 3)
          .map(kstText),
      });
    }
    return out;
  }

  async function collect(now: number) {
    const [a, w] = await Promise.allSettled([actions(now), workers(now)]);
    return {
      now_kst: kstText(now),
      actions: a.status === 'fulfilled' ? a.value : { error: String(a.reason).slice(0, 200) },
      workers: w.status === 'fulfilled' ? w.value : { error: String(w.reason).slice(0, 200) },
    };
  }

  return { collect };
}
