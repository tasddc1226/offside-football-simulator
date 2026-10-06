import type { Context } from 'hono';
import type { AppEnv, Bindings } from '../env.js';
import { postExpo } from './transport.js';
import { latePushResult } from './result.js';

const BATCH = 100;
const MINUTE = 60_000;
const iso = (time: number) => new Date(time).toISOString();
type State = 'pending' | 'accepted' | 'confirmed' | 'failed' | 'unknown' | 'cancelled';
type Delivery = {
  notification_id: string | null;
  id: string;
  installation_hash: string;
  session_id: string;
  profile_id: string;
  token: string;
  ticket_id: string | null;
  attempts: number;
  receipt_attempts: number;
  board: 'notice' | 'release';
  post_id: string;
  title: string;
  expires_at: string;
  eligible: number;
};
type Ticket = { status?: string; id?: string; details?: { error?: string } };
type Result = { state: State; due: number; ticket?: string; remove?: boolean };

/** 유효 기기만 다시 확인한다. 로그아웃·동의 철회·계정/토큰 전환·삭제된 글에는 보내지 않는다. */
async function claim(db: D1Database, receipts: boolean, now: number, lease: string) {
  const from = receipts ? 'accepted' : 'pending';
  const to = receipts ? 'checking' : 'sending';
  await db
    .prepare(
      `UPDATE push_news_deliveries SET state = ?, lease_id = ?, due_at = ?, updated_at = ?,
      attempts = attempts + ?, receipt_attempts = receipt_attempts + ?
    WHERE id IN (SELECT id FROM push_news_deliveries WHERE state = ? AND due_at <= ? ORDER BY due_at LIMIT ${BATCH})`,
    )
    .bind(
      to,
      lease,
      iso(now + 2 * MINUTE),
      iso(now),
      receipts ? 0 : 1,
      receipts ? 1 : 0,
      from,
      iso(now),
    )
    .run();
  const rows = await db
    .prepare(
      `SELECT q.*, e.board, e.post_id, e.title, e.expires_at, n.id AS notification_id,
      CASE WHEN d.installation_hash IS NOT NULL AND d.token = q.token AND d.session_id = q.session_id
        AND d.profile_id = q.profile_id AND d.updated_at >= ? AND s.channel = 'app'
        AND s.profile_id = q.profile_id AND s.revoked_at IS NULL AND s.expires_at > ?
        AND p.deleted_at IS NULL AND p.id IS NOT NULL AND b.deleted_at IS NULL AND b.id IS NOT NULL
        AND e.expires_at > ?
        AND CASE e.board WHEN 'notice' THEN COALESCE(pref.notice, 1) ELSE COALESCE(pref.release, 1) END = 1
        THEN 1 ELSE 0 END AS eligible
    FROM push_news_deliveries q JOIN push_news_events e ON e.id = q.event_id
    LEFT JOIN push_devices d ON d.installation_hash = q.installation_hash
    LEFT JOIN sessions s ON s.id = q.session_id LEFT JOIN profiles p ON p.id = q.profile_id
    LEFT JOIN push_preferences pref ON pref.profile_id = q.profile_id
    LEFT JOIN board_posts b ON b.id = e.post_id
    LEFT JOIN notifications n ON n.profile_id = q.profile_id AND n.source_key = 'news:' || e.id
    WHERE q.state = ? AND q.lease_id = ?`,
    )
    .bind(iso(now - 90 * 86400_000), iso(now), iso(now), to, lease)
    .all<Delivery>();
  return rows.results;
}

function ticketResult(ticket: Ticket | undefined, row: Delivery, now: number): Result {
  if (
    ticket?.status === 'ok' &&
    typeof ticket.id === 'string' &&
    /^[A-Za-z0-9_-]{1,100}$/.test(ticket.id)
  )
    return { state: 'accepted', due: now + 15 * MINUTE, ticket: ticket.id };
  if (ticket?.status === 'error') {
    if (ticket.details?.error === 'MessageRateExceeded') return retry(row, now);
    return { state: 'failed', due: now, remove: ticket.details?.error === 'DeviceNotRegistered' };
  }
  // 접수 여부가 불명확한 결과는 재발송하지 않는다(Expo는 idempotency key를 지원하지 않는다).
  return { state: 'unknown', due: now };
}
const retry = (row: Delivery, now: number): Result => ({
  state: row.attempts < 4 ? 'pending' : 'failed',
  due: now + 5 * MINUTE * 2 ** (row.attempts - 1),
});

async function finish(
  db: D1Database,
  rows: Delivery[],
  results: Result[],
  lease: string,
  now: number,
) {
  if (!rows.length) return;
  const writes: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const result = results[i]!;
    writes.push(
      db
        .prepare(
          `UPDATE push_news_deliveries
      SET state = ?, due_at = ?, ticket_id = COALESCE(?, ticket_id), lease_id = NULL, updated_at = ?,
        token = CASE WHEN ? IN ('pending', 'accepted') THEN token ELSE '' END
      WHERE id = ? AND lease_id = ? AND state IN ('sending', 'checking')`,
        )
        .bind(
          result.state,
          iso(result.due),
          result.ticket ?? null,
          iso(now),
          result.state,
          r.id,
          lease,
        ),
      latePushResult(db, 'push_news_deliveries', r.id, result.state, iso(now)),
    );
    if (result.remove)
      writes.push(
        db
          .prepare(
            `DELETE FROM push_devices
      WHERE installation_hash = ? AND token = ? AND session_id = ? AND profile_id = ?`,
          )
          .bind(r.installation_hash, r.token, r.session_id, r.profile_id),
      );
  }
  await db.batch(writes);
}

