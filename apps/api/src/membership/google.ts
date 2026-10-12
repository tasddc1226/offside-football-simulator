import { MEMBERSHIP_PRODUCT } from '@offside/contracts/membership';
import type { Bindings } from '../env.js';
import { accessToken, ANDROID_PACKAGE } from '../iap/google.js';
import { iapAccount } from '../iap/verify.js';
import { iso, tokenHash, MemberVerificationError, type VerifiedMembership } from './types.js';

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE}`;
type Order = {
  orderId?: string;
  purchaseToken?: string;
  state?: string;
  lastEventTime?: string;
  lineItems?: {
    productId?: string;
    total?: { units?: string; nanos?: number };
    subscriptionDetails?: {
      basePlanId?: string;
      offerPhase?: string;
      offerPhaseDetails?: { freeTrialDetails?: object; prorationPeriodDetails?: object };
      servicePeriodStartTime?: string;
      servicePeriodEndTime?: string;
    };
  }[];
};
/** SubscriptionPurchaseV2 determines access; Orders determine paid period identity and refunds. */
export async function verifyGoogleMembership(
  env: Bindings,
  token: string,
  profileId: string,
  now: string,
  knownOrders: string[] = [],
  fetcher: typeof fetch = fetch,
): Promise<VerifiedMembership> {
  if (!env.GOOGLE_PLAY_SA_JSON) throw new MemberVerificationError('CONFIGURATION');
  const auth = `Bearer ${await accessToken(env.GOOGLE_PLAY_SA_JSON, fetcher, Math.floor(Date.parse(now) / 1000))}`;
  async function request(path: string, init: RequestInit = {}) {
    const r = await fetcher(BASE + path, {
      ...init,
      headers: { authorization: auth, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new MemberVerificationError(
        [400, 404, 410].includes(r.status) ? 'INVALID' : 'UPSTREAM',
      );
    return r;
  }
  const p = (await (
    await request(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`)
  ).json()) as {
    subscriptionState?: string;
    testPurchase?: object;
    acknowledgementState?: string;
    externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
    lineItems?: {
      productId?: string;
      expiryTime?: string;
      latestSuccessfulOrderId?: string;
      autoRenewingPlan?: { autoRenewEnabled?: boolean };
      offerDetails?: { basePlanId?: string };
    }[];
  };
  if (p.externalAccountIdentifiers?.obfuscatedExternalAccountId !== iapAccount(profileId))
    throw new MemberVerificationError('OTHER_ACCOUNT');
  const line = p.lineItems?.find(
    (i) => i.productId === MEMBERSHIP_PRODUCT && i.offerDetails?.basePlanId === 'monthly',
  );
  if (!line || !line.autoRenewingPlan) throw new MemberVerificationError('INVALID');
  if (p.subscriptionState === 'SUBSCRIPTION_STATE_PENDING')
    throw new MemberVerificationError('PENDING');
  const statusMap: Record<string, VerifiedMembership['status']> = {
    SUBSCRIPTION_STATE_ACTIVE: 'active',
    SUBSCRIPTION_STATE_CANCELED: 'active',
    SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace',
    SUBSCRIPTION_STATE_ON_HOLD: 'hold',
    SUBSCRIPTION_STATE_PAUSED: 'hold',
    SUBSCRIPTION_STATE_EXPIRED: 'expired',
    SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
  };
  const status = statusMap[p.subscriptionState ?? ''];
  if (!status || !line.latestSuccessfulOrderId) throw new MemberVerificationError('INVALID');
  const chainId = await tokenHash(token);
  const result: VerifiedMembership = {
    store: 'google',
    environment: p.testPurchase ? 'sandbox' : 'production',
    chainId,
    status,
    paidUntil: iso(line.expiryTime),
    graceUntil: status === 'grace' ? iso(line.expiryTime) : null,
    autoRenew: !!line.autoRenewingPlan.autoRenewEnabled,
    verifiedAt: now,
    periods: [],
  };
  // Known old orders are rechecked by reconciliation, so an old-period refund cannot hide behind a renewal.
  const orders = [...new Set([line.latestSuccessfulOrderId, ...knownOrders])];
  if (orders.length > 50) throw new MemberVerificationError('UPSTREAM');
  for (const orderId of orders) {
    const order = (await (await request(`/orders/${encodeURIComponent(orderId)}`)).json()) as Order;
    if (order.orderId !== orderId || order.purchaseToken !== token)
      throw new MemberVerificationError('INVALID');
    const item = order.lineItems?.find(
      (i) => i.productId === MEMBERSHIP_PRODUCT && i.subscriptionDetails?.basePlanId === 'monthly',
    );
    if (!item?.subscriptionDetails) throw new MemberVerificationError('INVALID');
    const detail = item.subscriptionDetails;
    const refunded = order.state === 'REFUNDED';
    if (refunded && orderId === line.latestSuccessfulOrderId) result.status = 'revoked';
    if (
      !['PROCESSED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'PENDING_REFUND'].includes(order.state ?? '')
    )
      continue;
    const paid =
      detail.offerPhase !== 'FREE_TRIAL' &&
      !detail.offerPhaseDetails?.freeTrialDetails &&
      !detail.offerPhaseDetails?.prorationPeriodDetails &&
      (Number(item.total?.units ?? 0) > 0 || Number(item.total?.nanos ?? 0) > 0);
    result.periods.push({
      store: 'google',
      environment: result.environment,
      chainId,
      transactionId: orderId,
      profileId,
      startedAt: iso(detail.servicePeriodStartTime),
      expiresAt: iso(detail.servicePeriodEndTime),
      paid,
      refundedAt: refunded ? iso(order.lastEventTime) : null,
    });
  }
  if (p.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING')
    result.acknowledge = async () => {
      await request(
        `/purchases/subscriptions/${encodeURIComponent(MEMBERSHIP_PRODUCT)}/tokens/${encodeURIComponent(token)}:acknowledge`,
        { method: 'POST', body: '{}' },
      );
    };
  return result;
}
