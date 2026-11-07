import type { Bindings } from '../env.js';
import { notifyHook, postNotify } from '../notifyHook.js';

// T-11-616 새 신고 알림. 이름 신고 · 채팅 신고 · 게시판 댓글 신고 · 팀 댓글 신고가 들어오면 운영 알림 채널(결제 · 컵 · 리그 경보와
// 같은 웹훅)에 5분 단위로 묶어 한 글로 알린다. 신고 요청 안에서 보내지 않으니 알림이 실패해도 신고는 그대로 저장되고,
// 신고를 여러 계정으로 쏟아 부어도 5분에 글 하나다. 같은 신고를 두 번 알리지 않게 app_meta에 "어디까지 알렸는지" 한 줄을 둔다.
// 글에는 운영자가 판단할 이름 · 대상 ID만 넣고 채팅 · 댓글 본문은 넣지 않는다(운영 도구에서 본다).

export const REPORT_ALERT_KEY = 'report-alert:cursor';
/** 막 들어온 신고가 아직 커밋되기 전의 틈(신고 요청은 시각을 먼저 잡고 나중에 쓴다). */
const SETTLE_MS = 30_000;
/** 알림 기록이 없을 때 되짚는 시간 · 멈췄다 돌 때 되짚는 상한. */
const FIRST_LOOKBACK_MS = 10 * 60_000;
const MAX_LOOKBACK_MS = 24 * 3600_000;
/** 표마다 읽는 대상 수(+1은 "더 있음" 판단) · 글에 보여 주는 줄 수. */
const FETCH = 26;
const SHOW = 8;
/** 운영 알림 문장(운영 도구처럼 한국어로 둔다). 줄마다 i18n-ignore. */
const TEXT = {
  nameKind: { career: '선수', team: '구단', owner: '구단주 닉네임' } as Record<string, string>, // i18n-ignore
  count: (n: number) => (n >= FETCH ? `${FETCH - 1}건 넘게` : `${n}건`), // i18n-ignore
  rest: (n: number) => (n >= FETCH ? `외 ${FETCH - 1 - SHOW}건 넘게` : `외 ${n - SHOW}건`), // i18n-ignore
  people: (n: number) => (n > 1 ? ` · ${n}명이 신고` : ''), // i18n-ignore
  names: '이름 신고', // i18n-ignore
  chats: '채팅 신고', // i18n-ignore
  board: '게시판 댓글 신고', // i18n-ignore
  team: '팀 댓글 신고', // i18n-ignore
  head: (a: string, b: string) => `**새 신고** (KST ${a}~${b})`, // i18n-ignore
  foot: '운영 도구의 신고 목록에서 확인하고 처리해 주세요.', // i18n-ignore
  nameLine: (kind: string, id: string, name: string) => `${kind} \`${id}\` "${name}"`, // i18n-ignore
  chatLine: (id: string, room: string, why: string, nick: string) =>
    `메시지 \`${id}\` · 방 ${room} · 사유 ${why} · 작성자 "${nick}"`, // i18n-ignore
  commentLine: (id: string, why: string) => `댓글 \`${id}\` · 사유 ${why}`, // i18n-ignore
};

type NameRow = { kind: string; target_id: string; name: string; n: number };
type ChatRow = { message_id: string; room: string; nickname: string; reasons: string; n: number };
type CommentRow = { comment_id: string; reasons: string; n: number };
export type ReportBatch = {
  names: NameRow[];
  chats: ChatRow[];
  boardComments: CommentRow[];
  teamComments: CommentRow[];
};

const iso = (ms: number) => new Date(ms).toISOString();
const clock = (at: string) => new Date(Date.parse(at) + 9 * 3600_000).toISOString().slice(11, 16);

