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

  it('T-11-620 스카우트권 50장 묶음을 팔고 결제마다 50장을 한 번만 주고 남은 장수만 회수한다', async () => {
    const me = await issueGoogleCookie(ctx);
    const productId = 'com.offsidelab.app.scout_50';
    const calls = stubXsolla();
    expect(
      ConfigRes.parse(await (await call('GET', '/v1/web-pay/config', { cookie: me.cookie })).json())
        .data.products,
    ).toContainEqual({ productId, item: 'scout', qty: 50, amount: 39500 });
    await order(me.cookie, productId);
    expect(JSON.parse(String(calls[0]?.init?.body)).purchase.items[0].sku).toBe(productId);
    const event = paid(1050, me.profileId, {
      items: [{ sku: productId, type: 'virtual_good', quantity: 1, amount: '39500' }],
    });
    expect((await hook(ctx, event)).status).toBe(204);
    expect((await hook(ctx, event)).status).toBe(204);
    expect((await items(me.cookie)).scout).toBe(50);
    await ctx.env.DB.prepare("UPDATE owner_items SET qty = 20 WHERE item = 'scout'").run();
    const refund = { ...event, notification_type: 'order_canceled' };
    expect((await hook(ctx, refund)).status).toBe(204);
    expect((await items(me.cookie)).scout).toBe(0);
    expect(await ctx.db.select().from(iapPurchases)).toMatchObject([
      { productId, item: 'scout', qty: 50, revokedQty: 20 },
    ]);
  });

  it('T-11-700 크리에이터 추적값은 형식이 맞을 때만 받고 결제 토큰의 user.tracking_id로 넘긴다', async () => {
    const me = await issueGoogleCookie(ctx);
    const calls = stubXsolla();
    const trackingId = 'abcdefghijklmnopqrstuvwxyz123456';
    const post = (body: Record<string, unknown>) =>
      call('POST', '/v1/web-pay/orders', { cookie: me.cookie, body });
    expect((await post({ productId: REROLL_15, trackingId })).status).toBe(201);
    expect(JSON.parse(String(calls[0]?.init?.body)).user.tracking_id).toEqual({
      value: trackingId,
    });
    // T-11-704 주문에 실린 값은 프로필에 묶여, 브라우저 값이 없는 다음 주문에도 실린다.
    expect((await post({ productId: REROLL_15 })).status).toBe(201);
    expect(JSON.parse(String(calls[1]?.init?.body)).user.tracking_id).toEqual({
      value: trackingId,
    });
    // 형식이 틀린 값은 엑솔라에 보내지 않고 거절한다.
    expect((await post({ productId: REROLL_15, trackingId: 'short' })).status).toBe(400);
    expect(calls).toHaveLength(2);
  });

  it('T-11-700 추적값 때문에 토큰이 거절되면 추적값 없이 다시 만들어 결제를 막지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const bodies: { user: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { user: Record<string, unknown> };
      bodies.push(body);
      return 'tracking_id' in body.user
        ? new Response(JSON.stringify({ errorCode: 1 }), { status: 422 })
        : new Response(JSON.stringify({ token: 'tok_1', order_id: 2001 }), { status: 201 });
    });
    const res = await call('POST', '/v1/web-pay/orders', {
      cookie: me.cookie,
      body: { productId: REROLL_15, trackingId: 'abcdefghijklmnopqrstuvwxyz123456' },
    });
    expect(res.status).toBe(201);
    expect(bodies.map((b) => 'tracking_id' in b.user)).toEqual([true, false]);
  });

  it('T-11-704 크리에이터 링크로 들어온 프로필은 브라우저 값이 없어도 90일 동안 결제 토큰에 추적값을 싣는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const calls = stubXsolla();
    const trackingId = 'abcdefghijklmnopqrstuvwxyz123456';
    const attribute = (body: Record<string, unknown>, cookie = me.cookie) =>
      call('POST', '/v1/creator-attribution', { cookie, body });
    const order = async () =>
      (
        await call('POST', '/v1/web-pay/orders', {
          cookie: me.cookie,
          body: { productId: REROLL_15 },
        })
      ).status;
    expect((await attribute({ trackingId: 'short' })).status).toBe(400);
    expect((await attribute({ trackingId })).status).toBe(204);
    expect(await order()).toBe(201);
    expect(JSON.parse(String(calls.at(-1)?.init?.body)).user.tracking_id).toEqual({
      value: trackingId,
    });
    // 다른 링크로 다시 들어오면 그 크리에이터로 바뀐다.
    const next = trackingId.toUpperCase();
    expect((await attribute({ trackingId: next })).status).toBe(204);
    expect(await order()).toBe(201);
    expect(JSON.parse(String(calls.at(-1)?.init?.body)).user.tracking_id).toEqual({ value: next });
    // 90일이 지나면 싣지 않는다.
    const old = new Date(Date.now() - 91 * 86_400_000).toISOString();
    await ctx.env.DB.prepare(
      'UPDATE creator_attributions SET attributed_at = ? WHERE profile_id = ?',
    )
      .bind(old, me.profileId)
      .run();
    expect(await order()).toBe(201);
    expect(JSON.parse(String(calls.at(-1)?.init?.body)).user).not.toHaveProperty('tracking_id');
    // 주문에 실린 브라우저 값은 프로필에도 묶여 기간이 새로 시작한다.
    expect(
      (
        await call('POST', '/v1/web-pay/orders', {
          cookie: me.cookie,
          body: { productId: REROLL_15, trackingId },
        })
      ).status,
    ).toBe(201);
    expect(await order()).toBe(201);
    expect(JSON.parse(String(calls.at(-1)?.init?.body)).user.tracking_id).toEqual({
      value: trackingId,
    });
  });

  it('T-11-704 로그인 전 익명 프로필도 링크를 기록하고, 링크가 없는 프로필은 지금처럼 싣지 않는다', async () => {
    const anon = await issueCookie(ctx);
    const res = await call('POST', '/v1/creator-attribution', {
      cookie: anon.cookie,
      body: { trackingId: 'abcdefghijklmnopqrstuvwxyz123456' },
    });
    expect(res.status).toBe(204);
    const row = await ctx.env.DB.prepare(
      'SELECT tracking_id FROM creator_attributions WHERE profile_id = ?',
    )
      .bind(anon.profileId)
      .first<{ tracking_id: string }>();
    expect(row?.tracking_id).toBe('abcdefghijklmnopqrstuvwxyz123456');
    const me = await issueGoogleCookie(ctx);
    const calls = stubXsolla();
    await call('POST', '/v1/web-pay/orders', { cookie: me.cookie, body: { productId: REROLL_15 } });
    expect(JSON.parse(String(calls[0]?.init?.body)).user).not.toHaveProperty('tracking_id');
  });

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
    await call('POST', '/v1/items/boost/use', {
      cookie: me.cookie,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    expect((await items(me.cookie)).boost).toBe(99);
    const refund = { ...event, notification_type: 'order_canceled' };
    expect((await hook(ctx, refund)).status).toBe(204);
    expect((await hook(ctx, refund)).status).toBe(204);
    expect((await items(me.cookie)).boost).toBe(0);
    expect(await ctx.db.select().from(iapPurchases)).toMatchObject([
      { productId, qty: 100, revokedQty: 99 },
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
