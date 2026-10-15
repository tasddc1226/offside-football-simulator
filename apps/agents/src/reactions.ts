// 유저 반응 살피기(ADR-015 @plan). 매시간 새 게임 댓글(운영 D1 읽기), 라운지 채팅(offside-api 내부 읽기 주소),
// 디시 마이너 갤러리 글 · 댓글(공개 페이지, 웹훅이 없어 읽어 온다)을 모아 @plan에게 분류를 맡긴다. 새 글이 없으면 Claude를 부르지 않는다. 닉네임 · 프로필 ID는 넘기지 않고 가명만 쓴다.
import type { Env } from './env.ts';

export type Reaction = {
  source: 'comment' | 'chat' | 'dc-post' | 'dc-comment';
  /** KST 시각(분). */
  at: string;
  /** 같은 사람이면 같은 가명(건수를 사람 수로 세는 데만 쓴다). */
  author: string;
  body: string;
  /** 댓글 · 디시: 게시글 제목 · 원문 주소. */
  post?: string;
  link?: string;
};

type CommentCursor = { at: string; id: string };
/** 디시: 마지막으로 본 글 번호 · 댓글 번호(갤러리 전체에서 늘어난다), 글마다 본 댓글 수. */
type DcCursor = { post: number; comment: number; counts: Record<string, number> };
export type Cursors = {
  comments?: CommentCursor | undefined;
  chat?: number | undefined;
  dc?: DcCursor | undefined;
};

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

export const DC_GALLERY = 'offsidegame';
const DC = 'https://gall.dcinside.com';
const DC_UA = 'Mozilla/5.0 OFFSIDE-operations';
/** 한 번에 본문 · 댓글을 읽을 글 수(디시에 부담을 주지 않게). */
const DC_POSTS_MAX = 8;

const decode = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp);/g,
      (_, v: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[v] ?? ' ',
    )
    // 링크는 옮기지 않는다(광고 · 피싱 링크가 섞인다).
    .replace(/https?:\/\/\S+/g, '[링크]')
    .replace(/\s+/g, ' ')
    .trim();

export type DcRow = { no: number; title: string; at: number; author: string; replies: number };

/** 목록 한 쪽: 공지 · 설문은 뺀다. 시각은 KST 표기("2026-10-15 18:32:38")를 epoch ms로. */
export function parseDcList(html: string): DcRow[] {
  if (!html.includes('gall_list')) throw new Error('dc list unavailable');
  const rows: DcRow[] = [];
  for (const m of html.matchAll(/<tr\b([^>]*)data-no="(\d+)"([^>]*)>([\s\S]*?)<\/tr>/g)) {
    if (/icon_notice|icon_survey/.test(m[1]! + m[3]!)) continue;
    const td = m[4]!;
    const a = /<td[^>]*class="gall_tit[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/.exec(td);
    const date = /<td class="gall_date" title="([\d-]+ [\d:]+)"/.exec(td);
    const w = /data-nick="([^"]*)" data-uid="([^"]*)" data-ip="([^"]*)"/.exec(td);
    if (!a || !date) continue;
    rows.push({
      no: Number(m[2]),
      title: decode(a[1]!).slice(0, 120),
      at: Date.parse(`${date[1]!.replace(' ', 'T')}+09:00`),
      author: w ? w[2] || `${w[1]}@${w[3]}` : '',
      replies: Number(/reply_num">\[(\d+)/.exec(td)?.[1] ?? 0),
    });
  }
  return rows;
}

/** 글 본문과 댓글 읽기 토큰(e_s_n_o). */
export function parseDcView(html: string): { body: string; token: string | null } {
  const body = /<div class="write_div"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
  const token = /id="e_s_n_o"[^>]*value="([^"]+)"/.exec(html)?.[1] ?? null;
  return { body: decode(body), token };
}

type DcComment = {
  no: string;
  user_id: string;
  name: string;
  ip: string;
  reg_date: string;
  memo: string;
  del_yn: string;
  is_delete: string;
};

