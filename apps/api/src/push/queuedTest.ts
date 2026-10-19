import type { Bindings } from '../env.js';
import { AppError } from '../errors.js';
import { sendPushTest } from './expo.js';
import { latePushResult } from './result.js';
import type { PushWork } from './queuePublish.js';

type TestRow = {
  id: string;
  notification_id: string;
  installation_hash: string;
  session_id: string;
  token: string;
};
export async function runQueuedPushTest(
  env: Bindings,
  work: Extract<PushWork, { kind: 'test' }>,
  now: number,
  transport: typeof fetch,
) {
  if (env.ENVIRONMENT !== 'production' || env.PUSH_TEST_ENABLED !== '1') return false;
  const at = new Date(now).toISOString();
  // Atomic claim: re-delivery, logout, token rotation, account deletion and expiry cannot send stale tests.
  const row = await env.DB.prepare(
    `UPDATE push_deliveries SET state='sending', attempts=attempts+1, due_at=?, updated_at=?
     WHERE id=? AND state='pending' AND expires_at>? AND EXISTS (
       SELECT 1 FROM push_devices d JOIN sessions s ON s.id=d.session_id JOIN profiles p ON p.id=d.profile_id
       WHERE d.installation_hash=push_deliveries.installation_hash AND d.token=push_deliveries.token
       AND d.session_id=push_deliveries.session_id AND d.profile_id=push_deliveries.profile_id
       AND s.profile_id=d.profile_id AND s.channel='app' AND s.revoked_at IS NULL AND s.expires_at>?
       AND p.deleted_at IS NULL AND d.updated_at>=?)
     RETURNING id,notification_id,installation_hash,session_id,token`,
  )
    .bind(
      new Date(now + 120_000).toISOString(),
      at,
      work.id,
      at,
      at,
      new Date(now - 90 * 86400_000).toISOString(),
    )
    .first<TestRow>();
  if (!row) {
    await env.DB.prepare(
      "UPDATE push_deliveries SET state='cancelled',token='',updated_at=? WHERE id=? AND state='pending'",
    )
      .bind(at, work.id)
      .run();
    return false;
  }
  let state: 'accepted' | 'failed' | 'unknown';
  let ticket: string | null = null;
  let remove = false;
  try {
    ticket = await sendPushTest(
      row.token,
      env.EXPO_PUSH_ACCESS_TOKEN,
      transport,
      row.notification_id,
      work.lang,
    );
    state = 'accepted';
  } catch (e) {
    const reason = e instanceof AppError && (e.details as { reason?: string } | undefined)?.reason;
    state = reason ? 'failed' : 'unknown';
    remove = reason === 'PUSH_DEVICE_NOT_REGISTERED';
  }
  // Persist after transport outside the catch: a DB failure must not change an accepted send to failed.
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE push_deliveries SET state=?,ticket_id=?,due_at=?,updated_at=?,token=CASE WHEN ?='accepted' THEN token ELSE '' END WHERE id=? AND state='sending'",
    ).bind(state, ticket, new Date(now + 900_000).toISOString(), at, state, row.id),
    latePushResult(env.DB, 'push_deliveries', row.id, state, at),
    env.DB.prepare(
      'UPDATE push_devices SET last_test_ticket_id=?,last_test_sent_at=? WHERE installation_hash=? AND token=? AND session_id=? AND ? IS NOT NULL',
    ).bind(ticket, at, row.installation_hash, row.token, row.session_id, ticket),
  ]);
  if (remove)
    await env.DB.batch(
      ['push_devices', 'push_deliveries', 'push_news_deliveries'].map((table) =>
        env.DB.prepare(
          `DELETE FROM ${table} WHERE installation_hash=? AND token=? AND session_id=?`,
        ).bind(row.installation_hash, row.token, row.session_id),
      ),
    );
  return true;
}
