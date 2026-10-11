import type { CupDef } from '@offside/contracts/cup';
import type { Bindings } from '../env.js';
import { cupKo, cupTitle } from '../cupText.js';
import { runPersonalPush } from './personal.js';

export const cupResultSource = (cupId: string) => `cup-complete:${cupId}`;
const validCup = (id: unknown): id is string =>
  typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);

/** Append directly after the guarded done_at update in the final reward transaction. */
export function cupResultStatements(db: D1Database, cup: CupDef, now: string) {
  const source = cupResultSource(cup.id);
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO notifications
      (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
      SELECT 'ntf_' || lower(hex(randomblob(16))), p.id, ?, 'team', ?,
        CASE WHEN EXISTS (SELECT 1 FROM cup_entries e WHERE e.cup_id=? AND e.profile_id=p.id
          AND e.status IN ('active','out','champion')) THEN ?
        WHEN EXISTS (SELECT 1 FROM cup_predictions pr WHERE pr.cup_id=? AND pr.profile_id=p.id
          AND pr.rewarded_at IS NOT NULL) THEN ? ELSE ? END,
        '{"type":"screen","screen":"home"}', ?, ?
      FROM (SELECT profile_id FROM cup_entries WHERE cup_id=? AND status IN ('active','out','champion')
        UNION SELECT profile_id FROM cup_predictions WHERE cup_id=?) audience
      JOIN profiles p ON p.id=audience.profile_id
      WHERE changes()>0 AND p.deleted_at IS NULL`,
      )
      .bind(
        source,
        cupKo('completeTitle', { cup: cupTitle(cup) }),
        cup.id,
        cupKo('completeBody'),
        cup.id,
        cupKo('predictionRewardBody'),
        cupKo('predictionResultBody'),
        now,
        new Date(Date.parse(now) + 90 * 86400_000).toISOString(),
        cup.id,
        cup.id,
      ),
    // Freeze one valid device per account at completion. Re-registration cannot add recipients.
    db
      .prepare(
        `INSERT OR IGNORE INTO push_deliveries
      (id, notification_id, installation_hash, session_id, profile_id, token, due_at, expires_at, updated_at)
      SELECT n.id || ':' || d.installation_hash, n.id, d.installation_hash, d.session_id, d.profile_id,
        d.token, ?, ?, ? FROM notifications n JOIN push_devices d ON d.profile_id=n.profile_id
      LEFT JOIN push_preferences pref ON pref.profile_id=n.profile_id
      WHERE changes()>0 AND n.source_key=? AND n.created_at=? AND COALESCE(pref.team,1)=1
        AND d.installation_hash=(SELECT latest.installation_hash FROM push_devices latest
          JOIN sessions s ON s.id=latest.session_id WHERE latest.profile_id=n.profile_id
            AND s.profile_id=latest.profile_id AND s.channel='app' AND s.revoked_at IS NULL
            AND s.expires_at>? AND latest.updated_at>=?
          ORDER BY latest.updated_at DESC, latest.installation_hash DESC LIMIT 1)`,
      )
      .bind(
        now,
        new Date(Date.parse(now) + 86400_000).toISOString(),
        now,
        source,
        now,
        now,
        new Date(Date.parse(now) - 90 * 86400_000).toISOString(),
      ),
  ];
}

/** D1 is the outbox; missed Queue publishes are recovered by the existing cron dispatcher. */
export async function publishCupResults(env: Bindings, cupIds: string[]) {
  if (env.ENVIRONMENT !== 'production' || env.PERSONAL_PUSH_ENABLED !== '1' || !env.CUP_PUSH_QUEUE)
    return;
  const ids = [...new Set(cupIds)].filter(validCup);
  if (!ids.length) return;
  try {
    for (let i = 0; i < ids.length; i += 100)
      await env.CUP_PUSH_QUEUE.sendBatch(
        ids
          .slice(i, i + 100)
          .map((cupId) => ({ body: { version: 1 as const, cupId }, contentType: 'json' as const })),
      );
  } catch {
    console.error(JSON.stringify({ job: 'cup-result-publish', fallback: 'cron' }));
  }
}

export async function consumeCupResults(
  batch: MessageBatch<unknown>,
  env: Bindings,
  now = Date.now(),
  transport: typeof fetch = fetch,
) {
  if (env.ENVIRONMENT !== 'production' || env.PERSONAL_PUSH_ENABLED !== '1') {
    batch.ackAll();
    return;
  }
  for (const message of batch.messages) {
    const body = message.body as { version?: unknown; cupId?: unknown } | null;
    if (!body || body.version !== 1 || !validCup(body.cupId)) {
      message.ack();
      continue;
    }
    try {
      await runPersonalPush(env, now, transport, { cupResult: cupResultSource(body.cupId) });
      const pending = await env.DB.prepare(
        `SELECT MIN(q.due_at) AS due FROM push_deliveries q
        JOIN notifications n ON n.id=q.notification_id WHERE n.kind='team' AND n.source_key=? AND q.state='pending'`,
      )
        .bind(cupResultSource(body.cupId))
        .first<{ due: string | null }>();
      if (!pending?.due) {
        message.ack();
        continue;
      }
      const kst = new Date(now + 9 * 3600_000);
      const hour = kst.getUTCHours();
      const quietDelay =
        hour < 9
          ? (9 - hour) * 3600 - kst.getUTCMinutes() * 60
          : hour >= 22
            ? (33 - hour) * 3600 - kst.getUTCMinutes() * 60
            : 0;
      message.retry({
        delaySeconds: Math.max(
          1,
          quietDelay,
          Math.min(86400, Math.ceil((Date.parse(pending.due) - now) / 1000)),
        ),
      });
    } catch {
      console.error(JSON.stringify({ job: 'cup-result-consume', retry: true }));
      message.retry({ delaySeconds: 60 });
    }
  }
}
