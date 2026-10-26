// T-11-395 SNS 읽기 도구(@mkt). 인스타그램(Graph API)과 Threads(Threads API, 사용자 토큰).
// T-11-397 인스타그램은 Instagram 로그인 토큰(INSTAGRAM_ACCESS_TOKEN, graph.instagram.com)을 먼저 쓰고, 없으면 비즈니스 토큰을 쓴다.
// 둘 다 읽기만 한다. 게시 · 답글 · 숨기기는 나중에 승인 카드로 더한다. 토큰이 없으면 도구가 없다.
import type { Tool } from './claude.ts';
import type { Env } from './env.ts';
import { ledger } from './ledger.ts';

export const IG_GRAPH = 'https://graph.facebook.com/v21.0';
export const IG_LOGIN_GRAPH = 'https://graph.instagram.com/v21.0';
export const THREADS_GRAPH = 'https://graph.threads.net/v1.0';
const DAY = 86_400_000;
const kinds = ['mention', 'reply', 'handoff', 'report'];

/** 60일짜리 사용자 토큰(Threads · Instagram 로그인)을 Worker가 갱신해 원장에 둔 값. */
export type SocialToken = { token: string; at: number; from: string };
export type SocialKind = 'threads' | 'instagram';
type Store = { socialToken(kind: SocialKind): Promise<SocialToken | undefined> };
const SECRET = { threads: 'THREADS_ACCESS_TOKEN', instagram: 'INSTAGRAM_ACCESS_TOKEN' } as const;
const REFRESH = {
  threads: ['https://graph.threads.net/refresh_access_token', 'th_refresh_token'],
  instagram: ['https://graph.instagram.com/refresh_access_token', 'ig_refresh_token'],
} as const;
const secretOf = (env: Env, kind: SocialKind) => env[SECRET[kind]];
/** 비밀값을 새로 넣으면 원장에 둔 갱신 토큰보다 그 값을 쓴다(끝 8자로 구별). */
const fromSecret = (env: Env, kind: SocialKind) => secretOf(env, kind)!.slice(-8);
const current = (env: Env, kind: SocialKind, saved: SocialToken | undefined) =>
  saved && saved.from === fromSecret(env, kind) ? saved : undefined;
const liveToken = async (env: Env, kind: SocialKind, store?: Store) => {
  const saved = await (store ?? ledger(env)).socialToken(kind).catch(() => undefined);
  return current(env, kind, saved)?.token ?? secretOf(env, kind)!;
};

const short = (s: string | undefined, n = 80) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const kst = (iso: string | undefined) =>
  iso ? new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(5, 16).replace('T', ' ') : '';
const clamp = (v: unknown, lo: number, hi: number, d: number) =>
  Math.min(hi, Math.max(lo, Math.round(Number(v)) || d));

async function getJson(fetcher: typeof fetch, url: URL, token: string) {
  const r = await fetcher(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!r.ok || data.error)
    throw new Error(`${r.status} ${data.error?.message ?? ''}`.slice(0, 200));
  return data;
}

/** 기간 합계 지표(total_value)를 "이름 값" 줄로. 지표 하나가 막혀도 나머지는 보인다. */
type Metric = { name: string; total_value?: { value: number }; values?: { value: number }[] };
const metricLines = (data: { data?: Metric[] }) =>
  (data.data ?? []).map(
    (m) => `${m.name} ${m.total_value?.value ?? m.values?.reduce((n, v) => n + v.value, 0) ?? '-'}`,
  );

