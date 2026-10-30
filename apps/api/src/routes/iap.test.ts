import { OwnerItemsResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iapPurchases, ownerItems } from '../db/schema.js';
import { resetGoogleTokenCache } from '../iap/google.js';
import { syncGoogleVoided } from '../iap/refunds.js';
import { createApp } from '../app.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { applySeasonSchedule } from '@offside/contracts/service-seasons';
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
      rename: 0,
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
    ctx.env.BILLING_ALERTS_ENABLED = '1';
    appleTx.current = appleFor(me.profileId);
    const body = { store: 'apple', productId: REROLL_5, token: 'jws' };
    let res = await claim(me.cookie, body);
    expect(res.status).toBe(200);
    expect(ItemsRes.parse(await res.json()).data).toEqual({
      reroll: 5,
      boost: 0,
      scout: 0,
      rename: 0,
    });
    // 같은 거래를 다시 보내도(앱이 응답을 못 받아 재전송) 그대로다.
    res = await claim(me.cookie, body);
    expect(ItemsRes.parse(await res.json()).data).toEqual({
      reroll: 5,
      boost: 0,
      scout: 0,
      rename: 0,
    });
    expect((await ctx.env.DB.prepare('SELECT * FROM billing_alerts').all()).results).toHaveLength(
      1,
    );
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
    expect(ItemsRes.parse(await res.json()).data).toEqual({
      reroll: 0,
      boost: 3,
      scout: 0,
      rename: 0,
    });
    for (const left of [2, 1, 0]) {
      const used = await call('POST', '/v1/items/boost/use', {
        cookie: me.cookie,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      expect(ItemsRes.parse(await used.json()).data).toEqual({
        reroll: 0,
        boost: left,
        scout: 0,
        rename: 0,
      });
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
    expect(ItemsRes.parse(await res.json()).data).toEqual({
      reroll: 0,
      boost: 0,
      scout: 1,
      rename: 0,
    });
    const use = () =>
      call('POST', '/v1/items/scout/use', {
        cookie: me.cookie,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
    // 본문이 없는 옛 앱도 천장 장수는 센다(확정 모드는 받지 않는다).
    expect(ItemsRes.parse(await (await use()).json()).data).toEqual({
      reroll: 0,
      boost: 0,
      scout: 0,
      rename: 0,
      pity: { used: 1, streak: 1, elites: 0 },
      scoutMode: 'normal',
    });
    const empty = await use();
    expect(empty.status).toBe(409);
    expect(await empty.json()).toMatchObject({ error: { details: { reason: 'NO_SCOUT' } } });
  });

  it('T-11-244 S 없이 29장을 쓰면 30장째는 S 확정, 누적 100장째는 특급 S, 옛 앱은 확정을 받지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const now = new Date().toISOString();
    await ctx.db
      .insert(ownerItems)
      .values({ profileId: me.profileId, item: 'scout', qty: 200, updatedAt: now });
    const use = async (body?: { hit: boolean }) =>
      ItemsRes.parse(
        await (
          await call('POST', '/v1/items/scout/use', {
            cookie: me.cookie,
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            ...(body ? { body } : {}),
          })
        ).json(),
      ).data;
    for (let i = 1; i <= 29; i++) {
      const r = await use({ hit: false });
      expect(r.scoutMode).toBe('normal');
      expect(r.pity).toEqual({ used: i, streak: i, elites: 0 });
    }
    const sure = await use({ hit: false });
    expect(sure.scoutMode).toBe('sure');
    expect(sure.pity).toEqual({ used: 30, streak: 0, elites: 0 });
    // 일반 후보에 S가 나오면 0으로 돌아간다.
    await use({ hit: false });
    expect((await use({ hit: true })).pity).toEqual({ used: 32, streak: 0, elites: 0 });
    // 옛 앱은 streak가 넘어도 확정을 받지 않고 장수만 쌓인다.
    for (let i = 0; i < 35; i++) expect((await use()).scoutMode).toBe('normal');
    expect((await use()).pity).toEqual({ used: 68, streak: 36, elites: 0 });
    // 천장을 아는 앱은 밀린 확정을 바로 받는다.
    expect((await use({ hit: false })).scoutMode).toBe('sure');
    await ctx.env.DB.prepare('UPDATE scout_pity SET used = 99').run();
    const elite = await use({ hit: false });
    expect(elite.scoutMode).toBe('elite');
    expect(elite.pity).toEqual({ used: 100, streak: 0, elites: 1 });
    expect((await use({ hit: false })).scoutMode).toBe('normal');
    const items = ItemsRes.parse(
      await (await call('GET', '/v1/items', { cookie: me.cookie })).json(),
    );
    expect(items.data.pity).toEqual({ used: 101, streak: 1, elites: 1 });
    expect(items.data.scout).toBe(200 - 71);
  });

  it('T-11-450 시즌 2부터는 S 없이 19장 뒤 20장째가 S 확정, 누적 70장째가 특급 S', async () => {
    await saveSeasonSchedule(ctx.env.DB, [
      {
        id: 1,
        startsAt: '2026-10-05T15:00:00.000Z',
        endsAt: '2026-10-30T15:00:00.000Z',
        retireAt: 45,
      },
      { id: 2, startsAt: '2026-10-30T15:00:00.000Z', endsAt: null, retireAt: 46 },
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-02T00:00:00.000Z'));
    try {
      const me = await issueGoogleCookie(ctx);
      await ctx.db.insert(ownerItems).values({
        profileId: me.profileId,
        item: 'scout',
        qty: 100,
        updatedAt: new Date().toISOString(),
      });
      const use = async () =>
        ItemsRes.parse(
          await (
            await call('POST', '/v1/items/scout/use', {
              cookie: me.cookie,
              headers: { 'Idempotency-Key': crypto.randomUUID() },
              body: { hit: false },
            })
          ).json(),
        ).data;
      for (let i = 1; i <= 19; i++) expect((await use()).scoutMode).toBe('normal');
      const sure = await use();
      expect(sure.scoutMode).toBe('sure');
      expect(sure.pity).toEqual({ used: 20, streak: 0, elites: 0 });
      await ctx.env.DB.prepare('UPDATE scout_pity SET used = 69').run();
      const elite = await use();
      expect(elite.scoutMode).toBe('elite');
      expect(elite.pity).toEqual({ used: 70, streak: 0, elites: 1 });
    } finally {
      vi.useRealTimers();
      applySeasonSchedule([]);
      forgetSeasonSchedule();
    }
  });

  it('T-11-248 리롤권을 30장 쓸 때마다 프리미엄 스카우트권 1장을 같은 응답으로 받는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const now = new Date().toISOString();
    await ctx.db
      .insert(ownerItems)
      .values({ profileId: me.profileId, item: 'reroll', qty: 61, updatedAt: now });
    const key = () => ({ 'Idempotency-Key': crypto.randomUUID() });
    const use = async (headers = key()) =>
      ItemsRes.parse(
        await (await call('POST', '/v1/items/reroll/use', { cookie: me.cookie, headers })).json(),
      ).data;
    for (let i = 1; i <= 29; i++) {
      const r = await use();
      expect(r).toEqual({ reroll: 61 - i, boost: 0, scout: 0, rename: 0, mileage: i });
    }
    // 같은 멱등 키로 다시 보내도 한 장만 쓰고 한 장만 받는다.
    const again = key();
    const full = await use(again);
    expect(full).toEqual({
      reroll: 31,
      boost: 0,
      scout: 1,
      rename: 0,
      mileage: 0,
      mileageScout: true,
    });
    expect(await use(again)).toEqual(full);
    expect(await use()).toEqual({ reroll: 30, boost: 0, scout: 1, rename: 0, mileage: 1 });
    for (let i = 0; i < 28; i++) await use();
    expect(await use()).toMatchObject({ scout: 2, mileage: 0, mileageScout: true });
    const row = await ctx.env.DB.prepare(
      'SELECT used, progress, rewarded FROM reroll_mileage WHERE profile_id = ?',
    )
      .bind(me.profileId)
      .first();
    expect(row).toEqual({ used: 60, progress: 0, rewarded: 2 });
    // 리롤권이 없으면 409이고 마일리지도 그대로다.
    await use();
    const empty = await call('POST', '/v1/items/reroll/use', { cookie: me.cookie, headers: key() });
    expect(empty.status).toBe(409);
    const items = ItemsRes.parse(
      await (await call('GET', '/v1/items', { cookie: me.cookie })).json(),
    );
    expect(items.data).toMatchObject({ reroll: 0, scout: 2, mileage: 1 });
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
    expect(ItemsRes.parse(await res.json()).data).toEqual({
      reroll: 5,
      boost: 0,
      scout: 0,
      rename: 0,
    });
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

  it('authenticates delayed refund recovery with wall time while preserving its business window', async () => {
    const wall = Date.now();
    const logical = wall - 2 * 24 * 3600 * 1000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(wall);
    try {
      ctx.env.GOOGLE_PLAY_SA_JSON = await serviceAccountJson();
      let tokenCalls = 0;
      let listCalls = 0;
      const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const target = String(url);
        if (target.startsWith('https://oauth2.googleapis.com/token')) {
          tokenCalls++;
          const assertion = new URLSearchParams(String(init?.body)).get('assertion')!;
          const claims = JSON.parse(
            atob(assertion.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
          ) as { iat: number; exp: number };
          if (claims.iat < Math.floor(wall / 1000) - 60) return new Response(null, { status: 400 });
          expect(claims.iat).toBe(Math.floor(wall / 1000));
          expect(claims.exp).toBe(claims.iat + 3600);
          return Response.json({ access_token: 'current-token', expires_in: 3600 });
        }
        expect(target).toContain('/voidedpurchases');
        listCalls++;
        expect(new URL(target).searchParams.get('startTime')).toBe(
          String(logical - 7 * 24 * 3600 * 1000),
        );
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer current-token');
        return Response.json({ voidedPurchases: [] });
      }) as typeof fetch;
      await expect(
        syncGoogleVoided(ctx.env, createDb(ctx.env.DB), logical, fetcher),
      ).resolves.toEqual({
        seen: 0,
        revoked: 0,
        unknown: 0,
      });
      expect(tokenCalls).toBe(1);
      expect(listCalls).toBe(1);
    } finally {
      clock.mockRestore();
    }
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
  it('verified Apple notifications converge with claim alerts and reject mixed environments', async () => {
    ctx.env.BILLING_ALERTS_ENABLED = '1';
    const me = await issueGoogleCookie(ctx);
    appleTx.current = appleFor(me.profileId);
    await claim(me.cookie, { store: 'apple', productId: REROLL_5, token: 'jws' });
    appleNote.current = {
      notificationType: 'ONE_TIME_CHARGE',
      data: {
        bundleId: 'com.offsidelab.app',
        environment: 'Sandbox',
        signedTransactionInfo: 'tx',
      },
    };
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
    expect((await notify()).status).toBe(200);
    expect((await ctx.env.DB.prepare('SELECT * FROM billing_alerts').all()).results).toHaveLength(
      1,
    );
    appleNote.current = {
      notificationType: 'DID_RENEW',
      data: {
        bundleId: 'com.offsidelab.app',
        environment: 'Production',
        signedTransactionInfo: 'tx',
      },
    };
    expect((await notify()).status).toBe(400);
    expect((await ctx.env.DB.prepare('SELECT * FROM billing_alerts').all()).results).toHaveLength(
      1,
    );
  });
});
