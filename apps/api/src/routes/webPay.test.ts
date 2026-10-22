import {
  OwnerItemsResponseSchema,
  successEnvelope,
  WebPayConfigResponseSchema,
  WebPayOrderResponseSchema,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iapPurchases, webPayOrders } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';

const ConfigRes = successEnvelope(WebPayConfigResponseSchema);
const OrderRes = successEnvelope(WebPayOrderResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const REROLL_15 = 'com.offsidelab.app.reroll_15';

/** 토스 API를 흉내 낸다: 승인 · 조회 응답을 정해 두고 부른 요청을 모은다. */
function stubToss(payment: () => Record<string, unknown> | { status: number; body: unknown }) {
  const calls: { url: string; init?: RequestInit | undefined }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const p = payment();
    if (typeof p.status === 'number' && 'body' in p)
      return new Response(JSON.stringify(p.body), { status: p.status });
    return new Response(JSON.stringify(p), { status: 200 });
  });
  return calls;
}

describe('T-11-454 웹 결제(토스페이먼츠)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    ctx.env.WEB_PAY_ENABLED = '1';
    ctx.env.TOSS_CLIENT_KEY = 'test_gck_client';
    ctx.env.TOSS_SECRET_KEY = 'test_gsk_secret';
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const order = async (cookie: string, productId = REROLL_15) =>
    OrderRes.parse(
      await (await call('POST', '/v1/web-pay/orders', { cookie, body: { productId } })).json(),
    ).data;
  const done = (o: { orderId: string; amount: number }, over: Record<string, unknown> = {}) => ({
    paymentKey: 'pay_1',
    orderId: o.orderId,
    status: 'DONE',
    totalAmount: o.amount,
    method: '카드',
    approvedAt: '2026-10-22T10:00:00+09:00',
    ...over,
  });

  it('스위치 · 키 · 테스터 목록이 맞아야 결제를 연다(로그인 구단주만)', async () => {
    const anon = await issueCookie(ctx);
    expect((await call('GET', '/v1/web-pay/config', { cookie: anon.cookie })).status).toBe(403);
    const me = await issueGoogleCookie(ctx);
    let res = ConfigRes.parse(
      await (await call('GET', '/v1/web-pay/config', { cookie: me.cookie })).json(),
    );
    expect(res.data).toMatchObject({
      enabled: true,
      clientKey: 'test_gck_client',
      customerKey: me.profileId.replace(/^prf_/, ''),
    });
    expect(res.data.products?.find((p) => p.productId === REROLL_15)).toEqual({
      productId: REROLL_15,
      item: 'reroll',
      qty: 15,
      amount: 2200,
    });
    ctx.env.WEB_PAY_TESTERS = 'prf_someone';
    res = ConfigRes.parse(
      await (await call('GET', '/v1/web-pay/config', { cookie: me.cookie })).json(),
    );
    expect(res.data).toEqual({ enabled: false });
    expect(
      (
        await call('POST', '/v1/web-pay/orders', {
          cookie: me.cookie,
          body: { productId: REROLL_15 },
        })
      ).status,
    ).toBe(503);
    delete ctx.env.WEB_PAY_TESTERS;
    ctx.env.WEB_PAY_ENABLED = '0';
    res = ConfigRes.parse(
      await (await call('GET', '/v1/web-pay/config', { cookie: me.cookie })).json(),
    );
    expect(res.data).toEqual({ enabled: false });
  });

  it('서버가 정한 금액으로 승인하고 결제 하나에 아이템을 한 번만 준다', async () => {
    const me = await issueGoogleCookie(ctx);
    const o = await order(me.cookie);
    expect(o).toMatchObject({ amount: 2200, orderName: '리롤권 15장' });
    const calls = stubToss(() => done(o));
    const body = { paymentKey: 'pay_1', orderId: o.orderId, amount: o.amount };
    let res = await call('POST', '/v1/web-pay/confirm', { cookie: me.cookie, body });
    expect(res.status).toBe(200);
    expect(ItemsRes.parse(await res.json()).data).toMatchObject({ reroll: 15 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.tosspayments.com/v1/payments/confirm');
    expect(new Headers(calls[0]!.init?.headers).get('Authorization')).toBe(
      `Basic ${btoa('test_gsk_secret:')}`,
    );
    // 새로고침으로 같은 승인을 다시 보내도 토스를 부르지 않고 그대로다.
    res = await call('POST', '/v1/web-pay/confirm', { cookie: me.cookie, body });
    expect(ItemsRes.parse(await res.json()).data).toMatchObject({ reroll: 15 });
    expect(calls).toHaveLength(1);
    expect(await ctx.db.select().from(iapPurchases)).toMatchObject([
      {
        store: 'toss',
        transactionId: 'pay_1',
        profileId: me.profileId,
        productId: REROLL_15,
        qty: 15,
        test: true,
        priceMilliunits: 2_200_000,
        currency: 'KRW',
        purchasedAt: '2026-10-22T01:00:00.000Z',
      },
    ]);
    expect(await ctx.db.select().from(webPayOrders)).toMatchObject([
      { orderId: o.orderId, status: 'DONE', paymentKey: 'pay_1', method: '카드', test: true },
    ]);
  });

  it('금액을 바꾼 요청 · 다른 구단주의 주문 · 승인되지 않은 결제는 주지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const o = await order(me.cookie);
    let payment: Record<string, unknown> | { status: number; body: unknown } = done(o);
    const calls = stubToss(() => payment);
    const confirm = (cookie: string, over: Record<string, unknown> = {}) =>
      call('POST', '/v1/web-pay/confirm', {
        cookie,
        body: { paymentKey: 'pay_1', orderId: o.orderId, amount: o.amount, ...over },
      });
    expect((await confirm(me.cookie, { amount: 100 })).status).toBe(409);
    expect((await confirm(other.cookie)).status).toBe(409);
    expect(calls).toHaveLength(0);
    payment = { status: 400, body: { code: 'REJECT_CARD_COMPANY', message: 'x' } };
    expect((await confirm(me.cookie)).status).toBe(409);
    payment = done(o, { totalAmount: 100 });
    expect((await confirm(me.cookie)).status).toBe(409);
    payment = { status: 500, body: { code: 'FAILED_INTERNAL_SYSTEM_PROCESSING' } };
    expect((await confirm(me.cookie)).status).toBe(503);
    expect(await ctx.db.select().from(iapPurchases)).toEqual([]);
    // 토스가 이미 승인한 결제라고 하면 조회로 확인해 준다.
    let n = 0;
    payment = { status: 400, body: { code: 'ALREADY_PROCESSED_PAYMENT' } };
    vi.stubGlobal('fetch', async (url: string) => {
      n += 1;
      return url.endsWith('/confirm')
        ? new Response(JSON.stringify({ code: 'ALREADY_PROCESSED_PAYMENT' }), { status: 400 })
        : new Response(JSON.stringify(done(o)), { status: 200 });
    });
    const res = await confirm(me.cookie);
    expect(res.status).toBe(200);
    expect(n).toBe(2);
  });

  it('토스에서 취소하면 웹훅으로 다시 조회해 아이템을 회수한다(본문은 믿지 않는다)', async () => {
    const me = await issueGoogleCookie(ctx);
    const o = await order(me.cookie);
    let payment: Record<string, unknown> = done(o);
    stubToss(() => payment);
    await call('POST', '/v1/web-pay/confirm', {
      cookie: me.cookie,
      body: { paymentKey: 'pay_1', orderId: o.orderId, amount: o.amount },
    });
    const hook = (paymentKey: string) =>
      createWebhook(ctx, {
        eventType: 'PAYMENT_STATUS_CHANGED',
        data: { paymentKey, status: 'CANCELED' },
      });
    // 토스 조회가 아직 DONE이면 본문이 CANCELED라도 그대로다.
    expect((await hook('pay_1')).status).toBe(200);
    let items = ItemsRes.parse(
      await (await call('GET', '/v1/items', { cookie: me.cookie })).json(),
    );
    expect(items.data.reroll).toBe(15);
    // 모르는 결제는 토스를 부르지 않는다.
    expect((await hook('pay_unknown')).status).toBe(200);
    payment = done(o, { status: 'CANCELED' });
    expect((await hook('pay_1')).status).toBe(200);
    items = ItemsRes.parse(await (await call('GET', '/v1/items', { cookie: me.cookie })).json());
    expect(items.data.reroll).toBe(0);
    expect(await ctx.db.select().from(webPayOrders)).toMatchObject([{ status: 'CANCELED' }]);
    expect((await ctx.db.select().from(iapPurchases))[0]).toMatchObject({ revokedQty: 15 });
  });
});

/** 토스 서버처럼 Origin · 쿠키 없이 보낸다. */
function createWebhook(ctx: TestD1, body: unknown) {
  return callJson(ctx.env, 'POST', '/v1/web-pay/webhook', { body, headers: { Origin: '' } });
}