export function socialTools(
  env: Env,
  kind: string,
  fetcher: typeof fetch = fetch,
  now = () => Date.now(),
  store?: Store,
): Tool[] {
  if (!kinds.includes(kind)) return [];
  const tools: Tool[] = [];
  const igLogin = env.INSTAGRAM_ACCESS_TOKEN;
  const igBiz = env.META_GRAPH_TOKEN ?? env.META_ADS_ACCESS_TOKEN;
  if (igLogin || (igBiz && env.META_IG_USER_ID)) {
    const base = igLogin ? IG_LOGIN_GRAPH : IG_GRAPH;
    const ig = igLogin ? 'me' : env.META_IG_USER_ID!;
    const igToken = async () => (igLogin ? liveToken(env, 'instagram', store) : igBiz!);
    tools.push({
      name: 'instagram',
      description:
        '인스타그램 @offside.lab.kr 읽기. view: account(팔로워 · 게시물 수와 days 동안 도달 · 조회 · 프로필 방문 · 반응), posts(최근 게시물 limit개의 좋아요 · 댓글 · 도달 · 조회 · 저장 · 공유), comments(media_id 게시물의 댓글, 권한이 없으면 실패한다). 게시 · 답글은 못 한다.',
      input_schema: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['account', 'posts', 'comments'] },
          days: { type: 'number' },
          limit: { type: 'number' },
          media_id: { type: 'string' },
        },
        required: ['view'],
      },
      run: async (input) => {
        try {
          const t = await igToken();
          if (input.view === 'comments') {
            const id = String(input.media_id ?? '');
            if (!/^\d{5,25}$/.test(id)) return 'media_id가 필요해요(posts에서 받은 숫자 ID).';
            const u = new URL(`${base}/${id}/comments`);
            u.searchParams.set('fields', 'username,text,timestamp,like_count');
            u.searchParams.set('limit', '30');
            const d = (await getJson(fetcher, u, t)) as {
              data?: {
                username?: string;
                text?: string;
                timestamp?: string;
                like_count?: number;
              }[];
            };
            if (!d.data?.length) return '댓글 없음';
            return d.data
              .map(
                (c) =>
                  `${kst(c.timestamp)} @${c.username} (좋아요 ${c.like_count ?? 0}): ${short(c.text, 200)}`,
              )
              .join('\n');
          }
          if (input.view === 'posts') {
            const limit = clamp(input.limit, 1, 12, 6);
            const u = new URL(`${base}/${ig}/media`);
            u.searchParams.set(
              'fields',
              'id,caption,media_type,timestamp,permalink,like_count,comments_count,insights.metric(reach,views,saved,shares)',
            );
            u.searchParams.set('limit', String(limit));
            const d = (await getJson(fetcher, u, t)) as {
              data?: {
                id: string;
                caption?: string;
                media_type?: string;
                timestamp?: string;
                permalink?: string;
                like_count?: number;
                comments_count?: number;
                insights?: { data?: Metric[] };
              }[];
            };
            if (!d.data?.length) return '게시물 없음';
            return [
              '올린 때(KST) | 종류 | 좋아요 | 댓글 | 인사이트 | 첫 줄 | ID',
              ...d.data.map(
                (m) =>
                  `${kst(m.timestamp)} | ${m.media_type ?? ''} | ${m.like_count ?? 0} | ${m.comments_count ?? 0} | ${metricLines(m.insights ?? {}).join(' · ') || '-'} | ${short(m.caption, 50)} | ${m.id}`,
              ),
            ].join('\n');
          }
          const days = clamp(input.days, 1, 30, 7);
          const p = new URL(`${base}/${ig}`);
          p.searchParams.set('fields', 'username,followers_count,follows_count,media_count');
          const profile = (await getJson(fetcher, p, t)) as {
            username?: string;
            followers_count?: number;
            media_count?: number;
          };
          const u = new URL(`${base}/${ig}/insights`);
          u.searchParams.set(
            'metric',
            'reach,views,profile_views,accounts_engaged,total_interactions',
          );
          u.searchParams.set('metric_type', 'total_value');
          u.searchParams.set('period', 'day');
          u.searchParams.set('since', String(Math.floor((now() - days * DAY) / 1000)));
          u.searchParams.set('until', String(Math.floor(now() / 1000)));
          const insights = await getJson(fetcher, u, t).catch((e: unknown) => ({
            failed: String(e),
          }));
          return [
            `@${profile.username} 팔로워 ${profile.followers_count ?? '-'} · 게시물 ${profile.media_count ?? '-'}`,
            `지난 ${days}일: ${'failed' in insights ? `인사이트 읽기 실패 ${String(insights.failed).slice(0, 120)}` : metricLines(insights as { data?: Metric[] }).join(' · ')}`,
          ].join('\n');
        } catch (e) {
          return `인스타그램 읽기 실패 ${String(e).slice(0, 200)}`;
        }
      },
    });
  }
  if (env.THREADS_ACCESS_TOKEN) {
    tools.push({
      name: 'threads',
      description:
        'Threads @offside.lab.kr 읽기. view: account(days 동안 조회 · 좋아요 · 답글 · 리포스트 · 인용과 팔로워 수), posts(최근 글 limit개와 글마다 조회 · 좋아요 · 답글 · 리포스트), replies(post_id 글에 달린 답글). 글쓰기 · 답글은 못 한다.',
      input_schema: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['account', 'posts', 'replies'] },
          days: { type: 'number' },
          limit: { type: 'number' },
          post_id: { type: 'string' },
        },
        required: ['view'],
      },
      run: async (input) => {
        try {
          const t = await liveToken(env, 'threads', store);
          if (input.view === 'replies') {
            const id = String(input.post_id ?? '');
            if (!/^\d{5,25}$/.test(id)) return 'post_id가 필요해요(posts에서 받은 숫자 ID).';
            const u = new URL(`${THREADS_GRAPH}/${id}/replies`);
            u.searchParams.set('fields', 'username,text,timestamp');
            const d = (await getJson(fetcher, u, t)) as {
              data?: { username?: string; text?: string; timestamp?: string }[];
            };
            if (!d.data?.length) return '답글 없음';
            return d.data
              .slice(0, 30)
              .map((c) => `${kst(c.timestamp)} @${c.username}: ${short(c.text, 200)}`)
              .join('\n');
          }
          if (input.view === 'posts') {
            const limit = clamp(input.limit, 1, 10, 5);
            const u = new URL(`${THREADS_GRAPH}/me/threads`);
            u.searchParams.set('fields', 'id,text,timestamp,media_type,permalink,is_quote_post');
            u.searchParams.set('limit', String(limit));
            const d = (await getJson(fetcher, u, t)) as {
              data?: { id: string; text?: string; timestamp?: string; media_type?: string }[];
            };
            if (!d.data?.length) return '글 없음';
            // 글 목록 응답에는 지표가 없어 글마다 한 번씩 묻는다(최대 10개).
            const rows = await Promise.all(
              d.data.map(async (p) => {
                const iu = new URL(`${THREADS_GRAPH}/${p.id}/insights`);
                iu.searchParams.set('metric', 'views,likes,replies,reposts,quotes');
                const m = await getJson(fetcher, iu, t)
                  .then((x) => metricLines(x as { data?: Metric[] }).join(' · '))
                  .catch(() => '지표 없음');
                return `${kst(p.timestamp)} | ${m} | ${short(p.text, 60)} | ${p.id}`;
              }),
            );
            return ['올린 때(KST) | 지표 | 첫 줄 | ID', ...rows].join('\n');
          }
          const days = clamp(input.days, 1, 30, 7);
          const u = new URL(`${THREADS_GRAPH}/me/threads_insights`);
          u.searchParams.set('metric', 'views,likes,replies,reposts,quotes,followers_count');
          u.searchParams.set('since', String(Math.floor((now() - days * DAY) / 1000)));
          u.searchParams.set('until', String(Math.floor(now() / 1000)));
          const d = (await getJson(fetcher, u, t)) as { data?: Metric[] };
          return `지난 ${days}일: ${metricLines(d).join(' · ') || '지표 없음'}`;
        } catch (e) {
          return `Threads 읽기 실패 ${String(e).slice(0, 200)}`;
        }
      },
    });
  }
  return tools;
}

