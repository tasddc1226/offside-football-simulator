import {
  MembershipResponseSchema,
  SeasonPassResponseSchema,
  successEnvelope,
  WebPayConfigResponseSchema,
} from '@offside/contracts';
import { applySeasonSchedule } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { billingAlerts } from '../db/schema.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
import { createApp } from '../app.js';

// T-11-591 웹 결제(엑솔라)로 파는 시즌 패스 · 클럽 멤버십.

const ConfigRes = successEnvelope(WebPayConfigResponseSchema);
const PassRes = successEnvelope(SeasonPassResponseSchema);
const MemberRes = successEnvelope(MembershipResponseSchema);
const PASS = 'com.offsidelab.app.season_pass';
const MEMBER = 'com.offsidelab.app.club_monthly';
const SECRET = 'hook_secret';
const S2 = '2026-10-30T15:00:00.000Z';
const NOW = '2026-11-02T00:00:00.000Z';
const DAY = 86_400_000;

function stubXsolla() {
  let n = 2000;
  vi.stubGlobal('fetch', async () => {
    n += 1;
    return new Response(JSON.stringify({ token: `tok_${n}`, order_id: n }), { status: 201 });
  });
}

async function sha1(text: string) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const paid = (orderId: number, userId: string, sku: string, quantity = 1) => ({
  notification_type: 'order_paid',
  items: [{ sku, type: 'virtual_good', quantity, amount: '9900' }],
  order: { id: orderId, mode: 'default', status: 'paid' },
  user: { external_id: userId, country: 'KR' },
  billing: {
    purchase: { total: { currency: 'KRW', amount: 9900 } },
    transaction: { id: 9, payment_date: '2026-11-02T09:00:00+09:00' },
  },
});
const cancel = (orderId: number) => ({
  notification_type: 'order_canceled',
  order: { id: orderId, mode: 'default', status: 'canceled' },
  user: { external_id: 'x' },
});

describe('T-11-591 웹 결제 시즌 패스 · 멤버십', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    Object.assign(ctx.env, {
      WEB_PAY_ENABLED: '1',
      XSOLLA_PROJECT_ID: '300000',
      XSOLLA_API_KEY: 'api_key',
      XSOLLA_WEBHOOK_SECRET: SECRET,
      SEASON_PASS_ENABLED: '1',
      MEMBERSHIP_ENABLED: '1',
      BILLING_ALERTS_ENABLED: '1',
    });
    await saveSeasonSchedule(ctx.env.DB, [
      { id: 1, startsAt: '2026-10-05T15:00:00.000Z', endsAt: S2, retireAt: 45 },
      { id: 2, startsAt: S2, endsAt: null, retireAt: 46 },
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    applySeasonSchedule([]);
    forgetSeasonSchedule();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const config = async (cookie: string) =>
    ConfigRes.parse(await (await call('GET', '/v1/web-pay/config', { cookie })).json()).data;
  const order = (cookie: string, productId: string) =>
    call('POST', '/v1/web-pay/orders', { cookie, body: { productId } });
  const pass = async (cookie: string) =>
    PassRes.parse(await (await call('GET', '/v1/season-pass', { cookie })).json()).data;
  const member = async (cookie: string) =>
    MemberRes.parse(await (await call('GET', '/v1/membership', { cookie })).json()).data;
  const hook = async (body: unknown) => {
    const raw = JSON.stringify(body);
    return createApp().request(
      '/v1/web-pay/webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Signature ${await sha1(raw + SECRET)}`,
        },
        body: raw,
      },
      ctx.env,
    );
  };

  it('시즌 패스는 시즌 2가 열린 뒤부터, 멤버십은 판매 스위치가 켜져 있으면 판다', async () => {
    const me = await issueGoogleCookie(ctx);
    stubXsolla();
    vi.setSystemTime(new Date('2026-10-30T14:59:00.000Z'));
    let c = await config(me.cookie);
    expect(c.pass).toBeUndefined();
    expect(c.membership).toEqual({ productId: MEMBER, amount: 4900, days: 30 });
    expect((await order(me.cookie, PASS)).status).toBe(503);
    vi.setSystemTime(new Date(S2));
    c = await config(me.cookie);
    expect(c.pass).toEqual({ productId: PASS, amount: 9900 });
    expect((await order(me.cookie, PASS)).status).toBe(201);
    ctx.env.MEMBERSHIP_ENABLED = '0';
    expect((await config(me.cookie)).membership).toBeUndefined();
    expect((await order(me.cookie, MEMBER)).status).toBe(503);
  });

  it('시즌 패스 결제로 이번 시즌 패스를 한 번만 열고, 환불되면 닫는다', async () => {
    const me = await issueGoogleCookie(ctx);
    stubXsolla();
    expect((await order(me.cookie, PASS)).status).toBe(201);
    expect((await hook(paid(2001, me.profileId, PASS))).status).toBe(204);
    expect((await hook(paid(2001, me.profileId, PASS))).status).toBe(204);
    const opened = await pass(me.cookie);
    expect(opened.seasons.filter((s) => s.owned).map((s) => s.season)).toEqual([2]);
    expect((await hook(paid(2009, me.profileId, PASS, 2))).status).toBe(400);
    expect((await hook(cancel(2001))).status).toBe(204);
    expect((await pass(me.cookie)).seasons.some((s) => s.owned)).toBe(false);
    const alerts = await ctx.db.select().from(billingAlerts);
    expect(alerts.map((a) => [a.store, a.kind, a.productId]).sort()).toEqual([
      ['xsolla', 'purchase', PASS],
      ['xsolla', 'refund', PASS],
    ]);
  });

  it('멤버십 결제는 자동 갱신 없이 30일씩 이어 붙이고, 환불하면 그 주문 기간을 끝낸다', async () => {
    const me = await issueGoogleCookie(ctx);
    stubXsolla();
    expect((await member(me.cookie)).active).toBe(false);
    expect((await order(me.cookie, MEMBER)).status).toBe(201);
    expect((await hook(paid(2001, me.profileId, MEMBER))).status).toBe(204);
    expect((await hook(paid(2001, me.profileId, MEMBER))).status).toBe(204);
    let m = await member(me.cookie);
    expect(m).toMatchObject({ active: true, autoRenew: null, store: null });
    expect(m.until).toBe(new Date(Date.parse(NOW) + 30 * DAY).toISOString());
    expect((await order(me.cookie, MEMBER)).status).toBe(201);
    expect((await hook(paid(2002, me.profileId, MEMBER))).status).toBe(204);
    expect((await member(me.cookie)).until).toBe(
      new Date(Date.parse(NOW) + 60 * DAY).toISOString(),
    );
    expect((await hook(cancel(2002))).status).toBe(204);
    expect((await hook(cancel(2002))).status).toBe(204);
    m = await member(me.cookie);
    expect(m.until).toBe(new Date(Date.parse(NOW) + 30 * DAY).toISOString());
    expect((await hook(cancel(2001))).status).toBe(204);
    expect((await member(me.cookie)).active).toBe(false);
    const refunds = (await ctx.db.select().from(billingAlerts)).filter((a) => a.kind === 'refund');
    expect(refunds).toHaveLength(2);
  });
});
