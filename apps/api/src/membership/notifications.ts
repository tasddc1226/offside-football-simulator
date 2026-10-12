import { MEMBERSHIP_PRODUCT } from '@offside/contracts/membership';
import { DEFAULT_BUNDLE_ID } from '../auth/apple-id-token.js';
import type { Db } from '../db/client.js';
import type { Bindings } from '../env.js';
import type { AppleNotification, AppleTransaction } from '../iap/apple.js';
import { refreshMembershipChain } from './service.js';
import { MemberVerificationError } from './types.js';

/** Called only after BOTH notification and transaction JWS signatures were verified. */
export async function handleMemberAppleNotification(
  env: Bindings,
  db: Db,
  note: AppleNotification,
  tx: AppleTransaction,
  now: string,
): Promise<'invalid' | 'ignored' | 'membership'> {
  if (
    tx.bundleId !== (env.APPLE_BUNDLE_ID ?? DEFAULT_BUNDLE_ID) ||
    tx.productId !== MEMBERSHIP_PRODUCT ||
    !tx.originalTransactionId ||
    !note.notificationUUID ||
    !note.notificationType ||
    !['Production', 'Sandbox'].includes(tx.environment ?? '') ||
    note.data?.environment !== tx.environment
  )
    return 'invalid';
  const environment = tx.environment === 'Production' ? 'production' : 'sandbox';
  const d1 = db.$client;
  const row = await d1
    .prepare(
      `SELECT store,environment,chain_id,profile_id,token_cipher
    FROM membership_chains WHERE store='apple' AND environment=? AND chain_id=?`,
    )
    .bind(environment, String(tx.originalTransactionId))
    .first<{
      store: string;
      environment: string;
      chain_id: string;
      profile_id: string;
      token_cipher: string | null;
    }>();
  // A purchase is bound through authenticated claim/restore. Never attach a notification to an arbitrary account.
  // If it arrives before the claim, the claim's complete Apple history catches it up.
  if (!row) return 'ignored';
  const id = `apple:${environment}:${note.notificationUUID}`;
  await d1
    .prepare(
      `INSERT INTO membership_events (id,store,environment,profile_id,kind,created_at)
    VALUES (?,'apple',?,?,?,?) ON CONFLICT(id) DO NOTHING`,
    )
    .bind(id, environment, row.profile_id, note.notificationType, now)
    .run();
  const event = await d1
    .prepare('SELECT status FROM membership_events WHERE id=?')
    .bind(id)
    .first<{ status: string }>();
  if (event?.status === 'done') return 'membership';
  await d1.prepare('UPDATE membership_events SET attempts=attempts+1 WHERE id=?').bind(id).run();
  try {
    // Never apply the notification's potentially old status. Verify the current store state and history.
    await refreshMembershipChain(env, db, row, now);
    await d1
      .prepare("UPDATE membership_events SET status='done',error_code=NULL WHERE id=?")
      .bind(id)
      .run();
    return 'membership';
  } catch (e) {
    const code = e instanceof MemberVerificationError ? e.reason : 'INTERNAL';
    await d1.prepare('UPDATE membership_events SET error_code=? WHERE id=?').bind(code, id).run();
    // Non-2xx makes Apple retry; never expose upstream URLs or purchase credentials through global logging.
    throw new MemberVerificationError('UPSTREAM');
  }
}
