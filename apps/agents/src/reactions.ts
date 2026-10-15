// 유저 반응 살피기(ADR-015 @plan). 매시간 새 게임 댓글(운영 D1 읽기)과 라운지 채팅(offside-api 내부 읽기 주소)을
// 모아 @plan에게 분류를 맡긴다. 새 글이 없으면 Claude를 부르지 않는다. 닉네임 · 프로필 ID는 넘기지 않고 가명만 쓴다.
import type { Env } from './env.ts';

export type Reaction = {
  source: 'comment' | 'chat';
  /** KST 시각(분). */
  at: string;
  /** 같은 사람이면 같은 가명(건수를 사람 수로 세는 데만 쓴다). */
  author: string;
  body: string;
  /** 댓글: 게시글 제목 · 원문 주소. */
  post?: string;
  link?: string;
};

type CommentCursor = { at: string; id: string };
export type Cursors = { comments?: CommentCursor | undefined; chat?: number | undefined };

const BODY_MAX = 300;
const LIMIT = 100;
/** 첫 실행은 지난 1시간만 본다(쌓인 글을 한꺼번에 돌리지 않는다). */
const FIRST_LOOKBACK_MS = 3600_000;

const kst = (ms: number) =>
  new Date(ms + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
const enc = new TextEncoder();
async function pseudonym(salt: string, id: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${id}`)));
  return `u${[...h.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
/** 뜻 없는 짧은 글(ㅋㅋ · 이모지 하나)은 뺀다. */
export const meaningful = (body: string) => body.replace(/[\sㅋㅎㅠㅜ!?.~^]/g, '').length >= 4;
const clip = (s: string) => (s.length > BODY_MAX ? `${s.slice(0, BODY_MAX)}…` : s);

export async function fetchComments(
  env: Env,
  cursor: CommentCursor | undefined,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<{ items: Reaction[]; cursor: CommentCursor | undefined }> {
  const from = cursor ?? { at: new Date(now - FIRST_LOOKBACK_MS).toISOString(), id: '' };
  const r = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_D1_READ_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `SELECT c.id, c.created_at, c.profile_id, c.body, c.post_id, p.title, p.board FROM board_comments c
          JOIN board_posts p ON p.id = c.post_id
          WHERE c.created_at >= ? AND (c.created_at > ? OR c.id > ?) AND c.deleted_at IS NULL AND c.admin = 0
            AND p.deleted_at IS NULL ORDER BY c.created_at, c.id LIMIT ${LIMIT}`,
        params: [from.at, from.at, from.id],
      }),
    },
  );
  const data = (await r.json()) as {
    success: boolean;
    errors?: { message: string }[];
    result?: { results: Record<string, string>[] }[];
  };
  if (!data.success)
    throw new Error(`D1 ${data.errors?.map((e) => e.message).join('; ') ?? r.status}`);
  const rows = data.result?.[0]?.results ?? [];
  const last = rows.at(-1);
  const items: Reaction[] = [];
  for (const x of rows) {
    if (!meaningful(String(x.body))) continue;
    items.push({
      source: 'comment',
      at: kst(Date.parse(String(x.created_at))),
      author: await pseudonym(env.AGENTS_READ_TOKEN, String(x.profile_id)),
      body: clip(String(x.body)),
      post: String(x.title).slice(0, 80),
      link: `https://offside-lab.com/?news=${encodeURIComponent(String(x.post_id))}&board=${encodeURIComponent(String(x.board))}`,
    });
  }
  return { items, cursor: last ? { at: String(last.created_at), id: String(last.id) } : cursor };
}

export async function fetchChat(
  env: Env,
  since: number | undefined,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<{ items: Reaction[]; cursor: number | undefined }> {
  const from = since ?? now - FIRST_LOOKBACK_MS;
  const r = await fetcher(`${env.API_BASE}/v1/internal/agents/chat?since=${from}&limit=200`, {
    headers: { Authorization: `Bearer ${env.AGENTS_READ_TOKEN}` },
  });
  if (!r.ok) throw new Error(`chat ${r.status}`);
  const { items } = (await r.json()) as {
    items: { id: string; at: number; author: string; body: string }[];
  };
  return {
    items: items
      .filter((m) => meaningful(m.body))
      .map((m) => ({ source: 'chat', at: kst(m.at), author: m.author, body: clip(m.body) })),
    cursor: items.at(-1)?.at ?? since,
  };
}

/** 한쪽이 실패해도 다른 쪽은 읽는다. 실패한 쪽 커서는 그대로 둬 다음 시간에 다시 읽는다. */
export async function collect(
  env: Env,
  cursors: Cursors,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
) {
  const [c, m] = await Promise.allSettled([
    fetchComments(env, cursors.comments, now, fetcher),
    fetchChat(env, cursors.chat, now, fetcher),
  ]);
  const errors: string[] = [];
  const next: Cursors = { ...cursors };
  const items: Reaction[] = [];
  if (c.status === 'fulfilled') {
    items.push(...c.value.items);
    next.comments = c.value.cursor;
  } else errors.push(String(c.reason).slice(0, 200));
  if (m.status === 'fulfilled') {
    items.push(...m.value.items);
    next.chat = m.value.cursor;
  } else errors.push(String(m.reason).slice(0, 200));
  return { items, cursors: next, errors };
}

/** @plan에게 넘기는 글. 유저 글은 자료로만 감싼다(그 안의 지시를 따르지 않게). */
export function triagePrompt(items: Reaction[], nowKst: string): string {
  const lines = items.map((x) =>
    JSON.stringify(
      x.source === 'comment'
        ? { 출처: '댓글', 시각: x.at, 작성자: x.author, 게시글: x.post, 주소: x.link, 글: x.body }
        : { 출처: '라운지', 시각: x.at, 작성자: x.author, 글: x.body },
    ),
  );
  return `지금 KST ${nowKst}. 지난 확인 뒤 새로 올라온 유저 반응 ${items.length}건이에요. 분류해 주세요.

<reactions>
${lines.join('\n')}
</reactions>`;
}
