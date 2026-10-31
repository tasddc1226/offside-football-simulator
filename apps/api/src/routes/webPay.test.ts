import {
  OwnerItemsResponseSchema,
  successEnvelope,
  WebPayConfigResponseSchema,
  WebPayOrderResponseSchema,
  WebPayOrderStatusResponseSchema,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iapPurchases, webPayOrders } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';
import { createApp } from '../app.js';

const ConfigRes = successEnvelope(WebPayConfigResponseSchema);
const OrderRes = successEnvelope(WebPayOrderResponseSchema);
const StatusRes = successEnvelope(WebPayOrderStatusResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const REROLL_15 = 'com.offsidelab.app.reroll_15';
const SECRET = 'hook_secret';

/** 엑솔라 토큰 API를 흉내 낸다: 부른 요청을 모으고 주문 번호를 하나씩 올려 준다. */
function stubXsolla(status = 201) {
  const calls: { url: string; init?: RequestInit | undefined }[] = [];
  let n = 1000;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    n += 1;
    return new Response(
      JSON.stringify(status === 201 ? { token: `tok_${n}`, order_id: n } : { errorCode: 1 }),
      { status },
    );
  });
  return calls;
}

async function sha1(text: string) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 엑솔라 서버처럼 Origin · 쿠키 없이, 본문 서명을 붙여 보낸다. */
async function hook(ctx: TestD1, body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  return createApp().request(
    '/v1/web-pay/webhook',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Signature ${await sha1(raw + secret)}`,
      },
      body: raw,
    },
    ctx.env,
  );
}

const paid = (orderId: number, userId: string, over: Record<string, unknown> = {}) => ({
  notification_type: 'order_paid',
  items: [{ sku: REROLL_15, type: 'virtual_good', quantity: 1, amount: '2200' }],
  order: { id: orderId, mode: 'sandbox', status: 'paid' },
  user: { external_id: userId, country: 'US' },
  billing: {
    purchase: { total: { currency: 'USD', amount: 1.99 } },
    transaction: { id: 9, payment_date: '2026-10-22T10:00:00+09:00', dry_run: 1 },
  },
  ...over,
});

describe('T-11-454 웹 결제(엑솔라)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    ctx.env.WEB_PAY_ENABLED = '1';
    ctx.env.XSOLLA_PROJECT_ID = '300000';
    ctx.env.XSOLLA_API_KEY = 'api_key';
    ctx.env.XSOLLA_WEBHOOK_SECRET = SECRET;
    ctx.env.XSOLLA_SANDBOX = '1';
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const order = async (cookie: string, productId = REROLL_15) =>
    OrderRes.parse(
      await (
        await call('POST', '/v1/web-pay/orders?lang=en', { cookie, body: { productId } })
      ).json(),
    ).data;
  const items = async (cookie: string) =>
    ItemsRes.parse(await (await call('GET', '/v1/items', { cookie })).json()).data;

  it('opens the 100-ticket pack only after catalog readiness and grants it once', async () => {
    const me = await issueGoogleCookie(ctx);
    const productId = 'com.offsidelab.app.boost_100';
    const calls = stubXsolla();
    const config = async () =>
      ConfigRes.parse(await (await call('GET', '/v1/web-pay/config', { cookie: me.cookie })).json())
        .data;
    expect((await config()).products?.some((p) => p.productId === productId)).toBe(false);
    expect(
      (
        await call('POST', '/v1/web-pay/orders', {
          cookie: me.cookie,
          body: { productId },
        })
      ).status,
    ).toBe(503);
    expect(calls).toHaveLength(0);
    ctx.env.WEB_PAY_BOOST_100_ENABLED = '1';
    expect((await config()).products).toContainEqual({
      productId,
      item: 'boost',
      qty: 100,
      amount: 19800,
    });
    await order(me.cookie, productId);
    expect(JSON.parse(String(calls[0]?.init?.body)).purchase.items[0].sku).toBe(productId);
    const event = paid(1001, me.profileId, {
      items: [{ sku: productId, type: 'virtual_good', quantity: 1, amount: '19800' }],
    });
    // Turning sales off must not strand a payment already in progress.
    delete ctx.env.WEB_PAY_BOOST_100_ENABLED;
    expect((await hook(ctx, event)).status).toBe(204);
    expect((await hook(ctx, event)).status).toBe(204);
    expect((await items(me.cookie)).boost).toBe(100);
    expect(await ctx.db.select().from(iapPurchases)).toMatchObject([
      { productId, item: 'boost', qty: 100 },
    ]);
  });

  it('스위치 · 키 · 테스터 목록이 맞아야 결제를 연다(로그인 구단주만)', async () => {
    const anon = await issueCookie(ctx);
    expect((await call('GET', '/v1/web-pay/config', { cookie: anon.cookie })).status).toBe(403);
    const me = await issueGoogleCookie(ctx);
    let res = ConfigRes.parse(
      await (await call('GET', '/v1/web-pay/config', { cookie: me.cookie })).json(),
    );
    expect(res.data.enabled).toBe(true);
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
    const calls = stubXsolla();
    expect(
      (
        await call('POST', '/v1/web-pay/orders', {
          cookie: me.cookie,
          body: { productId: REROLL_15 },
        })
      ).status,
    ).toBe(503);
    expect(calls).toHaveLength(0);
    delete ctx.env.WEB_PAY_TESTERS;
    delete ctx.env.XSOLLA_WEBHOOK_SECRET;
    res = ConfigRes.parse(
      await (await call('GET', '/v1/web-pay/config', { cookie: me.cookie })).json(),
    );
    expect(res.data).toEqual({ enabled: false });
  });

  it('주문을 만들면 엑솔라 토큰으로 샌드박스 결제창 주소를 돌려준다', async () => {
    const me = await issueGoogleCookie(ctx);
    const calls = stubXsolla();
    const o = await order(me.cookie);
    expect(o.payUrl).toBe('https://sandbox-secure.xsolla.com/paystation4/?token=tok_1001');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      'https://store.xsolla.com/api/v3/project/300000/admin/payment/token',
    );
    expect(new Headers(calls[0]!.init?.headers).get('Authorization')).toBe(
      `Basic ${btoa('300000:api_key')}`,
    );
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
      sandbox: true,
      user: { id: { value: me.profileId } },
      purchase: { items: [{ sku: REROLL_15, quantity: 1 }] },
      settings: {
        language: 'en',
        return_url: `http://localhost:5173/?webpay=${o.orderId}`,
      },
    });
    expect(await ctx.db.select().from(webPayOrders)).toMatchObject([
      {
        orderId: o.orderId,
        profileId: me.profileId,
        xsollaOrderId: '1001',
        status: 'READY',
        test: true,
      },
    ]);
    // 엑솔라가 실패하면 주문을 남기지 않고 503.
    stubXsolla(422);
    expect(
      (
        await call('POST', '/v1/web-pay/orders', {
          cookie: me.cookie,
          body: { productId: REROLL_15 },
        })
      ).status,
    ).toBe(503);
    expect(await ctx.db.select().from(webPayOrders)).toHaveLength(1);
  });

  it('결제 웹훅으로 아이템을 한 번만 주고, 주문 상태는 주문한 구단주만 본다', async () => {
    const me = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    stubXsolla();
    const o = await order(me.cookie);
    const status = async (cookie: string) =>
      call('GET', `/v1/web-pay/orders/${o.orderId}`, { cookie });
    expect(StatusRes.parse(await (await status(me.cookie)).json()).data.status).toBe('READY');
    expect((await hook(ctx, paid(1001, me.profileId))).status).toBe(204);
    expect((await hook(ctx, paid(1001, me.profileId))).status).toBe(204);
    expect((await items(me.cookie)).reroll).toBe(15);
    expect(StatusRes.parse(await (await status(me.cookie)).json()).data.status).toBe('PAID');
    expect((await status(other.cookie)).status).toBe(404);
    expect(await ctx.db.select().from(iapPurchases)).toMatchObject([
      {
        store: 'xsolla',
        transactionId: '1001',
        profileId: me.profileId,
        productId: REROLL_15,
        qty: 15,
        test: true,
        priceMilliunits: 1990,
        currency: 'USD',
        purchasedAt: '2026-10-22T01:00:00.000Z',
      },
    ]);
  });

  it('서명 · 사용자 · 상품이 맞지 않는 웹훅은 400이고 아무것도 주지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    stubXsolla();
    await order(me.cookie);
    expect((await hook(ctx, paid(1001, me.profileId), 'wrong')).status).toBe(400);
    expect((await hook(ctx, paid(1001, 'prf_nobody'))).status).toBe(400);
    // 주문과 다른 구단주 · 다른 상품이면 주지 않는다.
    expect((await hook(ctx, paid(1001, other.profileId))).status).toBe(400);
    expect(
      (
        await hook(
          ctx,
          paid(1001, me.profileId, {
            items: [{ sku: 'com.offsidelab.app.reroll_40', quantity: 1 }],
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await hook(ctx, paid(1001, me.profileId, { items: [{ sku: 'unknown', quantity: 1 }] })))
        .status,
    ).toBe(400);
    expect(await ctx.db.select().from(iapPurchases)).toEqual([]);
    // 사용자 확인: 있는 프로필이면 204, 없으면 400 INVALID_USER.
    expect(
      (await hook(ctx, { notification_type: 'user_validation', user: { id: me.profileId } }))
        .status,
    ).toBe(204);
    const bad = await hook(ctx, {
      notification_type: 'user_validation',
      user: { id: 'prf_nobody' },
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: 'INVALID_USER' } });
    // 다루지 않는 알림은 받았다고만 답한다.
    expect((await hook(ctx, { notification_type: 'payment' })).status).toBe(204);
  });

  it('환불 웹훅이면 회수하고, 결제보다 먼저 와도 나중 결제가 아이템을 주지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    stubXsolla();
    const o = await order(me.cookie);
    await hook(ctx, paid(1001, me.profileId));
    expect((await items(me.cookie)).reroll).toBe(15);
    const cancel = (id: number) => ({
      ...paid(id, me.profileId),
      notification_type: 'order_canceled',
    });
    expect((await hook(ctx, cancel(1001))).status).toBe(204);
    expect((await items(me.cookie)).reroll).toBe(0);
    expect(
      StatusRes.parse(
        await (await call('GET', `/v1/web-pay/orders/${o.orderId}`, { cookie: me.cookie })).json(),
      ).data.status,
    ).toBe('CANCELED');
    expect((await ctx.db.select().from(iapPurchases))[0]).toMatchObject({ revokedQty: 15 });
    // 취소가 먼저 온 주문.
    await order(me.cookie);
    expect((await hook(ctx, cancel(1002))).status).toBe(204);
    expect((await hook(ctx, paid(1002, me.profileId))).status).toBe(204);
    expect((await items(me.cookie)).reroll).toBe(0);
  });
});