async function send(
  env: Bindings,
  rows: Delivery[],
  now: number,
  transport: typeof fetch,
): Promise<Result[]> {
  try {
    const response = await postExpo(
      env,
      'send',
      rows.map((r) => ({
        to: r.token,
        title: r.board === 'notice' ? '오프사이드 공지' : '오프사이드 릴리즈 노트',
        body: r.title.slice(0, 160),
        channelId: 'news',
        sound: 'default',
        ttl: 3600,
        data: {
          type: 'offside-news',
          board: r.board,
          postId: r.post_id,
          ...(r.notification_id ? { notificationId: r.notification_id } : {}),
        },
      })),
      transport,
    );
    if (response.status === 429 || response.status >= 500) return rows.map((r) => retry(r, now));
    if (!response.ok) return rows.map(() => ({ state: 'failed', due: now }));
    const payload = (await response.json()) as { data?: Ticket[] };
    return rows.map((r, i) =>
      ticketResult(Array.isArray(payload?.data) ? payload.data[i] : undefined, r, now),
    );
  } catch {
    // 타임아웃 이후 Expo가 이미 접수했을 수 있다. 중복 대신 상태 불명으로 남긴다.
    return rows.map(() => ({ state: 'unknown', due: now }));
  }
}

async function receipts(
  env: Bindings,
  rows: Delivery[],
  now: number,
  transport: typeof fetch,
): Promise<Result[]> {
  const later = (r: Delivery): Result => ({
    state: Date.parse(r.expires_at) > now ? 'accepted' : 'unknown',
    due: now + 15 * MINUTE,
  });
  try {
    const response = await postExpo(
      env,
      'getReceipts',
      { ids: rows.map((r) => r.ticket_id) },
      transport,
    );
    if (!response.ok) return rows.map(later);
    const payload = (await response.json()) as { data?: Record<string, Ticket> };
    return rows.map((r) => {
      const receipt = payload?.data?.[r.ticket_id!];
      if (receipt?.status === 'ok') return { state: 'confirmed', due: now };
      if (receipt?.status === 'error')
        return {
          state: 'failed',
          due: now,
          remove: receipt.details?.error === 'DeviceNotRegistered',
        };
      return later(r);
    });
  } catch {
    return rows.map(later);
  }
}

/** 소량 즉시 처리 + 5분 cron에서 이어 처리. 겹친 실행은 원자적 lease로 한 번만 접수한다. */
export async function runNewsPush(
  env: Bindings,
  now = Date.now(),
  transport: typeof fetch = fetch,
  sendBatches: 1 | 3 = 3,
) {
  if (env.ENVIRONMENT !== 'production' || env.NEWS_PUSH_ENABLED !== '1') return { enabled: false };
  const lease = crypto.randomUUID();
  const db = env.DB;
  // Worker 중단 이후 sending은 재발송하지 않는다. receipt 조회는 안전하게 다시 할 수 있다.
  await db.batch([
    db
      .prepare(
        `UPDATE push_news_deliveries SET state = 'unknown', token = '', lease_id = NULL, updated_at = ?
      WHERE state = 'sending' AND due_at <= ?`,
      )
      .bind(iso(now), iso(now)),
    db
      .prepare(
        `UPDATE push_news_deliveries SET state = 'accepted', lease_id = NULL
      WHERE state = 'checking' AND due_at <= ?`,
      )
      .bind(iso(now)),
  ]);
  const states: Partial<Record<State, number>> = {};
  // 영수증 100건 + 발송 최대 300건. 요청·cron 한 번의 부하를 제한하며 남은 큐는 다음 cron이 잇는다.
  for (const checking of [true, ...Array.from({ length: sendBatches }, () => false)]) {
    const rows = await claim(db, checking, now, lease);
    const active = checking ? rows : rows.filter((r) => r.eligible === 1);
    const outcomes = active.length
      ? await (checking ? receipts : send)(env, active, now, transport)
      : [];
    const mapped = new Map(active.map((r, i) => [r.id, outcomes[i]!]));
    const results = rows.map((r) => mapped.get(r.id) ?? { state: 'cancelled' as const, due: now });
    await finish(db, rows, results, lease, now);
    for (const r of results) states[r.state] = (states[r.state] ?? 0) + 1;
    if (!checking && rows.length < BATCH) break;
  }
  console.log(JSON.stringify({ job: 'news-push', ts: iso(now), states }));
  return { enabled: true, states };
}

/** 발송 실패가 공지 저장 응답을 바꾸지 않는다. 영구 outbox는 cron이 이어 처리한다. */
export function kickNewsPush(c: Context<AppEnv>) {
  if (c.env.NEWS_PUSH_ENABLED !== '1' || c.env.ENVIRONMENT !== 'production') return;
  c.executionCtx.waitUntil(
    // 요청 종료 후 waitUntil은 30초 한도. 외부 요청 최대 두 번(각 10초)으로 제한한다.
    runNewsPush(c.env, Date.now(), fetch, 1).catch(() => {
      console.error(JSON.stringify({ job: 'news-push', error: 'DISPATCH_FAILED' }));
    }),
  );
}
