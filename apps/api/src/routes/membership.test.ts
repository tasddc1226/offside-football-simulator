import {
  AttendanceCheckInResponseSchema,
  MembershipResponseSchema,
  OwnerTeamResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { checkInReward } from '@offside/contracts/attendance';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../db/client.js';
import { memberships } from '../db/schema.js';
import { handleAppleNotification } from '../iap/refunds.js';
import { handleGoogleRtdn } from '../iap/rtdn.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';

// Apple 서명 확인 · Google Developer API는 각자의 테스트가 본다. 여기서는 확인 결과를 정해 두고 구독 규칙만 본다.
const apple = vi.hoisted(() => ({
  tx: null as Record<string, unknown> | null,
  note: null as Record<string, unknown> | null,
  renewal: null as Record<string, unknown> | null,
}));
vi.mock('../iap/apple.js', async (orig) => ({
  ...(await orig<typeof import('../iap/apple.js')>()),
  verifyAppleTransaction: async () => apple.tx,
  verifyAppleNotification: async () => apple.note,
  verifyAppleRenewal: async () => apple.renewal,
}));
const google = vi.hoisted(() => ({ sub: null as Record<string, unknown> | null, acks: 0 }));
vi.mock('../iap/google.js', async (orig) => ({
  ...(await orig<typeof import('../iap/google.js')>()),
  getGoogleSubscription: async () => google.sub,
  acknowledgeGoogleSubscription: async () => {
    google.acks++;
  },
}));

const MemberRes = successEnvelope(MembershipResponseSchema);
const CheckInRes = successEnvelope(AttendanceCheckInResponseSchema);
const TeamRes = successEnvelope(OwnerTeamResponseSchema);
const PRODUCT = 'com.offsidelab.app.club_monthly';
const NOW = '2026-11-02T00:00:00.000Z';
const ms = (iso: string) => Date.parse(iso);

describe('T-11-512 클럽 멤버십', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    apple.tx = apple.note = apple.renewal = null;
    google.sub = null;
    google.acks = 0;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const state = async (cookie: string) =>
    MemberRes.parse(await (await call('GET', '/v1/membership', { cookie })).json()).data;
  const claim = (cookie: string, store: 'apple' | 'google' = 'apple') =>
    call('POST', '/v1/membership/iap', { cookie, body: { store, token: 'token-1' } });
  const appleTx = (profileId: string, over: Record<string, unknown> = {}) => ({
    transactionId: '5000000002',
    originalTransactionId: '5000000001',
    bundleId: 'com.offsidelab.app',
    productId: PRODUCT,
    type: 'Auto-Renewable Subscription',
    environment: 'Sandbox',
    appAccountToken: profileId.replace(/^prf_/, ''),
    expiresDate: ms('2026-12-01T00:00:00.000Z'),
    signedDate: ms('2026-11-01T00:00:00.000Z'),
    ...over,
  });

  it('로그인하지 않은 프로필은 멤버십을 보지 못한다', async () => {
    const guest = await issueCookie(ctx);
    expect((await call('GET', '/v1/membership', { cookie: guest.cookie })).status).toBe(403);
  });

  it('가입 전에는 혜택이 없고, 판매 스위치가 꺼져 있으면 가입 스토어를 보이지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    expect(await state(me.cookie)).toEqual({
      active: false,
      until: null,
      autoRenew: null,
      store: null,
      stores: [],
    });
    ctx.env.MEMBERSHIP_ENABLED = '1';
    expect(await state(me.cookie)).toMatchObject({
      stores: ['apple'],
      account: me.profileId.replace(/^prf_/, ''),
    });
  });

  it('Apple 구독 거래로 가입하고, 옛 거래를 다시 보내도 기간을 되돌리지 않으며, 다른 구단주는 같은 구독을 쓰지 못한다', async () => {
    const me = await issueGoogleCookie(ctx);
    apple.tx = appleTx(me.profileId);
    const joined = MemberRes.parse(await (await claim(me.cookie)).json()).data;
    expect(joined).toMatchObject({
      active: true,
      until: '2026-12-01T00:00:00.000Z',
      store: 'apple',
    });

    // 지난달 거래(먼저 서명됨)를 다시 보내도 그대로다.
    apple.tx = appleTx(me.profileId, {
      expiresDate: ms('2026-11-01T00:00:00.000Z'),
      signedDate: ms('2026-10-01T00:00:00.000Z'),
    });
    expect((await state(me.cookie)).until).toBe('2026-12-01T00:00:00.000Z');
    expect(MemberRes.parse(await (await claim(me.cookie)).json()).data.active).toBe(true);

    // 구단주 표시가 다른 거래 · 이미 다른 구단주에게 묶인 구독은 거절한다.
    const other = await issueGoogleCookie(ctx);
    expect((await claim(other.cookie)).status).toBe(409);
    apple.tx = appleTx(other.profileId, { signedDate: ms('2026-11-01T12:00:00.000Z') });
    expect((await claim(other.cookie)).status).toBe(409);
    expect(await ctx.db.select().from(memberships)).toHaveLength(1);
  });

  it('구독 중이면 출석 보상을 2배로 받고, 내 구단 · 친구 응답에 서포터 표시가 붙는다', async () => {
    const me = await issueGoogleCookie(ctx);
    apple.tx = appleTx(me.profileId);
    await claim(me.cookie);
    const res = await call('POST', '/v1/attendance/check-in', {
      cookie: me.cookie,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    const done = CheckInRes.parse(await res.json()).data;
    const base = checkInReward(1);
    for (const k of ['reroll', 'boost', 'scout', 'rename'] as const)
      expect(done.granted[k]).toBe((base[k] ?? 0) * 2);
    expect(done.attendance.member).toBe(true);
    const team = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    );
    expect(team.data.member).toBe(true);
  });

  it('Apple 서버 알림: 앱보다 먼저 온 가입을 구단주 표시로 묶고, 환불되면 바로 혜택을 끈다', async () => {
    const me = await issueGoogleCookie(ctx);
    apple.note = {
      notificationType: 'SUBSCRIBED',
      data: {
        bundleId: 'com.offsidelab.app',
        environment: 'Sandbox',
        signedTransactionInfo: 'jws',
        signedRenewalInfo: 'renewal',
      },
    };
    apple.tx = appleTx(me.profileId);
    apple.renewal = { originalTransactionId: '5000000001', autoRenewStatus: 1 };
    const db = createDb(ctx.env.DB);
    expect(await handleAppleNotification(ctx.env, db, 'payload', NOW)).toBe('member');
    expect(await state(me.cookie)).toMatchObject({ active: true, autoRenew: true });

    apple.note = { ...apple.note, notificationType: 'REFUND' };
    apple.tx = appleTx(me.profileId, {
      revocationDate: ms('2026-11-01T18:00:00.000Z'),
      signedDate: ms('2026-11-01T18:00:00.000Z'),
    });
    expect(await handleAppleNotification(ctx.env, db, 'payload', NOW)).toBe('member');
    expect(await state(me.cookie)).toMatchObject({
      active: false,
      until: '2026-11-01T18:00:00.000Z',
    });
  });

  it('Google: 가입 확인 뒤 승인하고, RTDN으로 결제 보류가 오면 혜택을 끈다', async () => {
    const me = await issueGoogleCookie(ctx);
    ctx.env.GOOGLE_PLAY_SA_JSON = '{}';
    ctx.env.BILLING_ALERTS_ENABLED = '0';
    const sub = (state: string) => ({
      subscriptionState: state,
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
      externalAccountIdentifiers: {
        obfuscatedExternalAccountId: me.profileId.replace(/^prf_/, ''),
      },
      lineItems: [
        {
          productId: PRODUCT,
          expiryTime: '2026-12-01T00:00:00.000Z',
          autoRenewingPlan: { autoRenewEnabled: true },
        },
      ],
    });
    google.sub = sub('SUBSCRIPTION_STATE_ACTIVE');
    expect(MemberRes.parse(await (await claim(me.cookie, 'google')).json()).data).toMatchObject({
      active: true,
      store: 'google',
      autoRenew: true,
    });
    await vi.waitFor(() => expect(google.acks).toBe(1));

    vi.setSystemTime(new Date('2026-11-03T00:00:00.000Z'));
    google.sub = {
      ...sub('SUBSCRIPTION_STATE_ON_HOLD'),
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    };
    const note = {
      message: {
        messageId: '1',
        data: btoa(
          JSON.stringify({
            packageName: 'com.offsidelab.app',
            subscriptionNotification: { notificationType: 5, purchaseToken: 'token-1' },
          }),
        ),
      },
    };
    expect(await handleGoogleRtdn(ctx.env, note, '2026-11-03T00:00:00.000Z')).toBe(204);
    expect(await state(me.cookie)).toMatchObject({
      active: false,
      until: '2026-11-03T00:00:00.000Z',
    });
  });
});