/**
 * Threads · Instagram 로그인 장기 토큰은 60일이면 끝난다. 하루 한 번(아침 보고 cron) 보고, 마지막 갱신이 7일 넘었으면
 * 새 토큰으로 바꿔 원장에 둔다. 처음 토큰은 비밀값(THREADS_ACCESS_TOKEN · INSTAGRAM_ACCESS_TOKEN)이다.
 */
export async function refreshSocialToken(
  kind: SocialKind,
  env: Env,
  at = Date.now(),
  fetcher: typeof fetch = fetch,
  store: Store & { setSocialToken(kind: SocialKind, v: SocialToken): Promise<void> } = ledger(env),
): Promise<string> {
  const secret = secretOf(env, kind);
  if (!secret) return 'no token';
  const saved = current(env, kind, await store.socialToken(kind));
  if (saved && at - saved.at < 7 * DAY) return 'fresh';
  const [endpoint, grant] = REFRESH[kind];
  const u = new URL(endpoint);
  u.searchParams.set('grant_type', grant);
  u.searchParams.set('access_token', saved?.token ?? secret);
  const r = await fetcher(u.toString());
  const data = (await r.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!r.ok || !data.access_token)
    return `refresh failed ${r.status} ${data.error?.message ?? ''}`.slice(0, 200);
  await store.setSocialToken(kind, { token: data.access_token, at, from: fromSecret(env, kind) });
  return 'refreshed';
}
