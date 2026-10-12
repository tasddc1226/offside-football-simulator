import { createDb } from '../db/client.js';
import type { Bindings } from '../env.js';
import { refreshMembershipChain } from './service.js';
import { MemberVerificationError } from './types.js';

/** Small repair batches, explicitly enabled independently of new subscription sales. */
export async function reconcileMemberships(env: Bindings, nowMs: number) {
  if (env.MEMBERSHIP_RECONCILE_ENABLED !== '1') return { checked: 0, failed: 0 };
  const db = createDb(env.DB);
  const d1 = db.$client;
  const now = new Date(nowMs).toISOString();
  const stale = new Date(nowMs - 6 * 3600_000).toISOString();
  const recent = new Date(nowMs - 45 * 86400_000).toISOString();
  // Google tokens become unqueryable after expiry. Old Apple refunds still arrive via signed notifications.
  const { results } = await d1
    .prepare(
      `SELECT c.store,c.environment,c.chain_id,c.profile_id,c.token_cipher,
    coalesce(e.attempts,0) attempts,'reconcile:'||c.store||':'||c.environment||':'||c.chain_id event_id
    FROM membership_chains c LEFT JOIN membership_events e
      ON e.id='reconcile:'||c.store||':'||c.environment||':'||c.chain_id
    WHERE c.verified_at<? AND c.paid_until>=? AND (e.next_attempt_at IS NULL OR e.next_attempt_at<=?)
    ORDER BY c.verified_at LIMIT 2`,
    )
    .bind(stale, recent, now)
    .all<{
      store: string;
      environment: string;
      chain_id: string;
      profile_id: string;
      token_cipher: string | null;
      attempts: number;
      event_id: string;
    }>();
  // Bound the whole batch, including all provider history pages, rather than multiplying per-request timeouts.
  const deadline = AbortSignal.timeout(45_000);
  const fetcher: typeof fetch = (input, init = {}) =>
    fetch(input, {
      ...init,
      signal: init.signal ? AbortSignal.any([deadline, init.signal]) : deadline,
    });
  let checked = 0;
  let failed = 0;
  for (const row of results) {
    if (deadline.aborted) break;
    try {
      await refreshMembershipChain(env, db, row, now, fetcher);
      checked++;
      await d1.prepare('DELETE FROM membership_events WHERE id=?').bind(row.event_id).run();
    } catch (e) {
      failed++;
      const code = e instanceof MemberVerificationError ? e.reason : 'INTERNAL';
      const retry = new Date(
        nowMs + Math.min(24 * 3600_000, 300_000 * 2 ** Math.min(row.attempts, 9)),
      ).toISOString();
      await d1
        .prepare(
          `INSERT INTO membership_events (id,store,environment,profile_id,kind,created_at,attempts,next_attempt_at,error_code)
        VALUES (?,?,?,?,'reconcile',?,1,?,?) ON CONFLICT(id) DO UPDATE SET attempts=membership_events.attempts+1,next_attempt_at=excluded.next_attempt_at,error_code=excluded.error_code`,
        )
        .bind(row.event_id, row.store, row.environment, row.profile_id, now, retry, code)
        .run();
    }
  }
  if (checked || failed)
    console.log(JSON.stringify({ job: 'membership-reconcile', checked, failed }));
  return { checked, failed };
}
