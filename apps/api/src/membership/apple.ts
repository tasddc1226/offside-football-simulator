import { MEMBERSHIP_PRODUCT } from '@offside/contracts/membership';
import { bytesToBase64Url, json64, pemToPkcs8 } from '../auth/base64url.js';
import { verifyAppleTransaction, verifyAppleRenewal, type AppleTransaction } from '../iap/apple.js';
import type { Bindings } from '../env.js';
import { iapAccount } from '../iap/verify.js';
import { iso, MemberVerificationError, type VerifiedMembership } from './types.js';

/** Fresh Server API status is mandatory: a valid device JWS alone cannot prove non-revocation. */
export async function verifyAppleMembership(
  env: Bindings,
  token: string,
  profileId: string,
  now: string,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedMembership> {
  const seed = await verifyAppleTransaction(token);
  if (!seed) throw new MemberVerificationError('INVALID');
  return refreshAppleMembership(
    env,
    seed.originalTransactionId ?? '',
    seed.environment ?? '',
    profileId,
    now,
    fetcher,
  );
}

export async function refreshAppleMembership(
  env: Bindings,
  chainId: string,
  environment: string,
  profileId: string,
  now: string,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedMembership> {
  if (!chainId || !['Production', 'Sandbox'].includes(environment))
    throw new MemberVerificationError('INVALID');
  const { APPLE_IAP_ISSUER_ID: issuer, APPLE_IAP_KEY_ID: keyId, APPLE_IAP_PRIVATE_KEY: pem } = env;
  if (!issuer || !keyId || !pem) throw new MemberVerificationError('CONFIGURATION');
  const bundle = env.APPLE_BUNDLE_ID ?? 'com.offsidelab.app';
  const base =
    environment === 'Production'
      ? 'https://api.storekit.apple.com'
      : 'https://api.storekit-sandbox.apple.com';
  const nowS = Math.floor(Date.parse(now) / 1000);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  async function request(path: string) {
    const input = `${json64({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${json64({ iss: issuer, iat: nowS, exp: nowS + 300, aud: 'appstoreconnect-v1', bid: bundle })}`;
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(input),
    );
    const r = await fetcher(base + path, {
      headers: { authorization: `Bearer ${input}.${bytesToBase64Url(new Uint8Array(signature))}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new MemberVerificationError(r.status === 404 ? 'INVALID' : 'UPSTREAM');
    return r;
  }
  const valid = (tx: AppleTransaction | null) => {
    if (
      !tx ||
      tx.productId !== MEMBERSHIP_PRODUCT ||
      tx.bundleId !== bundle ||
      tx.environment !== environment ||
      tx.type !== 'Auto-Renewable Subscription' ||
      tx.originalTransactionId !== chainId ||
      tx.inAppOwnershipType === 'FAMILY_SHARED'
    )
      throw new MemberVerificationError('INVALID');
    if (tx.appAccountToken?.toLowerCase() !== iapAccount(profileId).toLowerCase())
      throw new MemberVerificationError('OTHER_ACCOUNT');
    return tx;
  };
  const state = (await (
    await request(`/inApps/v1/subscriptions/${encodeURIComponent(chainId)}`)
  ).json()) as {
    bundleId?: string;
    environment?: string;
    data?: {
      lastTransactions?: {
        status: number;
        originalTransactionId: string;
        signedTransactionInfo: string;
        signedRenewalInfo: string;
      }[];
    }[];
  };
  if (state.bundleId !== bundle || state.environment !== environment)
    throw new MemberVerificationError('INVALID');
  const latest = state.data
    ?.flatMap((g) => g.lastTransactions ?? [])
    .find((t) => t.originalTransactionId === chainId);
  if (!latest) throw new MemberVerificationError('INVALID');
  const tx = valid(await verifyAppleTransaction(latest.signedTransactionInfo));
  const renewal = await verifyAppleRenewal(latest.signedRenewalInfo);
  if (
    !renewal ||
    renewal.originalTransactionId !== chainId ||
    renewal.productId !== MEMBERSHIP_PRODUCT ||
    renewal.environment !== environment
  )
    throw new MemberVerificationError('INVALID');
  const status = tx.revocationDate
    ? 'revoked'
    : ({ 1: 'active', 2: 'expired', 3: 'hold', 4: 'grace', 5: 'revoked' } as const)[
        latest.status as 1 | 2 | 3 | 4 | 5
      ];
  if (!status) throw new MemberVerificationError('INVALID');
  const result: VerifiedMembership = {
    store: 'apple',
    environment: environment === 'Production' ? 'production' : 'sandbox',
    chainId,
    status,
    paidUntil: iso(tx.expiresDate),
    graceUntil: status === 'grace' ? iso(renewal.gracePeriodExpiresDate) : null,
    autoRenew: renewal.autoRenewStatus === 1,
    verifiedAt: now,
    periods: [],
  };
  let revision: string | undefined;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ productId: MEMBERSHIP_PRODUCT });
    if (revision) q.set('revision', revision);
    const h = (await (
      await request(`/inApps/v2/history/${encodeURIComponent(chainId)}?${q}`)
    ).json()) as { signedTransactions?: string[]; hasMore?: boolean; revision?: string };
    if (!Array.isArray(h.signedTransactions)) throw new MemberVerificationError('INVALID');
    for (const signed of h.signedTransactions) {
      const decoded = await verifyAppleTransaction(signed);
      if (!decoded) throw new MemberVerificationError('INVALID');
      if (decoded.originalTransactionId !== chainId) continue;
      const item = valid(decoded);
      result.periods.push({
        store: 'apple',
        environment: result.environment,
        chainId,
        transactionId: item.transactionId,
        profileId,
        startedAt: iso(item.purchaseDate),
        expiresAt: iso(item.expiresDate),
        paid:
          typeof item.price === 'number' &&
          item.price > 0 &&
          item.offerDiscountType !== 'FREE_TRIAL',
        refundedAt: item.revocationDate ? iso(item.revocationDate) : null,
      });
    }
    if (!h.hasMore) return result;
    if (!h.revision || h.revision === revision) throw new MemberVerificationError('UPSTREAM');
    revision = h.revision;
  }
  throw new MemberVerificationError('UPSTREAM');
}
