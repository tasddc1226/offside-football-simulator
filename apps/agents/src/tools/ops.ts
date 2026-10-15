// @ops 도구: 전부 읽기 전용이다(ADR-015 도구와 권한). D1 토큰은 D1 읽기 권한만 있어 쓰기 쿼리는 Cloudflare가 거절하고,
// 여기서도 SELECT 한 문장만 보낸다. 결과는 행 · 글자 수를 잘라 넘긴다(토큰 비용).
import type { Tool } from '../claude.ts';
import { ghAuth, type GhToken } from '../github.ts';

const MAX_ROWS = 50;
const MAX_CHARS = 6_000;
const clip = (s: string, n = MAX_CHARS) =>
  s.length > n ? `${s.slice(0, n)}\n…(잘림, ${s.length}자)` : s;

const WRITE =
  /\b(insert|update|delete|replace|upsert|drop|alter|create|attach|detach|pragma|vacuum|reindex|analyze|begin|commit|rollback|savepoint|release)\b/i;

/** 읽기 쿼리 한 문장인지 본다. 주석을 빼고, 끝의 `;` 하나만 허용한다. */
export function readOnlySql(sql: string): string {
  const s = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .replace(/;\s*$/, '');
  if (!s) throw new Error('빈 쿼리');
  if (s.includes(';')) throw new Error('한 번에 한 문장만 보낼 수 있어요');
  if (!/^(select|with)\b/i.test(s)) throw new Error('SELECT · WITH 조회만 할 수 있어요');
  if (WRITE.test(s.replace(/'(?:[^']|'')*'/g, "''")))
    throw new Error('쓰기 · 설정 키워드는 쓸 수 없어요');
  return s;
}

export type OpsDeps = {
  accountId: string;
  databaseId: string;
  d1Token: string;
  repo: string;
  githubToken?: GhToken;
  fetcher?: typeof fetch;
};

export function opsTools(d: OpsDeps): Tool[] {
  const f = d.fetcher ?? fetch;
  const gh = async (path: string) => {
    const r = await f(`https://api.github.com/repos/${d.repo}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'offside-agents',
        ...(await ghAuth(d.githubToken)),
      },
    });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return r.json() as Promise<Record<string, unknown>>;
  };
  return [
    {
      name: 'd1_query',
      description:
        "운영 D1(SQLite) 읽기 조회. SELECT · WITH 한 문장만. 결과는 최대 50행. 큰 테이블은 인덱스가 있는 열 · 시간 범위 · LIMIT으로 좁힌다. 스키마는 `SELECT name, sql FROM sqlite_master WHERE type='table'`로 본다.",
      input_schema: {
        type: 'object',
        properties: { sql: { type: 'string', description: 'SQLite SELECT 문' } },
        required: ['sql'],
      },
      run: async (input) => {
        const sql = readOnlySql(String(input.sql ?? ''));
        const r = await f(
          `https://api.cloudflare.com/client/v4/accounts/${d.accountId}/d1/database/${d.databaseId}/query`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${d.d1Token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql }),
          },
        );
        const data = (await r.json()) as {
          success: boolean;
          errors?: { message: string }[];
          result?: { results: unknown[]; meta?: { rows_read?: number; duration?: number } }[];
        };
        if (!data.success)
          throw new Error(data.errors?.map((e) => e.message).join('; ') || `D1 ${r.status}`);
        const res = data.result?.[0];
        const rows = res?.results ?? [];
        return clip(
          JSON.stringify({
            rows: rows.slice(0, MAX_ROWS),
            total: rows.length,
            truncated: rows.length > MAX_ROWS,
            rows_read: res?.meta?.rows_read,
          }),
        );
      },
    },
    {
      name: 'github_runs',
      description:
        'GitHub Actions 실행 기록. workflow에 파일 이름(예: deploy-production.yml, slack-operations.yml)을 주면 그 워크플로만 본다. 최근 순.',
      input_schema: {
        type: 'object',
        properties: {
          workflow: { type: 'string' },
          status: { type: 'string', description: 'completed · failure · success · in_progress 등' },
          limit: { type: 'number', description: '1~20, 기본 10' },
        },
      },
      run: async (input) => {
        const n = Math.min(20, Math.max(1, Number(input.limit) || 10));
        const q = `?per_page=${n}${input.status ? `&status=${encodeURIComponent(String(input.status))}` : ''}`;
        const base = input.workflow
          ? `/actions/workflows/${encodeURIComponent(String(input.workflow))}/runs`
          : '/actions/runs';
        const data = (await gh(base + q)) as { workflow_runs?: Record<string, unknown>[] };
        return clip(
          JSON.stringify(
            (data.workflow_runs ?? []).map((w) => ({
              id: w.id,
              name: w.name,
              title: w.display_title,
              event: w.event,
              status: w.status,
              conclusion: w.conclusion,
              sha: String(w.head_sha ?? '').slice(0, 8),
              created_at: w.created_at,
              url: w.html_url,
            })),
          ),
        );
      },
    },
    {
      name: 'github_run_jobs',
      description: 'Actions 실행 하나의 잡 · 실패한 단계 이름.',
      input_schema: {
        type: 'object',
        properties: { run_id: { type: 'number' } },
        required: ['run_id'],
      },
      run: async (input) => {
        const id = Number(input.run_id);
        if (!Number.isInteger(id) || id <= 0) throw new Error('run_id가 올바르지 않아요');
        const data = (await gh(`/actions/runs/${id}/jobs?per_page=50`)) as {
          jobs?: {
            name: string;
            conclusion: string | null;
            html_url: string;
            steps?: { name: string; conclusion: string | null }[];
          }[];
        };
        return clip(
          JSON.stringify(
            (data.jobs ?? []).map((j) => ({
              name: j.name,
              conclusion: j.conclusion,
              url: j.html_url,
              failed_steps: (j.steps ?? [])
                .filter((s) => s.conclusion === 'failure')
                .map((s) => s.name),
            })),
          ),
        );
      },
    },
    {
      name: 'repo_file',
      description:
        '저장소 파일 읽기(main 기준, 최대 12,000자). 예: tooling/scripts/slack-ops.mjs(경보 규칙), apps/api/src/db/schema.ts(D1 스키마), docs/operations/ 런북.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          ref: { type: 'string', description: '브랜치 · SHA, 기본 main' },
        },
        required: ['path'],
      },
      run: async (input) => {
        const path = String(input.path ?? '').replace(/^\/+/, '');
        const ref = String(input.ref ?? 'main');
        if (!path || path.includes('..') || !/^[\w./-]+$/.test(path) || !/^[\w./-]+$/.test(ref))
          throw new Error('경로가 올바르지 않아요');
        const r = await f(`https://raw.githubusercontent.com/${d.repo}/${ref}/${path}`);
        if (!r.ok) throw new Error(`파일 없음 (${r.status})`);
        return clip(await r.text());
      },
    },
  ];
}
