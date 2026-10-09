import { OwnerItemsResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iapPurchases, ownerItems } from '../db/schema.js';
import { resetGoogleTokenCache } from '../iap/google.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueCookie, issueGoogleCookie } from '../test/http.js';

// Apple 서명 확인 자체는 iap/apple.test.ts가 본다. 여기서는 확인 결과를 정해 두고 라우트 규칙만 본다.
const appleTx = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('../iap/apple.js', async (orig) => ({
  ...(await orig<typeof import('../iap/apple.js')>()),
  verifyAppleTransaction: async () => appleTx.current,
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
    client_email: 'verifier@example.iam.gserviceaccount.com',
    private_key: pem,
  });
}

describe('T-11-174 인앱 상품 구매 확인', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    appleTx.current = null;
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
      iap: { account: accountOf(me.profileId), stores: ['apple'] },
    });
    ctx.env.GOOGLE_PLAY_SA_JSON = '{}';
    res = ItemsRes.parse(await (await call('GET', '/v1/items', { cookie: me.cookie })).json());
    expect(res.data.iap?.stores).toEqual(['apple', 'google']);
  });

  it('Apple 거래 하나로 아이템을 한 번만 주고, 다른 계정의 거래 · 다른 상품은 받지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    appleTx.current = appleFor(me.profileId);
    const body = { store: 'apple', productId: REROLL_5, token: 'jws' };
    let res = await claim(me.cookie, body);
    expect(res.status).toBe(200);
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 5, boost: 0 });
    // 같은 거래를 다시 보내도(앱이 응답을 못 받아 재전송) 그대로다.
    res = await claim(me.cookie, body);
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 5, boost: 0 });
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
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 0, boost: 3 });
    for (const left of [2, 1, 0]) {
      const used = await call('POST', '/v1/items/boost/use', {
        cookie: me.cookie,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      expect(ItemsRes.parse(await used.json()).data).toEqual({ reroll: 0, boost: left });
    }
    const empty = await call('POST', '/v1/items/boost/use', {
      cookie: me.cookie,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    expect(empty.status).toBe(409);
    expect(await empty.json()).toMatchObject({ error: { details: { reason: 'NO_BOOST' } } });
    expect((await ctx.db.select().from(iapPurchases))[0]?.test).toBe(false);
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
    expect(ItemsRes.parse(await res.json()).data).toEqual({ reroll: 5, boost: 0 });
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
});
