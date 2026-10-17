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

/** 파일을 줄 번호와 함께. pattern이 있으면 맞는 줄과 앞뒤 2줄만, 없으면 from부터 lines줄. */
export function fileView(
  text: string,
  o: { from: number; lines: number; pattern?: string | undefined },
): string {
  const all = text.split('\n');
  const num = (i: number) => `${i + 1}\t${all[i]}`;
  if (o.pattern) {
    let re: RegExp;
    try {
      re = new RegExp(o.pattern, 'i');
    } catch {
      throw new Error('pattern이 정규식으로 올바르지 않아요');
    }
    const keep = new Set<number>();
    let hits = 0;
    all.forEach((l, i) => {
      if (!re.test(l) || hits >= 40) return;
      hits++;
      for (let j = Math.max(0, i - 2); j <= Math.min(all.length - 1, i + 2); j++) keep.add(j);
    });
    if (!hits) return `맞는 줄이 없어요(전체 ${all.length}줄)`;
    const out: string[] = [];
    let prev = -2;
    for (const i of [...keep].sort((a, b) => a - b)) {
      if (i !== prev + 1) out.push('…');
      out.push(num(i));
      prev = i;
    }
    return clip(
      `전체 ${all.length}줄 · 맞은 줄 ${hits}개${hits >= 40 ? '(40개까지)' : ''}\n${out.join('\n')}`,
    );
  }
  const start = Math.max(1, Math.floor(o.from)) - 1;
  const count = Math.min(600, Math.max(1, Math.floor(o.lines)));
  // 줄 단위로 14,000자까지 담고, 다 못 담으면 이어 읽을 줄 번호를 알려 준다.
  const out: string[] = [];
  let size = 0;
  let i = start;
  for (; i < Math.min(all.length, start + count); i++) {
    const line = num(i);
    if (size + line.length > 14_000 && out.length) break;
    out.push(line.length > 14_000 ? `${line.slice(0, 14_000)}…` : line);
    size += line.length + 1;
  }
  if (start >= all.length) return `전체 ${all.length}줄이에요. from_line이 너무 커요`;
  const more = i < all.length ? `\n…(전체 ${all.length}줄, 이어 읽으려면 from_line ${i + 1})` : '';
  return `${out.join('\n')}${more}`;
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
      name: 'pr_list',
      description:
        '최근 PR 목록(번호 · 제목 · 상태 · 브랜치 · 머지 시각). PR 번호를 모를 때 작업 ID나 낱말(query)로 찾는다. state: open · closed · all(기본 all), 최대 20개.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '제목 · 브랜치에 들어간 낱말(예: T-11-300)' },
          state: { type: 'string', enum: ['open', 'closed', 'all'] },
        },
      },
      run: async (input) => {
        const state = ['open', 'closed', 'all'].includes(String(input.state))
          ? String(input.state)
          : 'all';
        const q = String(input.query ?? '').toLowerCase();
        const prs = (await gh(
          `/pulls?state=${state}&sort=updated&direction=desc&per_page=100`,
        )) as unknown as {
          number: number;
          title: string;
          state: string;
          merged_at: string | null;
          head: { ref: string };
          html_url: string;
        }[];
        const hits = prs
          .filter((p) => !q || `${p.title} ${p.head.ref}`.toLowerCase().includes(q))
          .slice(0, 20)
          .map((p) => ({
            number: p.number,
            title: p.title,
            state: p.merged_at ? 'merged' : p.state,
            branch: p.head.ref,
            merged_at: p.merged_at,
            url: p.html_url,
          }));
        return hits.length
          ? clip(JSON.stringify(hits))
          : '맞는 PR이 없어요(최근 100개 안에서 찾았어요)';
      },
    },
    {
      name: 'repo_file',
      description:
        '저장소 파일 읽기(main 기준). 줄 번호를 붙여 돌려준다. 긴 파일은 from_line(1부터) · lines(기본 300, 최대 600)로 나눠 읽거나, pattern(정규식)으로 맞는 줄과 앞뒤 2줄만 본다. 경로를 모르면 먼저 repo_find로 찾는다. 예: apps/api/src/db/schema.ts(D1 스키마), docs/operations/ 런북.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          ref: { type: 'string', description: '브랜치 · SHA, 기본 main' },
          from_line: { type: 'integer' },
          lines: { type: 'integer' },
          pattern: { type: 'string', description: '이 정규식에 맞는 줄만(대소문자 무시)' },
        },
        required: ['path'],
      },
      run: async (input) => {
        const path = String(input.path ?? '').replace(/^\/+/, '');
        const ref = String(input.ref ?? 'main');
        if (!path || path.includes('..') || !/^[\w./@-]+$/.test(path) || !/^[\w./-]+$/.test(ref))
          throw new Error('경로가 올바르지 않아요');
        const r = await f(`https://raw.githubusercontent.com/${d.repo}/${ref}/${path}`);
        if (!r.ok)
          throw new Error(`파일 없음 (${r.status}). 경로를 모르면 repo_find로 먼저 찾아요`);
        return fileView(await r.text(), {
          from: Number(input.from_line) || 1,
          lines: Number(input.lines) || 300,
          pattern: input.pattern ? String(input.pattern) : undefined,
        });
      },
    },
    {
      name: 'repo_find',
      description:
        '저장소 파일 경로 찾기(main). query의 낱말이 모두 들어간 경로를 최대 60개 돌려준다(대소문자 무시, 공백으로 나눈다). 예: "cup route", "scout", "team sim". 파일 내용 검색은 repo_grep.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      run: async (input) => {
        const words = String(input.query ?? '')
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        if (!words.length) throw new Error('찾을 낱말을 주세요');
        const tree = (await gh('/git/trees/main?recursive=1')) as {
          tree?: { path: string; type: string }[];
        };
        const hits = (tree.tree ?? [])
          .filter((t) => t.type === 'blob' && !/(^|\/)(node_modules|dist|\.git)\//.test(t.path))
          .map((t) => t.path)
          .filter((p) => words.every((w) => p.toLowerCase().includes(w)));
        return hits.length
          ? `${hits.slice(0, 60).join('\n')}${hits.length > 60 ? `\n…그 밖 ${hits.length - 60}개(낱말을 더 좁혀요)` : ''}`
          : '맞는 경로가 없어요. 낱말을 줄이거나 바꿔 보세요';
      },
    },
    {
      name: 'repo_grep',
      description:
        '저장소 코드 내용 검색(GitHub 코드 검색, main 기본 브랜치). 함수 · 테이블 · 문구가 어느 파일에 있는지 찾는다. 결과는 파일 경로와 맞은 조각 최대 20개. 찾은 뒤 repo_file의 pattern으로 그 줄을 읽는다.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '찾을 낱말(예: liveTeamsByIds, "owner_teams")' },
          path: { type: 'string', description: '이 폴더 아래로 좁히기(예: apps/api/src)' },
        },
        required: ['query'],
      },
      run: async (input) => {
        const q = String(input.query ?? '').trim();
        if (!q) throw new Error('찾을 낱말을 주세요');
        const scope = input.path ? ` path:${String(input.path).replace(/[^\w./-]/g, '')}` : '';
        const r = await f(
          `https://api.github.com/search/code?per_page=20&q=${encodeURIComponent(`${q} repo:${d.repo}${scope}`)}`,
          {
            headers: {
              Accept: 'application/vnd.github.text-match+json',
              'User-Agent': 'offside-agents',
              ...(await ghAuth(d.githubToken)),
            },
          },
        );
        if (!r.ok)
          throw new Error(
            `코드 검색 실패 (GitHub ${r.status}). repo_find로 경로를 찾고 repo_file의 pattern으로 읽어요`,
          );
        const data = (await r.json()) as {
          total_count?: number;
          items?: { path: string; text_matches?: { fragment: string }[] }[];
        };
        const items = data.items ?? [];
        if (!items.length) return '찾은 곳이 없어요. 낱말을 바꿔 보세요';
        return clip(
          `${data.total_count ?? items.length}곳 중 ${items.length}곳\n` +
            items
              .map(
                (i) =>
                  `${i.path}\n${(i.text_matches ?? [])
                    .map((m) => `  ${m.fragment.replace(/\s+/g, ' ').slice(0, 200)}`)
                    .join('\n')}`,
              )
              .join('\n'),
        );
      },
    },
  ];
}
