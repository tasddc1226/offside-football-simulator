// ───────── 클럽 멤버십 구독 확인 (T-11-512) ─────────
// 앱이 보낸 구독 거래 · 스토어 서버 알림을 스토어 기준으로 확인해 구독 한 줄(memberships)로 바꾼다. 혜택은 until(스토어가 알려 준
// 다음 결제일 · 결제 유예 끝)까지다. 환불 · 취소 · 결제 보류는 until을 그 시각으로 당겨 바로 혜택을 끈다.
import { MEMBERSHIP_PRODUCT_ID } from '@offside/contracts/membership';
import { DEFAULT_BUNDLE_ID } from '../auth/apple-id-token.js';
import { createDb, type Db } from '../db/client.js';
import { bindMembership, updateMembership, type MembershipChain } from '../db/repos/memberships.js';
import type { Bindings } from '../env.js';
import {
  APPLE_ROOT_G3_SHA256,
  verifyAppleRenewal,
  verifyAppleTransaction,
  type AppleRenewalInfo,
  type AppleTransaction,
} from './apple.js';
import {
  acknowledgeGoogleSubscription,
  getGoogleSubscription,
  type GoogleSubscription,
} from './google.js';

export type MembershipRejection = 'INVALID' | 'PENDING' | 'OTHER_ACCOUNT';
export type MembershipVerdict =
  | { ok: true; chain: MembershipChain; account: string | null; after?: () => Promise<void> }
  | { ok: false; reason: MembershipRejection };

const iso = (ms: number) => new Date(ms).toISOString();
const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');

/** Apple 구독 거래(+ 갱신 정보)를 구독 한 줄로. 이 앱의 멤버십 구독이 아니면 null. */
function appleChain(
  env: Bindings,
  tx: AppleTransaction | null,
  renewal: AppleRenewalInfo | null,
  now: string,
) {
  if (
    !tx ||
    tx.bundleId !== (env.APPLE_BUNDLE_ID ?? DEFAULT_BUNDLE_ID) ||
    tx.productId !== MEMBERSHIP_PRODUCT_ID ||
    tx.type !== 'Auto-Renewable Subscription' ||
    !tx.transactionId ||
    typeof tx.expiresDate !== 'number'
  )
    return null;
  const chainId = String(tx.originalTransactionId ?? tx.transactionId);
  const grace =
    renewal?.originalTransactionId === chainId ? renewal.gracePeriodExpiresDate : undefined;
  const until = tx.revocationDate
    ? iso(tx.revocationDate)
    : iso(Math.max(tx.expiresDate, grace ?? 0));
  const chain: MembershipChain = {
    store: 'apple',
    chainId,
    until,
    autoRenew:
      renewal?.originalTransactionId === chainId && renewal.autoRenewStatus !== undefined
        ? renewal.autoRenewStatus === 1
        : null,
    test: tx.environment !== 'Production',
    // 늦게 서명된 정보만 앞선 정보를 고친다(앱이 옛 거래를 다시 보내도 갱신된 기간을 되돌리지 않는다).
    verifiedAt: typeof tx.signedDate === 'number' ? iso(tx.signedDate) : now,
  };
  return chain;
}

/** Google 구독 상태를 구독 한 줄로. 접근이 끝난 상태(보류 · 일시중지 · 만료)는 until을 지금으로 당긴다. */
function googleChain(
  chainId: string,
  sub: GoogleSubscription,
  now: string,
): MembershipChain | null {
  const line = sub.lineItems?.find((l) => l.productId === MEMBERSHIP_PRODUCT_ID);
  if (!line?.expiryTime || !Number.isFinite(Date.parse(line.expiryTime))) return null;
  const expiry = new Date(line.expiryTime).toISOString();
  const open = [
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED',
  ];
  return {
    store: 'google',
    chainId,
    until: open.includes(sub.subscriptionState ?? '') ? expiry : expiry < now ? expiry : now,
    autoRenew: line.autoRenewingPlan?.autoRenewEnabled ?? null,
    test: !!sub.testPurchase,
    verifiedAt: now,
  };
}

/**
 * 앱이 보낸 구독 거래를 확인한다. 스토어에 닿지 못하면 던진다(앱이 다음 실행 때 다시 보낸다). appleRoot · fetcher는 테스트만 바꾼다.
 */