export async function fetchDc(
  env: Env,
  cursor: DcCursor | undefined,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<{ items: Reaction[]; cursor: DcCursor | undefined }> {
  const get = async (url: string, init?: RequestInit) => {
    const r = await fetcher(url, { ...init, headers: { 'user-agent': DC_UA, ...init?.headers } });
    if (!r.ok) throw new Error(`dc ${r.status}`);
    return r;
  };
  const rows = parseDcList(
    await (await get(`${DC}/mgallery/board/lists/?id=${DC_GALLERY}&page=1`)).text(),
  );
  const first = !cursor;
  const since = now - FIRST_LOOKBACK_MS;
  const prev = cursor ?? { post: 0, comment: 0, counts: {} };
  const link = (no: number) => `${DC}/mgallery/board/view/?id=${DC_GALLERY}&no=${no}`;
  const items: Reaction[] = [];
  // 새 글 · 댓글 수가 늘어난 글만 연다(첫 실행은 지난 1시간 글만).
  const fresh = (r: DcRow) => (first ? r.at >= since : r.no > prev.post);
  const grown = (r: DcRow) => r.replies > (prev.counts[r.no] ?? (first ? r.replies : 0));
  // 오래된 글부터 연다(상한에 걸려 못 연 새 글은 다음 시간에 이어서).
  const open = rows
    .filter((r) => fresh(r) || grown(r))
    .sort((a, b) => a.no - b.no)
    .slice(0, DC_POSTS_MAX);
  let token: string | null = null;
  let maxComment = prev.comment;
  for (const r of open) {
    const view = parseDcView(await (await get(link(r.no))).text());
    token = view.token ?? token;
    if (fresh(r) && meaningful(r.title + view.body))
      items.push({
        source: 'dc-post',
        at: kst(r.at),
        author: await pseudonym(env.AGENTS_READ_TOKEN, `dc:${r.author}`),
        body: clip(view.body ? `${r.title} / ${view.body}` : r.title),
        post: r.title,
        link: link(r.no),
      });
    if (!r.replies || !token) continue;
    const res = await get(`${DC}/board/comment/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        referer: link(r.no),
      },
      body: new URLSearchParams({
        id: DC_GALLERY,
        no: String(r.no),
        cmt_id: DC_GALLERY,
        cmt_no: String(r.no),
        e_s_n_o: token,
        comment_page: '1',
        _GALLTYPE_: 'M',
      }).toString(),
    });
    const { comments } = (await res.json().catch(() => ({}))) as { comments?: DcComment[] | null };
    for (const c of comments ?? []) {
      const no = Number(c.no);
      if (!Number.isFinite(no) || c.del_yn === 'Y' || c.is_delete !== '0') continue;
      // 운영 · 시스템 댓글(갤러리 봇)은 이름이 비어 있다.
      if (!c.name && !c.user_id) continue;
      maxComment = Math.max(maxComment, no);
      // 댓글 시각 "10.15 20:28:02"(KST, 연도 없음).
      const [md, hms] = c.reg_date.split(' ');
      const year = new Date(now + 9 * 3600_000).getUTCFullYear();
      const at = Date.parse(`${year}-${md!.replace('.', '-')}T${hms}+09:00`);
      if (first ? at < since : no <= prev.comment) continue;
      const body = decode(c.memo);
      if (!meaningful(body)) continue;
      items.push({
        source: 'dc-comment',
        at: kst(at),
        author: await pseudonym(env.AGENTS_READ_TOKEN, `dc:${c.user_id || `${c.name}@${c.ip}`}`),
        body: clip(body),
        post: r.title,
        link: link(r.no),
      });
    }
  }
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.no] = r.replies;
  // 못 연 글(상한 넘음)은 댓글 수를 앞 값으로 둬 다음 시간에 다시 연다.
  for (const r of rows) if (!open.includes(r) && grown(r)) counts[r.no] = prev.counts[r.no] ?? 0;
  const skipped = rows.filter((r) => fresh(r) && !open.includes(r)).map((r) => r.no);
  const postMax = skipped.length
    ? Math.min(...skipped) - 1
    : Math.max(prev.post, ...rows.map((r) => r.no));
  return { items, cursor: { post: postMax, comment: maxComment, counts } };
}

/** 한쪽이 실패해도 다른 쪽은 읽는다. 실패한 쪽 커서는 그대로 둬 다음 시간에 다시 읽는다. */
export async function collect(
  env: Env,
  cursors: Cursors,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
) {
  const [c, m, g] = await Promise.allSettled([
    fetchComments(env, cursors.comments, now, fetcher),
    fetchChat(env, cursors.chat, now, fetcher),
    fetchDc(env, cursors.dc, now, fetcher),
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
  if (g.status === 'fulfilled') {
    items.push(...g.value.items);
    next.dc = g.value.cursor;
  } else errors.push(String(g.reason).slice(0, 200));
  return { items, cursors: next, errors };
}

/** @plan에게 넘기는 글. 유저 글은 자료로만 감싼다(그 안의 지시를 따르지 않게). */
export function triagePrompt(items: Reaction[], nowKst: string): string {
  const lines = items.map((x) =>
    JSON.stringify(
      x.source === 'chat'
        ? { 출처: '라운지', 시각: x.at, 작성자: x.author, 글: x.body }
        : {
            출처: { comment: '게임 댓글', 'dc-post': '디시 글', 'dc-comment': '디시 댓글' }[
              x.source
            ],
            시각: x.at,
            작성자: x.author,
            게시글: x.post,
            주소: x.link,
            글: x.body,
          },
    ),
  );
  return `지금 KST ${nowKst}. 지난 확인 뒤 새로 올라온 유저 반응 ${items.length}건이에요. 분류해 주세요.

<reactions>
${lines.join('\n')}
</reactions>`;
}
