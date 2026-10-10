import type { Bindings } from '../env.js';
import { postExpo } from './transport.js';
import { kstDay } from '@offside/contracts/kst';
import { latePushResult } from './result.js';

const BATCH = 100;
const MINUTE = 60_000;
const iso = (at: number) => new Date(at).toISOString();
// 신청 취소·수락·친구 끊기·차단 뒤에는 지난 이벤트를 OS 알림으로 보내지 않는다.
const SOCIAL_ELIGIBLE = `CASE
  WHEN n.source_key LIKE 'friend-request:%' THEN EXISTS (
    SELECT 1 FROM friends f WHERE f.profile_id = q.profile_id AND f.state = 'received'
      AND f.friend_id = substr(n.source_key, 16, instr(substr(n.source_key, 16), ':') - 1)
      AND NOT EXISTS (SELECT 1 FROM board_blocks b WHERE
        (b.profile_id = f.profile_id AND b.blocked_profile_id = f.friend_id) OR
        (b.profile_id = f.friend_id AND b.blocked_profile_id = f.profile_id)))
  WHEN n.source_key LIKE 'friend-accepted:%' THEN EXISTS (
    SELECT 1 FROM friends f WHERE f.profile_id = q.profile_id AND f.state = 'accepted'
      AND f.friend_id = substr(n.source_key, 17, instr(substr(n.source_key, 17), ':') - 1)
      AND NOT EXISTS (SELECT 1 FROM board_blocks b WHERE
        (b.profile_id = f.profile_id AND b.blocked_profile_id = f.friend_id) OR
        (b.profile_id = f.friend_id AND b.blocked_profile_id = f.profile_id)))
  WHEN n.source_key LIKE 'friendly:%' THEN EXISTS (
    SELECT 1 FROM friend_matches m JOIN friends f ON f.profile_id = m.opponent_id AND f.friend_id = m.profile_id
    WHERE m.id = substr(n.source_key, 10) AND m.opponent_id = q.profile_id AND f.state = 'accepted'
      AND NOT EXISTS (SELECT 1 FROM board_blocks b WHERE
        (b.profile_id = f.profile_id AND b.blocked_profile_id = f.friend_id) OR
        (b.profile_id = f.friend_id AND b.blocked_profile_id = f.profile_id)))
  ELSE 1 END`;
type Row = {
  id: string;
  notification_id: string;
  installation_hash: string;
  session_id: string;
  profile_id: string;
  token: string;
  title: string;
  body: string;
  kind: string;
  target_json: string;
  ticket_id: string | null;
  attempts: number;
  expires_at: string;
  eligible: number;
};
/** 알림 원본의 이동 대상. 읽을 수 없으면 null(앱은 알림함을 연다). */
function targetOf(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}
type Outcome = {
  state: 'pending' | 'accepted' | 'confirmed' | 'unknown' | 'failed' | 'cancelled';
  due: number;
  ticket?: string;
  remove?: boolean;
};
type Ticket = { status?: string; id?: string; details?: { error?: string } };
const retry = (r: Row, now: number): Outcome => ({
  state: r.attempts < 4 ? 'pending' : 'failed',
  due: now + 5 * MINUTE * 2 ** (r.attempts - 1),
});

/** T-11-145 컵 알림(source_key cup·cup-match). */
const IS_CUP = "source_key LIKE 'cup%'";

/**
 * 같은 이벤트의 여러 기기·재시도는 예산 하나를 공유한다. 서로 다른 이벤트는 한 시간·하루 2회로 제한한다.
 * T-11-161 컵 알림(추첨·경기 결과)은 제때 가야 해서 이 제한을 받지 않는다. 예약 시각도 남기지 않아 다른 알림의 예산을 쓰지 않는다.
 */
async function reserveBudget(db: D1Database, rows: Row[], now: number) {
  const ids = [...new Set(rows.map((r) => r.notification_id))];
  if (!ids.length) return new Set<string>();
  const start = new Date(`${kstDay(iso(now))}T00:00:00+09:00`).toISOString();
  const results = await db.batch(
    ids.map((id) =>
      db
        .prepare(
          `UPDATE notifications SET push_reserved_at = CASE WHEN ${IS_CUP} THEN NULL ELSE COALESCE(push_reserved_at, ?) END
    WHERE id = ? AND read_at IS NULL AND (${IS_CUP} OR push_reserved_at IS NOT NULL OR (
      (SELECT COUNT(*) FROM notifications q WHERE q.profile_id = notifications.profile_id AND q.push_reserved_at >= ?) < 2
      AND NOT EXISTS (SELECT 1 FROM notifications q WHERE q.profile_id = notifications.profile_id AND q.push_reserved_at > ?)))
    RETURNING id`,
        )
        .bind(iso(now), id, start, iso(now - 60 * MINUTE)),
    ),
  );
  return new Set(results.flatMap((r) => r.results.map((row) => (row as { id: string }).id)));
}