export async function verifyMembershipClaim(
  env: Bindings,
  input: { store: 'apple' | 'google'; token: string },
  account: string,
  now: string,
  opts: { fetcher?: typeof fetch; appleRoot?: string } = {},
): Promise<MembershipVerdict> {
  if (input.store === 'apple') {
    const tx = await verifyAppleTransaction(input.token, opts.appleRoot ?? APPLE_ROOT_G3_SHA256);
    const chain = appleChain(env, tx, null, now);
    if (!chain) return { ok: false, reason: 'INVALID' };
    if (tx?.appAccountToken?.toLowerCase() !== account.toLowerCase())
      return { ok: false, reason: 'OTHER_ACCOUNT' };
    return { ok: true, chain, account };
  }
  const sa = env.GOOGLE_PLAY_SA_JSON;
  if (!sa) throw new Error('GOOGLE_PLAY_SA_JSON missing');
  const gopts = {
    nowS: Math.floor(Date.parse(now) / 1000),
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
  };
  const sub = await getGoogleSubscription(sa, input.token, gopts);
  if (!sub) return { ok: false, reason: 'INVALID' };
  if (sub.subscriptionState === 'SUBSCRIPTION_STATE_PENDING')
    return { ok: false, reason: 'PENDING' };
  const chain = googleChain(await sha256(input.token), sub, now);
  if (!chain) return { ok: false, reason: 'INVALID' };
  if (sub.externalAccountIdentifiers?.obfuscatedExternalAccountId !== account)
    return { ok: false, reason: 'OTHER_ACCOUNT' };
  return {
    ok: true,
    chain,
    account,
    ...(sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING'
      ? {
          after: () => acknowledgeGoogleSubscription(sa, MEMBERSHIP_PRODUCT_ID, input.token, gopts),
        }
      : {}),
  };
}

/** 구단주 표시(uuid)로 프로필을 찾는다. 서버 알림이 앱보다 먼저 와도 그 구단주에게 묶는다. */
async function profileOfAccount(db: Db, account: string | undefined) {
  if (!account || !/^[0-9a-f-]{36}$/i.test(account)) return null;
  const row = await db.$client
    .prepare('SELECT id FROM profiles WHERE id = ?')
    .bind(`prf_${account.toLowerCase()}`)
    .first<{ id: string }>();
  return row?.id ?? null;
}

/** 알림으로 고친 구독. 처음 보는 구독은 거래의 구단주 표시로 묶는다. 묶을 곳이 없으면 null. */
async function applyNotice(
  db: Db,
  chain: MembershipChain,
  account: string | undefined,
  now: string,
) {
  const owner = await updateMembership(db, chain);
  if (owner) return owner;
  const id = await profileOfAccount(db, account);
  return id && (await bindMembership(db, id, chain, now)) ? id : null;
}

/** App Store 서버 알림(이미 서명을 확인한 거래). 멤버십 구독이 아니면 false. */
export async function handleAppleMembershipNotice(
  env: Bindings,
  db: Db,
  tx: AppleTransaction,
  signedRenewalInfo: string | undefined,
  now: string,
  appleRoot = APPLE_ROOT_G3_SHA256,
) {
  if (tx.productId !== MEMBERSHIP_PRODUCT_ID) return false;
  const renewal = signedRenewalInfo ? await verifyAppleRenewal(signedRenewalInfo, appleRoot) : null;
  const chain = appleChain(env, tx, renewal, now);
  if (!chain) return true;
  const owner = await applyNotice(db, chain, tx.appAccountToken, now);
  console.log(
    JSON.stringify({
      level: 'info',
      job: 'member-apple-notify',
      bound: !!owner,
      active: chain.until > now,
    }),
  );
  return true;
}

/** Google RTDN 구독 알림 한 건. Developer API로 지금 상태를 다시 읽어 고친다. 멤버십 구독이 아니면 false. */
export async function handleGoogleMembershipNotice(
  env: Bindings,
  token: string,
  sub: GoogleSubscription,
  now: string,
) {
  const chain = googleChain(await sha256(token), sub, now);
  if (!chain) return false;
  const owner = await applyNotice(
    createDb(env.DB),
    chain,
    sub.externalAccountIdentifiers?.obfuscatedExternalAccountId,
    now,
  );
  // 앱이 확인을 보내기 전에 꺼졌어도 묶인 구독은 승인한다(승인하지 않으면 사흘 뒤 Google이 환불한다).
  if (
    owner &&
    sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' &&
    env.GOOGLE_PLAY_SA_JSON
  )
    await acknowledgeGoogleSubscription(env.GOOGLE_PLAY_SA_JSON, MEMBERSHIP_PRODUCT_ID, token, {
      nowS: Math.floor(Date.parse(now) / 1000),
    });
  console.log(
    JSON.stringify({
      level: 'info',
      job: 'member-google-notify',
      bound: !!owner,
      active: chain.until > now,
    }),
  );
  return true;
}
