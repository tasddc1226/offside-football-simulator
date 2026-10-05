import type { Bindings } from '../env.js';
import { postExpo } from './transport.js';
import { kstDay } from '@offside/contracts/kst';

const BATCH = 100;
const MINUTE = 60_000;
const iso = (at: number) => new Date(at).toISOString();
type Row = {
  id: string;
  notification_id: string;
  installation_hash: string;
  session_id: string;
  profile_id: string;
  token: string;
  title: string;
  body: string;
  ticket_id: string | null;
  attempts: number;
  expires_at: string;
  eligible: number;
};
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

/** 같은 이벤트의 여러 기기·재시도는 예산 하나를 공유한다. 서로 다른 이벤트는 한 시간·하루 2회로 제한한다. */
async function reserveBudget(db: D1Database, rows: Row[], now: number) {
  const ids = [...new Set(rows.map((r) => r.notification_id))];
  if (!ids.length) return new Set<string>();
  const start = new Date(`${kstDay(iso(now))}T00:00:00+09:00`).toISOString();
  const results = await db.batch(
    ids.map((id) =>
      db
        .prepare(
          `UPDATE notifications SET push_reserved_at = COALESCE(push_reserved_at, ?)
    WHERE id = ? AND read_at IS NULL AND (push_reserved_at IS NOT NULL OR (
      (SELECT COUNT(*) FROM notifications q WHERE q.profile_id = notifications.profile_id AND q.push_reserved_at >= ?) < 2
      AND NOT EXISTS (SELECT 1 FROM notifications q WHERE q.profile_id = notifications.profile_id AND q.push_reserved_at > ?)))
    RETURNING id`,
        )
        .bind(iso(now), id, start, iso(now - 60 * MINUTE)),
    ),
  );
  return new Set(results.flatMap((r) => r.results.map((row) => (row as { id: string }).id)));
}

async function claim(db: D1Database, checking: boolean, now: number, lease: string) {
  const from = checking ? 'accepted' : 'pending';
  const state = checking ? 'checking' : 'sending';
  await db
    .prepare(
      `UPDATE push_deliveries SET state = ?, lease_id = ?, due_at = ?, updated_at = ?,
    attempts = attempts + ?, receipt_attempts = receipt_attempts + ?
    WHERE id IN (SELECT id FROM push_deliveries WHERE state = ? AND due_at <= ? ORDER BY due_at LIMIT ${BATCH})`,
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
      `SELECT q.*, n.title, n.body,
    CASE WHEN d.token = q.token AND d.session_id = q.session_id AND d.profile_id = q.profile_id
      AND d.engagement_enabled = 1 AND d.updated_at >= ? AND s.channel = 'app' AND s.profile_id = q.profile_id
      AND s.revoked_at IS NULL AND s.expires_at > ? AND p.deleted_at IS NULL AND p.id IS NOT NULL
      AND n.read_at IS NULL AND n.expires_at > ? AND q.expires_at > ?
      AND (n.kind <> 'return' OR NOT EXISTS (SELECT 1 FROM push_devices active WHERE active.profile_id = q.profile_id AND active.updated_at > ?))
      THEN 1 ELSE 0 END AS eligible
    FROM push_deliveries q JOIN notifications n ON n.id = q.notification_id
    LEFT JOIN push_devices d ON d.installation_hash = q.installation_hash
    LEFT JOIN sessions s ON s.id = q.session_id LEFT JOIN profiles p ON p.id = q.profile_id
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
        data: { type: 'offside-notification', notificationId: r.notification_id },
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
    // 조용한 시간에는 영수증만 확인한다. 수동 본인 테스트는 별도의 요청 경로다.
    if (!checking && (hour < 9 || hour >= 20)) break;
    const rows = await claim(env.DB, checking, now, lease);
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