/** 사용자가 쓴 이름을 글에 넣을 때: 개행 · 제어 문자를 없애고 디스코드 서식 · 멘션 문자를 막고 길이를 줄인다. */
export function plainName(raw: string): string {
  const text = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cut = text.length > 24 ? `${text.slice(0, 24)}…` : text;
  return cut.replace(/[\\`*_~|>#<[\]@]/g, '\\$&');
}

/** 알릴 신고가 없으면 null. */
export function reportAlertText(batch: ReportBatch, since: string, until: string): string | null {
  const sections: string[] = [];
  const section = <T>(title: string, rows: T[], line: (r: T) => string) => {
    if (!rows.length) return;
    const shown = rows.slice(0, SHOW).map((r) => `  · ${line(r)}`);
    const more = rows.length > SHOW ? [`  · ${TEXT.rest(rows.length)}`] : [];
    sections.push(`- ${title} ${TEXT.count(rows.length)}`, ...shown, ...more);
  };
  section(TEXT.names, batch.names, (r) => {
    const kind = TEXT.nameKind[r.kind] ?? r.kind;
    return TEXT.nameLine(kind, r.target_id, plainName(r.name)) + TEXT.people(r.n);
  });
  section(
    TEXT.chats,
    batch.chats,
    (r) => TEXT.chatLine(r.message_id, r.room, r.reasons, plainName(r.nickname)) + TEXT.people(r.n),
  );
  section(
    TEXT.board,
    batch.boardComments,
    (r) => TEXT.commentLine(r.comment_id, r.reasons) + TEXT.people(r.n),
  );
  section(
    TEXT.team,
    batch.teamComments,
    (r) => TEXT.commentLine(r.comment_id, r.reasons) + TEXT.people(r.n),
  );
  if (!sections.length) return null;
  return [TEXT.head(clock(since), clock(until)), ...sections, TEXT.foot].join('\n');
}

async function readBatch(db: D1Database, since: string, until: string): Promise<ReportBatch> {
  // T-11-661 네 신고 표를 한 보기(report_feed)로 읽는다. 처리 전 신고만, 같은 대상은 한 줄로 묶고 종류마다 FETCH줄까지.
  // 보기의 WHERE는 표마다 내려가 이름 · 채팅은 resolved_at 인덱스, 댓글은 created_at 인덱스를 탄다.
  const rows = (
    await db
      .prepare(
        `SELECT source, target_kind, target_id, label, room, reasons, n FROM (
           SELECT source, target_kind, target_id, min(label) AS label, min(room) AS room,
                  group_concat(DISTINCT reason) AS reasons, count(*) AS n,
                  row_number() OVER (PARTITION BY source ORDER BY min(created_at)) AS k
             FROM report_feed
            WHERE resolved_at IS NULL AND created_at > ?1 AND created_at <= ?2
            GROUP BY source, target_kind, target_id)
          WHERE k <= ${FETCH}`,
      )
      .bind(since, until)
      .all<{
        source: string;
        target_kind: string;
        target_id: string;
        label: string | null;
        room: string | null;
        reasons: string | null;
        n: number;
      }>()
  ).results;
  const of = (source: string) => rows.filter((r) => r.source === source);
  return {
    names: of('name').map((r) => ({
      kind: r.target_kind,
      target_id: r.target_id,
      name: r.label ?? '',
      n: r.n,
    })),
    chats: of('chat').map((r) => ({
      message_id: r.target_id,
      room: r.room ?? '',
      nickname: r.label ?? '',
      reasons: r.reasons ?? '',
      n: r.n,
    })),
    boardComments: of('board_comment').map((r) => ({
      comment_id: r.target_id,
      reasons: r.reasons ?? '',
      n: r.n,
    })),
    teamComments: of('team_comment').map((r) => ({
      comment_id: r.target_id,
      reasons: r.reasons ?? '',
      n: r.n,
    })),
  };
}

/**
 * 5분 cron 진입점. (알림 기록, until] 사이에 들어온 신고를 한 글로 알린다. 신고가 없으면 DB를 쓰지 않는다.
 * 보내기 전에 기록을 먼저 옮겨(compare-and-set) 같은 신고를 두 번 알리지 않고, 보내지 못하면 기록을 되돌려 다음 틱이 다시 보낸다.
 * 운영 환경에서 웹훅이 있을 때만 돈다. 실패하면 던진다(호출한 쪽이 이름 없는 오류만 남긴다).
 */
export async function alertNewReports(env: Bindings, scheduledTime: number) {
  if (env.ENVIRONMENT !== 'production') return null;
  const hook = notifyHook(env.BILLING_SLACK_WEBHOOK);
  if (!hook) return null;
  const db = env.DB;
  const until = iso(scheduledTime - SETTLE_MS);
  const saved = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(REPORT_ALERT_KEY)
    .first<{ value: string }>();
  const prior = saved?.value;
  const floor = iso(scheduledTime - MAX_LOOKBACK_MS);
  const asked = prior ?? iso(scheduledTime - FIRST_LOOKBACK_MS);
  const since = asked > floor ? asked : floor;
  if (since >= until) return null;
  const batch = await readBatch(db, since, until);
  const text = reportAlertText(batch, since, until);
  if (!text) return null;
  const claimed = prior
    ? await db
        .prepare('UPDATE app_meta SET value = ?1 WHERE key = ?2 AND value = ?3')
        .bind(until, REPORT_ALERT_KEY, prior)
        .run()
    : await db
        .prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?1, ?2)')
        .bind(REPORT_ALERT_KEY, until)
        .run();
  // 다른 틱이 먼저 이 구간을 가져갔다.
  if (!claimed.meta.changes) return null;
  try {
    if (!(await postNotify(hook, { text }))) throw new Error('report alert rejected');
  } catch (e) {
    // 보내지 못했으니 구간을 돌려놓아 다음 틱이 다시 보낸다(되돌리지 못하면 이 구간 알림은 놓친다 — 신고 자체는 그대로다).
    await (
      prior
        ? db
            .prepare('UPDATE app_meta SET value = ?1 WHERE key = ?2 AND value = ?3')
            .bind(prior, REPORT_ALERT_KEY, until)
            .run()
        : db
            .prepare('DELETE FROM app_meta WHERE key = ?1 AND value = ?2')
            .bind(REPORT_ALERT_KEY, until)
            .run()
    ).catch(() => undefined);
    throw e;
  }
  return {
    names: batch.names.length,
    chats: batch.chats.length,
    boardComments: batch.boardComments.length,
    teamComments: batch.teamComments.length,
  };
}
