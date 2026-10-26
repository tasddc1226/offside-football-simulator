// T-11-517 광고 제거 구매 감사 선물 — 기준 시각 전에 광고 제거를 산(환불 · 시험 제외) 로그인 구단주가 홈 선물 칸에서 한 번
// 받는다. 그 문구를 아는 기기(?v=3)에만 싣는다.
import {
  HomeGiftResponseSchema,
  OwnerItemsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { AD_FREE_THANKS_GIFT } from '@offside/contracts/owner-team';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { iapAdFreePurchases } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

const GiftRes = successEnvelope(HomeGiftResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const G = AD_FREE_THANKS_GIFT;

describe('T-11-517 광고 제거 구매 감사 선물', () => {
  let ctx: TestD1;
  let seq = 0;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const gift = async (cookie: string, v = 3) =>
    GiftRes.parse(await (await call('GET', `/v1/items/gift?v=${v}`, { cookie })).json()).data.gift;
  const claim = (cookie: string) =>
    call('POST', '/v1/items/gift/claim', {
      cookie,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { id: G.id },
    });
  const bought = (profileId: string, o: { at?: string; test?: boolean; refunded?: boolean } = {}) =>
    ctx.db.insert(iapAdFreePurchases).values({
      store: 'apple',
      transactionId: `t${++seq}`,
      profileId,
      productId: 'com.offsidelab.app.remove_ads',
      test: o.test ?? false,
      createdAt: o.at ?? '2026-10-20T00:00:00.000Z',
      refundedAt: o.refunded ? '2026-10-21T00:00:00.000Z' : null,
    });

  it('기준 전에 광고 제거를 산 구단주는 한 번 받고, 다시 누르면 409다', async () => {
    const me = await issueGoogleCookie(ctx);
    await bought(me.profileId);
    expect(await gift(me.cookie, 2)).toBeNull();
    expect(await gift(me.cookie)).toEqual({
      id: G.id,
      kind: 'adFreeThanks',
      boost: G.boost,
      scout: G.scout,
      reroll: G.reroll,
    });
    const got = ItemsRes.parse(await (await claim(me.cookie)).json()).data;
    expect(got).toMatchObject({ boost: G.boost, reroll: G.reroll });
    expect(await gift(me.cookie)).toBeNull();
    expect((await claim(me.cookie)).status).toBe(409);
  });

  it('사지 않았거나, 환불 · 시험 구매거나, 기준 뒤에 산 구단주는 받지 않는다', async () => {
    const none = await issueGoogleCookie(ctx);
    const refunded = await issueGoogleCookie(ctx);
    await bought(refunded.profileId, { refunded: true });
    const test = await issueGoogleCookie(ctx);
    await bought(test.profileId, { test: true });
    const late = await issueGoogleCookie(ctx);
    await bought(late.profileId, { at: G.before });
    for (const o of [none, refunded, test, late]) {
      expect(await gift(o.cookie)).toBeNull();
      expect((await claim(o.cookie)).status).toBe(409);
    }
  });
});
