import type { Bindings } from '../env.js';
import type { Db } from '../db/client.js';
import { refreshAppleMembership, verifyAppleMembership } from './apple.js';
import { verifyGoogleMembership } from './google.js';
import { MemberVerificationError, tokenHash, type VerifiedMembership } from './types.js';
import { sealToken, openToken } from './tokenVault.js';
import { applyMembership } from './apply.js';
import { purgeMemberRanks } from './cache.js';

export const memberTester = (env: Bindings, id: string) =>
  !!env.MEMBERSHIP_TESTERS?.split(',').some((v) => v.trim() === id);
export function memberStores(env: Bindings, id: string): ('apple' | 'google')[] {
  if (env.MEMBERSHIP_SALES_ENABLED !== '1' && !memberTester(env, id)) return [];
  const stores: ('apple' | 'google')[] = [];
  if (env.APPLE_IAP_ISSUER_ID && env.APPLE_IAP_KEY_ID && env.APPLE_IAP_PRIVATE_KEY)
    stores.push('apple');
  if (env.GOOGLE_PLAY_SA_JSON && env.MEMBERSHIP_TOKEN_KEY) stores.push('google');
  return stores;
}
async function googleOrders(db: Db, profileId: string, chainId: string) {
  const { results } = await db.$client
    .prepare(
      `SELECT transaction_id FROM membership_periods WHERE store='google' AND profile_id=? AND chain_id=? ORDER BY started_at DESC LIMIT 49`,
    )
    .bind(profileId, chainId)
    .all<{ transaction_id: string }>();
  return results.map((r) => r.transaction_id);
}
async function apply(env: Bindings, db: Db, id: string, m: VerifiedMembership, token?: string) {
  if (m.environment === 'sandbox' && env.ENVIRONMENT === 'production' && !memberTester(env, id))
    throw new MemberVerificationError('INVALID');
  const cipher =
    m.store === 'google' && token && env.MEMBERSHIP_TOKEN_KEY
      ? await sealToken(token, env.MEMBERSHIP_TOKEN_KEY, `${id}:${m.chainId}`)
      : null;
  if (m.store === 'google' && !cipher) throw new MemberVerificationError('CONFIGURATION');
  await applyMembership(db, id, m, cipher);
  await purgeMemberRanks(env, db, id);
  await m.acknowledge?.();
}
/** Sales gates control new offers, never access restoration or already-owned benefits. */
export async function claimMembership(
  env: Bindings,
  db: Db,
  id: string,
  store: 'apple' | 'google',
  token: string,
  now: string,
) {
  const m =
    store === 'apple'
      ? await verifyAppleMembership(env, token, id, now)
      : await verifyGoogleMembership(
          env,
          token,
          id,
          now,
          await googleOrders(db, id, await tokenHash(token)),
        );
  await apply(env, db, id, m, token);
}
export async function refreshMembershipChain(
  env: Bindings,
  db: Db,
  row: {
    store: string;
    environment: string;
    chain_id: string;
    profile_id: string;
    token_cipher: string | null;
  },
  now: string,
  fetcher: typeof fetch = fetch,
  eventOrderId?: string,
) {
  if (row.store === 'apple') {
    const m = await refreshAppleMembership(
      env,
      row.chain_id,
      row.environment === 'production' ? 'Production' : 'Sandbox',
      row.profile_id,
      now,
      fetcher,
    );
    await apply(env, db, row.profile_id, m);
  } else if (row.store === 'google') {
    if (!row.token_cipher || !env.MEMBERSHIP_TOKEN_KEY)
      throw new MemberVerificationError('CONFIGURATION');
    const token = await openToken(
      row.token_cipher,
      env.MEMBERSHIP_TOKEN_KEY,
      `${row.profile_id}:${row.chain_id}`,
    );
    const m = await verifyGoogleMembership(
      env,
      token,
      row.profile_id,
      now,
      [
        ...new Set([
          ...(eventOrderId ? [eventOrderId] : []),
          ...(await googleOrders(db, row.profile_id, row.chain_id)),
        ]),
      ].slice(0, 49),
      fetcher,
    );
    await apply(env, db, row.profile_id, m, token);
  }
}