/** T-11-145 컵 알림만 조용한 시간 앞부분에도 보낸다. */
const CUP_PUSH_UNTIL_HOUR = 22;
const CUP_ONLY = ` AND notification_id IN (SELECT id FROM notifications WHERE ${IS_CUP})`;

async function claim(
  db: D1Database,
  checking: boolean,
  now: number,
  lease: string,
  cupOnly = false,
) {
  const from = checking ? 'accepted' : 'pending';
  const state = checking ? 'checking' : 'sending';
  await db
    .prepare(
      `UPDATE push_deliveries SET state = ?, lease_id = ?, due_at = ?, updated_at = ?,
    attempts = attempts + ?, receipt_attempts = receipt_attempts + ?
    WHERE id IN (SELECT id FROM push_deliveries WHERE state = ? AND due_at <= ?${cupOnly ? CUP_ONLY : ''} ORDER BY due_at LIMIT ${BATCH})`,
    )
    .bind(
      state,
      lease,
      iso(now + 2 * MINUTE),
      iso(now),
      checking ? 0 : 1,
      checking ? 1 : 0,
      from,
      iso(now),
    )
    .run();
  const rows = await db
    .prepare(
      `SELECT q.*, n.title, n.body, n.kind, n.target_json,
    CASE WHEN d.token = q.token AND d.session_id = q.session_id AND d.profile_id = q.profile_id
      AND d.updated_at >= ? AND s.channel = 'app' AND s.profile_id = q.profile_id
      AND s.revoked_at IS NULL AND s.expires_at > ? AND p.deleted_at IS NULL AND p.id IS NOT NULL
      AND n.read_at IS NULL AND n.expires_at > ? AND q.expires_at > ?
      AND CASE n.kind WHEN 'team' THEN COALESCE(pref.team, 1) WHEN 'market' THEN COALESCE(pref.market, 1)
        WHEN 'social' THEN COALESCE(pref.social, 1) ELSE 1 END = 1
      AND (n.kind <> 'social' OR ${SOCIAL_ELIGIBLE} = 1)
      AND (n.kind <> 'return' OR NOT EXISTS (SELECT 1 FROM push_devices active WHERE active.profile_id = q.profile_id AND active.updated_at > ?))
      THEN 1 ELSE 0 END AS eligible
    FROM push_deliveries q JOIN notifications n ON n.id = q.notification_id
    LEFT JOIN push_devices d ON d.installation_hash = q.installation_hash
    LEFT JOIN sessions s ON s.id = q.session_id LEFT JOIN profiles p ON p.id = q.profile_id
    LEFT JOIN push_preferences pref ON pref.profile_id = q.profile_id
    WHERE q.state = ? AND q.lease_id = ?`,
    )
    .bind(
      iso(now - 90 * 86400_000),
      iso(now),
      iso(now),
      iso(now),
      iso(now - 7 * 86400_000),
      state,
      lease,
    )
    .all<Row>();
  return rows.results;
}
async function send(
  env: Bindings,
  rows: Row[],
  now: number,
  transport: typeof fetch,
): Promise<Outcome[]> {
  try {
    const response = await postExpo(
      env,
      'send',
      rows.map((r) => ({
        to: r.token,
        title: r.title,
        body: r.body.slice(0, 160),
        channelId: 'news',
        sound: 'default',
        ttl: 3600,
        // T-11-142 kind·target이 있으면 새 앱은 알림함을 거치지 않고 그 화면으로 바로 연다(옛 앱은 무시하고 알림함을 연다).
        data: {
          type: 'offside-notification',
          notificationId: r.notification_id,
          kind: r.kind,
          target: targetOf(r.target_json),
        },
      })),
      transport,
    );
    if (response.status === 429 || response.status >= 500) return rows.map((r) => retry(r, now));
    if (!response.ok) return rows.map(() => ({ state: 'failed', due: now }));
    const payload = (await response.json()) as { data?: Ticket[] };
    return rows.map((r, i) => {
      const t = Array.isArray(payload?.data) ? payload.data[i] : undefined;
      if (t?.status === 'ok' && typeof t.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(t.id))
        return { state: 'accepted', due: now + 15 * MINUTE, ticket: t.id };
      if (t?.status === 'error') {
        if (t.details?.error === 'MessageRateExceeded') return retry(r, now);
        return { state: 'failed', due: now, remove: t.details?.error === 'DeviceNotRegistered' };
      }
      return { state: 'unknown', due: now };
    });
  } catch {
    return rows.map(() => ({ state: 'unknown', due: now }));
  }
}
async function receipts(
  env: Bindings,
  rows: Row[],
  now: number,
  transport: typeof fetch,
): Promise<Outcome[]> {
  const later = (r: Row): Outcome => ({
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
async function finish(db: D1Database, rows: Row[], results: Outcome[], now: number, lease: string) {
  if (!rows.length) return;
  const writes: D1PreparedStatement[] = [];
  rows.forEach((r, i) => {
    const o = results[i]!;
    writes.push(
      db
        .prepare(
          `UPDATE push_deliveries SET state = ?, due_at = ?, ticket_id = COALESCE(?, ticket_id),
      token = CASE WHEN ? IN ('pending', 'accepted') THEN token ELSE '' END, lease_id = NULL, updated_at = ?
      WHERE id = ? AND lease_id = ? AND state IN ('sending', 'checking')`,
        )
        .bind(o.state, iso(o.due), o.ticket ?? null, o.state, iso(now), r.id, lease),
      latePushResult(db, 'push_deliveries', r.id, o.state, iso(now)),
    );
    if (o.remove)
      for (const table of ['push_devices', 'push_news_deliveries', 'push_deliveries']) {
        writes.push(
          db
            .prepare(
              `DELETE FROM ${table} WHERE installation_hash = ? AND token = ? AND session_id = ? AND profile_id = ?`,
            )
            .bind(r.installation_hash, r.token, r.session_id, r.profile_id),
        );
      }
  });
  await db.batch(writes);
}

/** 기능 이벤트용 공용 큐 소비자. 실행 중단·불명확 응답은 재발송하지 않고 개인 원본 기록은 유지한다. */
export async function runPersonalPush(
  env: Bindings,
  now = Date.now(),
  transport: typeof fetch = fetch,
) {
  if (env.ENVIRONMENT !== 'production' || env.PERSONAL_PUSH_ENABLED !== '1')
    return { enabled: false };
  const lease = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE push_deliveries SET state = 'unknown', token = '', lease_id = NULL, updated_at = ? WHERE state = 'sending' AND due_at <= ?",
    ).bind(iso(now), iso(now)),
    env.DB.prepare(
      "UPDATE push_deliveries SET state = 'accepted', lease_id = NULL WHERE state = 'checking' AND due_at <= ?",
    ).bind(iso(now)),
  ]);
  const states: Partial<Record<Outcome['state'], number>> = {};
  const hour = new Date(now + 9 * 3600_000).getUTCHours();
  for (const checking of [true, false, false, false]) {
    // 조용한 시간에는 영수증만 확인한다. 수동 본인 테스트는 별도의 요청 경로다. T-11-145 컵 알림만 22시까지 보낸다
    // (경기가 밤 9시라 결과를 다음 날 아침으로 미루지 않게).
    const cupOnly = hour >= 20 && hour < CUP_PUSH_UNTIL_HOUR;
    if (!checking && (hour < 9 || (hour >= 20 && !cupOnly))) break;
    const rows = await claim(env.DB, checking, now, lease, !checking && cupOnly);
    const eligible = checking ? rows : rows.filter((r) => r.eligible === 1);
    const reserved = checking ? null : await reserveBudget(env.DB, eligible, now);
    const active = checking ? eligible : eligible.filter((r) => reserved!.has(r.notification_id));
    const results = active.length
      ? await (checking ? receipts : send)(env, active, now, transport)
      : [];
    const indexed = new Map(active.map((r, i) => [r.id, results[i]!]));
    const outcomes = rows.map(
      (r) => indexed.get(r.id) ?? { state: 'cancelled' as const, due: now },
    );
    await finish(env.DB, rows, outcomes, now, lease);
    outcomes.forEach((r) => {
      states[r.state] = (states[r.state] ?? 0) + 1;
    });
    if (!checking && rows.length < BATCH) break;
  }
  console.log(JSON.stringify({ job: 'personal-push', ts: iso(now), states }));
  return { enabled: true, states };
}
