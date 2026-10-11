import { OwnerItemsResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iapPurchases, ownerItems } from '../db/schema.js';
import { resetGoogleTokenCache } from '../iap/google.js';
import { syncGoogleVoided } from '../iap/refunds.js';
import { createApp } from '../app.js';
import { createDb } from '../db/client.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueCookie, issueGoogleCookie } from '../test/http.js';

// Apple 서명 확인 자체는 iap/apple.test.ts가 본다. 여기서는 확인 결과를 정해 두고 라우트 규칙만 본다.
const appleTx = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const appleNote = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('../iap/apple.js', async (orig) => ({
  ...(await orig<typeof import('../iap/apple.js')>()),
  verifyAppleTransaction: async () => appleTx.current,
  verifyAppleNotification: async () => appleNote.current,
}));

const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const REROLL_5 = 'com.offsidelab.app.reroll_5';
const BOOST_3 = 'com.offsidelab.app.boost_3';
const accountOf = (profileId: string) => profileId.replace(/^prf_/, '');

async function serviceAccountJson() {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const der = new Uint8Array(
    (await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer,
  );
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;
  return JSON.stringify({
    client_email: 'verifier@example.com',
    private_key: pem,
  });
}

describe('T-11-174 인앱 상품 구매 확인', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    appleTx.current = null;
    appleNote.current = null;
    resetGoogleTokenCache();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const claim = (cookie: string, body: Record<string, string>) =>
    call('POST', '/v1/items/iap', { cookie, body });
  const appleFor = (profileId: string, over: Record<string, unknown> = {}) => ({
    transactionId: '2000000001',
    bundleId: 'com.offsidelab.app',
    productId: REROLL_5,
    type: 'Consumable',
    environment: 'Sandbox',
    appAccountToken: accountOf(profileId),
    ...over,
  });

  it('구단주 표시와 확인할 수 있는 스토어를 알려 준다(Google은 키가 있어야 한다)', async () => {
    const me = await issueGoogleCookie(ctx);
    let res = ItemsRes.parse(await (await call('GET', '/v1/items', { cookie: me.cookie })).json());
    expect(res.data).toEqual({
      reroll: 0,
      boost: 0,
      scout: 0,
      iap: { account: accountOf(me.profileId), stores: ['apple'] },
    });
    ctx.env.GOOGLE_PLAY_SA_JSON = '{}';
    res = ItemsRes.parse(await (await call('GET', '/v1/items', { cookie: me.cookie })).json());
    expect(res.data.iap?.stores).toEqual(['apple', 'google']);
    // 테스터 목록이 있으면 목록 밖 구단주는 살 수 없다(목록도 보이지 않고 구매 확인도 503).
    const tester = await issueGoogleCookie(ctx);
    ctx.env.IAP_TESTERS = `prf_x, ${tester.profileId}`;
    res = ItemsRes.parse(await (await call('GET', '/v1/items', { cookie: me.cookie })).json());
    expect(res.data.iap?.stores).toEqual([]);
    expect(
      (await claim(me.cookie, { store: 'apple', productId: REROLL_5, token: 'jws' })).status,
    ).toBe(503);
    res = ItemsRes.parse(await (await call('GET', '/v1/items', { cookie: tester.cookie })).json());
    expect(res.data.iap?.stores).toEqual(['apple', 'google']);
  });

  it('Apple 거래 하나로 아이템을 한 번만 주고, 다른 계정의 거래 · 다른 상품은 받지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    appleTx.current = appleFor(me.profileId);
    const body = { store: 'apple', productId: REROLL_5, token: 'jws' };
    let res = await claim(me.cookie, body);
    expect(res.status).toBe(200);
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 5, boost: 0, scout: 0 });
    // 같은 거래를 다시 보내도(앱이 응답을 못 받아 재전송) 그대로다.
    res = await claim(me.cookie, body);
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 5, boost: 0, scout: 0 });
    const rows = await ctx.db.select().from(iapPurchases);
    expect(rows).toMatchObject([
      { store: 'apple', transactionId: '2000000001', item: 'reroll', qty: 5, test: true },
    ]);

    // 같은 거래를 다른 구단주가 보내면 받지 않는다.
    const other = await issueGoogleCookie(ctx);
    res = await claim(other.cookie, body);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { details: { reason: 'IAP_OTHER_ACCOUNT' } } });

    // 상품이 다르거나 앱이 다르면 INVALID.
    appleTx.current = appleFor(me.profileId, { transactionId: '2', productId: BOOST_3 });
    res = await claim(me.cookie, body);
    expect(await res.json()).toMatchObject({ error: { details: { reason: 'IAP_INVALID' } } });
    appleTx.current = appleFor(me.profileId, { transactionId: '3', bundleId: 'com.other' });
    expect((await claim(me.cookie, body)).status).toBe(409);
    // 환불된 거래.
    appleTx.current = appleFor(me.profileId, { transactionId: '4', revocationDate: 1 });
    expect((await claim(me.cookie, body)).status).toBe(409);
    // 서명 확인에 실패했다.
    appleTx.current = null;
    expect((await claim(me.cookie, body)).status).toBe(409);
  });

  it('강화권을 사서 한 장씩 쓰고, 없으면 409', async () => {
    const me = await issueGoogleCookie(ctx);
    appleTx.current = appleFor(me.profileId, { productId: BOOST_3, environment: 'Production' });
    const res = await claim(me.cookie, { store: 'apple', productId: BOOST_3, token: 'jws' });
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 0, boost: 3, scout: 0 });
    for (const left of [2, 1, 0]) {
      const used = await call('POST', '/v1/items/boost/use', {
        cookie: me.cookie,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      expect(ItemsRes.parse(await used.json()).data).toEqual({ reroll: 0, boost: left, scout: 0 });
    }
    const empty = await call('POST', '/v1/items/boost/use', {
      cookie: me.cookie,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    expect(empty.status).toBe(409);
    expect(await empty.json()).toMatchObject({ error: { details: { reason: 'NO_BOOST' } } });
    expect((await ctx.db.select().from(iapPurchases))[0]?.test).toBe(false);
  });

  it('프리미엄 스카우트권을 사서 쓰고, 없으면 409(T-11-196)', async () => {
    const me = await issueGoogleCookie(ctx);
    const SCOUT_1 = 'com.offsidelab.app.scout_1';
    appleTx.current = appleFor(me.profileId, { productId: SCOUT_1, environment: 'Production' });
    const res = await claim(me.cookie, { store: 'apple', productId: SCOUT_1, token: 'jws' });
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 0, boost: 0, scout: 1 });
    const use = () =>
      call('POST', '/v1/items/scout/use', {
        cookie: me.cookie,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
    expect(ItemsRes.parse(await (await use()).json()).data).toEqual({
      reroll: 0,
      boost: 0,
      scout: 0,
    });
    const empty = await use();
    expect(empty.status).toBe(409);
    expect(await empty.json()).toMatchObject({ error: { details: { reason: 'NO_SCOUT' } } });
  });

  it('계정을 지우면 아이템과 구매 원장도 지운다', async () => {
    const me = await issueGoogleCookie(ctx);
    appleTx.current = appleFor(me.profileId);
    await claim(me.cookie, { store: 'apple', productId: REROLL_5, token: 'jws' });
    expect(await ctx.db.select().from(iapPurchases)).toHaveLength(1);
    await deleteProfile(ctx.env, me.cookie, 'iap-delete');
    expect(await ctx.db.select().from(iapPurchases)).toHaveLength(0);
    expect(await ctx.db.select().from(ownerItems)).toHaveLength(0);
  });

  it('로그인하지 않은 프로필은 살 수 없다', async () => {
    const guest = await issueCookie(ctx);
    const res = await claim(guest.cookie, { store: 'apple', productId: REROLL_5, token: 'jws' });
    expect(res.status).toBe(403);
  });

  it('Google 구매를 Play Developer API로 확인하고 승인한다. 키가 없으면 503, 대기 중이면 409', async () => {
    const me = await issueGoogleCookie(ctx);
    const body = { store: 'google', productId: REROLL_5, token: 'tok-1' };
    expect((await claim(me.cookie, body)).status).toBe(503);

    ctx.env.GOOGLE_PLAY_SA_JSON = await serviceAccountJson();
    let purchase: Record<string, unknown> = {
      purchaseState: 0,
      acknowledgementState: 0,
      purchaseType: 0,
      obfuscatedExternalAccountId: accountOf(me.profileId),
    };
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (url.startsWith('https://oauth2.googleapis.com/token'))
          return Response.json({ access_token: 'at', expires_in: 3600 });
        if (url.endsWith(':acknowledge')) return new Response('{}');
        return Response.json(purchase);
      }),
    );
    let res = await claim(me.cookie, body);
    expect(res.status).toBe(200);
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 5, boost: 0, scout: 0 });
    expect(calls).toEqual([
      'POST https://oauth2.googleapis.com/token',
      'GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.offsidelab.app/purchases/products/com.offsidelab.app.reroll_5/tokens/tok-1',
      'POST https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.offsidelab.app/purchases/products/com.offsidelab.app.reroll_5/tokens/tok-1:acknowledge',
    ]);
    expect((await ctx.db.select().from(iapPurchases))[0]).toMatchObject({
      store: 'google',
      transactionId: 'tok-1',
      test: true,
    });

    purchase = { purchaseState: 2, obfuscatedExternalAccountId: accountOf(me.profileId) };
    res = await claim(me.cookie, { ...body, token: 'tok-2' });
    expect(await res.json()).toMatchObject({ error: { details: { reason: 'IAP_PENDING' } } });
    purchase = { purchaseState: 0, obfuscatedExternalAccountId: 'someone-else' };
    res = await claim(me.cookie, { ...body, token: 'tok-3' });
    expect(await res.json()).toMatchObject({ error: { details: { reason: 'IAP_OTHER_ACCOUNT' } } });
  });

  it('T-11-215 Apple 환불 알림이 오면 가진 장수 안에서 한 번만 회수한다', async () => {
    const me = await issueGoogleCookie(ctx);
    appleTx.current = appleFor(me.profileId);
    await claim(me.cookie, { store: 'apple', productId: REROLL_5, token: 'jws' });
    // 2장을 이미 썼다.
    await ctx.env.DB.prepare(`UPDATE owner_items SET qty = 3 WHERE item = 'reroll'`).run();
    // Apple 서버는 쿠키도 Origin도 없이 보낸다.
    const notify = () =>
      createApp().request(
        '/v1/iap/apple/notifications',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signedPayload: 'jws' }),
        },
        ctx.env,
      );
    // 서명이 틀리면 400.
    expect((await notify()).status).toBe(400);
    // 환불이 아닌 알림 · 다른 앱은 받기만 한다.
    appleNote.current = {
      notificationType: 'CONSUMPTION_REQUEST',
      data: { bundleId: 'com.offsidelab.app' },
    };
    expect((await notify()).status).toBe(200);
    appleNote.current = {
      notificationType: 'REFUND',
      data: { bundleId: 'com.other', signedTransactionInfo: 'tx' },
    };
    expect((await notify()).status).toBe(200);
    expect((await ctx.db.select().from(ownerItems))[0]?.qty).toBe(3);

    appleNote.current = {
      notificationType: 'REFUND',
      data: { bundleId: 'com.offsidelab.app', signedTransactionInfo: 'tx' },
    };
    expect((await notify()).status).toBe(200);
    expect((await ctx.db.select().from(ownerItems))[0]?.qty).toBe(0);
    expect((await ctx.db.select().from(iapPurchases))[0]).toMatchObject({ qty: 5, revokedQty: 3 });
    expect((await ctx.db.select().from(iapPurchases))[0]?.refundedAt).toBeTruthy();
    // Apple이 같은 알림을 다시 보내도 그대로다(그사이 새로 받은 장수는 건드리지 않는다).
    await ctx.env.DB.prepare(`UPDATE owner_items SET qty = 2 WHERE item = 'reroll'`).run();
    expect((await notify()).status).toBe(200);
    expect((await ctx.db.select().from(ownerItems))[0]?.qty).toBe(2);
    // 우리가 모르는 거래도 200.
    appleTx.current = appleFor(me.profileId, { transactionId: '999' });
    expect((await notify()).status).toBe(200);
  });

  it('T-11-215 Google이 무효화한 구매를 매일 읽어 회수한다', async () => {
    const me = await issueGoogleCookie(ctx);
    expect(await syncGoogleVoided(ctx.env, createDb(ctx.env.DB), Date.now())).toBe('skipped');
    ctx.env.GOOGLE_PLAY_SA_JSON = await serviceAccountJson();
    const purchase = {
      purchaseState: 0,
      acknowledgementState: 1,
      obfuscatedExternalAccountId: accountOf(me.profileId),
    };
    const asked: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('https://oauth2.googleapis.com/token'))
          return Response.json({ access_token: 'at', expires_in: 3600 });
        if (url.includes('/voidedpurchases')) {
          asked.push(new URL(url).searchParams.get('token') ?? 'first');
          return url.includes('token=p2')
            ? Response.json({ voidedPurchases: [{ purchaseToken: 'tok-x' }] })
            : Response.json({
                voidedPurchases: [{ purchaseToken: 'tok-1' }],
                tokenPagination: { nextPageToken: 'p2' },
              });
        }
        return Response.json(purchase);
      }),
    );
    await claim(me.cookie, { store: 'google', productId: REROLL_5, token: 'tok-1' });
    const now = Date.now();
    expect(await syncGoogleVoided(ctx.env, createDb(ctx.env.DB), now)).toEqual({
      seen: 2,
      revoked: 1,
      unknown: 1,
    });
    expect(asked).toEqual(['first', 'p2']);
    expect((await ctx.db.select().from(ownerItems))[0]?.qty).toBe(0);
    // 다음 날 같은 목록을 다시 읽어도 한 번만 회수한다.
    expect(await syncGoogleVoided(ctx.env, createDb(ctx.env.DB), now)).toMatchObject({
      revoked: 0,
    });
  });
});
