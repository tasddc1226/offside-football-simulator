// T-11-664 업데이트 감사 선물 — 기간 안에 로그인한 구단주가 홈 선물 칸에서 프리미엄 스카우트권을 한 번 받는다. 그 문구를 아는
// 기기(?v=4)에만 싣고, 기간이 짧아 다른 선물보다 먼저 보인다.
import {
  HomeGiftResponseSchema,
  OwnerItemsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { AD_FREE_THANKS_GIFT, UPDATE_THANKS_GIFT } from '@offside/contracts/owner-team';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iapAdFreePurchases } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';

const GiftRes = successEnvelope(HomeGiftResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const G = UPDATE_THANKS_GIFT;
const IN = '2026-11-08T03:00:00.000Z';

describe('T-11-664 업데이트 감사 선물', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(IN));
    ctx = await createTestD1();
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const gift = async (cookie: string, v = 4) =>
    GiftRes.parse(await (await call('GET', `/v1/items/gift?v=${v}`, { cookie })).json()).data.gift;
  const claim = (cookie: string, id: string = G.id) =>
    call('POST', '/v1/items/gift/claim', {
      cookie,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { id },
    });

  it('기간 안이면 로그인한 구단주가 한 번 받고, 다시 누르면 409다', async () => {
    const me = await issueGoogleCookie(ctx);
    expect(await gift(me.cookie, 3)).toBeNull();
    expect(await gift(me.cookie)).toEqual({
      id: G.id,
      kind: 'updateThanks',
      boost: 0,
      scout: G.scout,
      reroll: 0,
    });
    const got = ItemsRes.parse(await (await claim(me.cookie)).json()).data;
    expect(got).toMatchObject({ scout: G.scout });
    expect(await gift(me.cookie)).toBeNull();
    expect((await claim(me.cookie)).status).toBe(409);
  });

  it('다른 선물보다 먼저 보이고, 받은 뒤에 다음 선물이 보인다', async () => {
    const me = await issueGoogleCookie(ctx);
    await ctx.db.insert(iapAdFreePurchases).values({
      store: 'apple',
      transactionId: 't1',
      profileId: me.profileId,
      productId: 'com.offsidelab.app.remove_ads',
      test: false,
      createdAt: '2026-10-20T00:00:00.000Z',
      refundedAt: null,
    });
    expect((await gift(me.cookie))?.id).toBe(G.id);
    expect((await claim(me.cookie)).status).toBe(200);
    expect((await gift(me.cookie))?.id).toBe(AD_FREE_THANKS_GIFT.id);
  });

  it('기간 밖이면 보이지 않고 받을 수도 없다', async () => {
    const me = await issueGoogleCookie(ctx);
    for (const at of ['2026-11-07T14:59:59.000Z', G.until]) {
      vi.setSystemTime(new Date(at));
      expect(await gift(me.cookie)).toBeNull();
      expect((await claim(me.cookie)).status).toBe(409);
    }
  });

  it('로그인하지 않은 프로필은 받을 수 없다', async () => {
    const anon = await issueCookie(ctx);
    expect((await call('GET', '/v1/items/gift?v=4', { cookie: anon.cookie })).status).toBe(403);
    expect((await claim(anon.cookie)).status).toBe(403);
  });
});
