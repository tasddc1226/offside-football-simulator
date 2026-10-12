import type { Db } from '../db/client.js';
import type { Bindings } from '../env.js';
import { ANDROID_PACKAGE } from '../iap/google.js';
import { refreshMembershipChain } from './service.js';
import { MemberVerificationError, tokenHash } from './types.js';
import {
  GoogleMemberPushEnvelopeSchema as Envelope,
  GoogleMemberPushEventSchema as Event,
} from '@offside/contracts/membership';
/** Caller must authenticate the Pub/Sub OIDC token before accepting this envelope. */
export async function handleGoogleMemberNotification(
  env: Bindings,
  db: Db,
  body: unknown,
  now: string,
): Promise<'invalid' | 'ignored' | 'membership'> {
  const parsed = Envelope.safeParse(body);
  if (!parsed.success) return 'invalid';
  let raw: unknown;
  try {
    raw = JSON.parse(atob(parsed.data.message.data));
  } catch {
    return 'invalid';
  }
  const parsedEvent = Event.safeParse(raw);
  if (!parsedEvent.success || parsedEvent.data.packageName !== ANDROID_PACKAGE) return 'invalid';
  const event = parsedEvent.data;
  if (event.testNotification) return 'ignored';
  const purchase =
    event.subscriptionNotification ??
    (event.voidedPurchaseNotification?.productType === 1
      ? event.voidedPurchaseNotification
      : undefined);
  if (!purchase) return 'ignored';
  const chainId = await tokenHash(purchase.purchaseToken);
  const d1 = db.$client;
  const row = await d1
    .prepare(
      `SELECT store,environment,chain_id,profile_id,token_cipher FROM membership_chains
   WHERE store='google' AND environment IN ('production','sandbox') AND chain_id=?`,
    )
    .bind(chainId)
    .first<{
      store: string;
      environment: string;
      chain_id: string;
      profile_id: string;
      token_cipher: string | null;
    }>();
  if (!row) return 'ignored';
  const id = `google:${row.environment}:${parsed.data.message.messageId}`;
  await d1
    .prepare(
      `INSERT INTO membership_events (id,store,environment,profile_id,kind,created_at)
   VALUES (?,'google',?,?,?,?) ON CONFLICT(id) DO NOTHING`,
    )
    .bind(
      id,
      row.environment,
      row.profile_id,
      event.subscriptionNotification
        ? `subscription:${event.subscriptionNotification.notificationType}`
        : 'voided',
      now,
    )
    .run();
  if (
    (
      await d1
        .prepare('SELECT status FROM membership_events WHERE id=?')
        .bind(id)
        .first<{ status: string }>()
    )?.status === 'done'
  )
    return 'membership';
  await d1.prepare('UPDATE membership_events SET attempts=attempts+1 WHERE id=?').bind(id).run();
  try {
    await refreshMembershipChain(
      env,
      db,
      row,
      now,
      fetch,
      event.voidedPurchaseNotification?.orderId,
    );
    await d1
      .prepare("UPDATE membership_events SET status='done',error_code=NULL WHERE id=?")
      .bind(id)
      .run();
    return 'membership';
  } catch (e) {
    await d1
      .prepare('UPDATE membership_events SET error_code=? WHERE id=?')
      .bind(e instanceof MemberVerificationError ? e.reason : 'INTERNAL', id)
      .run();
    throw new MemberVerificationError('UPSTREAM');
  }
}
