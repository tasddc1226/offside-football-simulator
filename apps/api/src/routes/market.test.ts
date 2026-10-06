import {
  ErrorEnvelopeSchema,
  MarketCardTradesResponseSchema,
  MarketChartResponseSchema,
  MarketListResponseSchema,
  MarketMeResponseSchema,
  OwnerTeamResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cards,
  careers,
  marketDaily,
  marketListings,
  ownerFunds,
  notifications,
  pushDeliveries,
} from '../db/schema.js';
import { createApp } from '../app.js';
import { createTestD1, spyDb, syncCards, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueGoogleCookie } from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';

const ListRes = successEnvelope(MarketListResponseSchema);
const MeRes = successEnvelope(MarketMeResponseSchema);
const TeamRes = successEnvelope(OwnerTeamResponseSchema);
const ChartRes = successEnvelope(MarketChartResponseSchema);
const TradesRes = successEnvelope(MarketCardTradesResponseSchema);

let seq = 0;

describe('이적시장 · 구단 자금 · 방출 (T-11-080)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    // 프리시즌(팀 시즌 0). 거래는 지금 시즌 카드끼리만 한다.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z'));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const idem = () => ({ 'Idempotency-Key': `market-${++seq}-key` });
  const reason = async (res: Response) =>
    (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)
      ?.reason;

  /** 이 프로필이 키운 은퇴 선수 + 카드(기준가 100억, 은퇴 가치 300억). */
  async function addCard(profileId: string, season = 0) {
    const id = crypto.randomUUID();
    const now = '2026-09-28T00:00:00.000Z';
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: 'retired',
      appVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
      retiredAt: now,
      retireAge: 34,
      peak: 85,
      legendScore: 300,
      shirtNumber: 9,
      serviceSeason: season,
      value: 3_000_000,
    });
    await syncCards(ctx, 1_000_000);
    return id;
  }
  const fund = (profileId: string, balance: number) =>
    ctx.db.insert(ownerFunds).values({ profileId, balance, updatedAt: '2026-09-30T00:00:00.000Z' });
  const me = async (cookie: string) =>
    MeRes.parse(await (await call('GET', '/v1/market/me', { cookie })).json()).data;
  const list = (cookie: string, careerId: string, price: number) =>
    call('POST', '/v1/market/listings', { cookie, headers: idem(), body: { careerId, price } });

  it('비로그인도 시장 목록을 보고, 방출·시장 쓰기는 구글 연결 구단주만 한다', async () => {
    const res = await call('GET', '/v1/market');
    expect(res.status).toBe(200);
    const data = ListRes.parse(await res.json()).data;
    expect(data).toMatchObject({ season: 0, items: [], hasMore: false });
    expect((await call('GET', '/v1/market/me')).status).toBe(401);
  });

  it('공개 시장 목록은 쿠키가 있어도 세션·프로필을 읽지 않는다(T-10-015)', async () => {
    const owner = await issueGoogleCookie(ctx);
    const { DB, seen } = spyDb(ctx.env.DB);
    for (const path of [
      '/v1/market?sort=price&pos=FW',
      '/v1/market/chart?range=month',
      `/v1/market/cards/${crypto.randomUUID()}/trades`,
    ]) {
      const res = await createApp().request(
        path,
        { headers: { Cookie: owner.cookie } },
        { ...ctx.env, DB },
      );
      expect(res.status).toBe(200);
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((q) => /"sessions"|"profiles"/.test(q))).toEqual([]);
  });

  it('직접 키운 선수를 방출하면 카드 기준가 × 지급률만큼 자금이 생기고 라커룸에서 빠진다(T-11-104)', async () => {
    const owner = await issueGoogleCookie(ctx);
    const a = await addCard(owner.profileId);
    const b = await addCard(owner.profileId);
    const res = await call('POST', '/v1/cards/release', {
      cookie: owner.cookie,
      headers: idem(),
      body: { careerIds: [a] },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: unknown }).data).toEqual({
      released: 1,
      amount: 1_000_000,
      balance: 1_000_000,
    });
    const data = await me(owner.cookie);
    expect(data.balance).toBe(1_000_000);
    expect(data.rules).toMatchObject({ releaseRate: 1, feeRate: 0.05, priceMin: 0.5, priceMax: 3 });
    // 구단주 화면 요약은 가벼운 /funds로 같은 값을 받는다.
    const funds = await call('GET', '/v1/market/funds', { cookie: owner.cookie });
    expect(((await funds.json()) as { data: unknown }).data).toEqual({
      balance: 1_000_000,
      clubValue: 2_000_000,
    });
    // 구단 가치 = 자금 + 남은 카드 기준가(T-11-109). 방출해도 기준가가 자금으로 옮겨 갈 뿐 구단 가치는 그대로다.
    expect(data.clubValue).toBe(2_000_000);
    expect(data.trades).toMatchObject([{ kind: 'released', amount: 1_000_000 }]);
    const team = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    expect(team.players.map((p) => p.careerId)).toEqual([b]);
    expect(team.players[0]).toMatchObject({ raised: true, listing: null, cardValue: 1_000_000 });
    // 이미 방출한 선수는 다시 방출할 수 없다
    const again = await call('POST', '/v1/cards/release', {
      cookie: owner.cookie,
      headers: idem(),
      body: { careerIds: [a] },
    });
    expect(again.status).toBe(409);
    expect(await reason(again)).toBe('NOTHING_TO_RELEASE');
  });

  it('선발에 든 선수는 방출할 수 없다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const a = await addCard(owner.profileId);
    const slots = [...Array(9).fill(null), a, null];
    const put = await call('PUT', '/v1/owner-team', {
      cookie: owner.cookie,
      body: { name: '우리 FC', manager: '김감독', formation: '4-3-3', slots },
    });
    expect(put.status).toBe(200);
    const res = await call('POST', '/v1/cards/release', {
      cookie: owner.cookie,
      headers: idem(),
      body: { careerIds: [a] },
    });
    expect(res.status).toBe(409);
    expect(await reason(res)).toBe('IN_LINEUP');
  });

  it('내놓고 사면 자금이 오가고 카드 주인이 바뀐다(수수료는 판매자 몫에서 뗀다)', async () => {
    const seller = await issueGoogleCookie(ctx);
    const buyer = await issueGoogleCookie(ctx);
    await addAppPushDevice(ctx, seller.profileId);
    const card = await addCard(seller.profileId);
    // 가격 범위: 기준가 50%~300%
    const low = await list(seller.cookie, card, 400_000);
    expect(low.status).toBe(409);
    expect(await reason(low)).toBe('PRICE_OUT_OF_BAND');
    const created = await list(seller.cookie, card, 1_200_000);
    expect(created.status).toBe(201);
    const listingId = ((await created.json()) as { data: { listing: { id: string } } }).data.listing
      .id;
    expect((await list(seller.cookie, card, 1_200_000)).status).toBe(409); // 이미 내놓음

    const market = ListRes.parse(await (await call('GET', '/v1/market')).json()).data;
    expect(market.items.map((l) => [l.id, l.price, l.card.cardValue])).toEqual([
      [listingId, 1_200_000, 1_000_000],
    ]);
    expect(market.recent).toEqual([]);

    const buy = (cookie: string, price: number) =>
      call('POST', `/v1/market/listings/${listingId}/buy`, {
        cookie,
        headers: idem(),
        body: { price },
      });
    const poor = await buy(buyer.cookie, 1_200_000);
    expect(await reason(poor)).toBe('FUNDS_SHORT');
    // T-11-106 ?lang=en이면 안내 문구만 영어이고 reason은 그대로다. 목록 조회도 lang을 받는다.
    const poorEn = await call('POST', `/v1/market/listings/${listingId}/buy?lang=en`, {
      cookie: buyer.cookie,
      headers: idem(),
      body: { price: 1_200_000 },
    });
    expect(poorEn.status).toBe(409);
    const poorBody = ErrorEnvelopeSchema.parse(await poorEn.json()).error;
    expect(poorBody.message).toBe("You don't have enough club funds.");
    expect(poorBody.details).toMatchObject({ reason: 'FUNDS_SHORT' });
    expect((await call('GET', '/v1/market?lang=en')).status).toBe(200);
    await fund(buyer.profileId, 2_000_000);
    expect(await reason(await buy(buyer.cookie, 1_000_000))).toBe('PRICE_CHANGED');
    expect(await reason(await buy(seller.cookie, 1_200_000))).toBe('OWN_LISTING');
    expect(await ctx.db.select().from(notifications)).toEqual([]);
    const ok = await buy(buyer.cookie, 1_200_000);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: unknown }).data).toEqual({ balance: 800_000 });
    expect(await reason(await buy(buyer.cookie, 1_200_000))).toBe('LISTING_GONE');
    expect(await ctx.db.select().from(notifications)).toMatchObject([
      { profileId: seller.profileId, kind: 'market', sourceKey: `market-sold:${listingId}` },
    ]);
    expect(await ctx.db.select().from(pushDeliveries)).toMatchObject([
      { profileId: seller.profileId, state: 'pending' },
    ]);
    // 팔린 선수는 '방금 이적' 띠(첫 페이지 recent)에 오른다. 엣지 캐시를 피하려고 다른 정렬로 묻는다.
    const after = ListRes.parse(await (await call('GET', '/v1/market?sort=price')).json()).data;
    expect(after.items).toEqual([]);
    expect(after.recent.map((r) => [r.id, r.price, r.card.careerId])).toEqual([
      [listingId, 1_200_000, card],
    ]);

    const [c] = await ctx.db.select().from(cards).where(eq(cards.careerId, card));
    expect(c).toMatchObject({ ownerId: buyer.profileId, transfers: 1 });
    expect((await me(seller.cookie)).balance).toBe(1_200_000 - 60_000);
    const buyerMe = await me(buyer.cookie);
    expect(buyerMe.trades).toMatchObject([{ kind: 'bought', amount: 1_200_000 }]);
    // 영입한 선수는 구단 가치에 기준가로 들어가고, 방출할 수 없다
    expect(buyerMe.clubValue).toBe(800_000 + 1_000_000);
    const team = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: buyer.cookie })).json(),
    ).data;
    expect(team.players).toMatchObject([{ careerId: card, raised: false }]);
    const rel = await call('POST', '/v1/cards/release', {
      cookie: buyer.cookie,
      headers: idem(),
      body: { careerIds: [card] },
    });
    expect(await reason(rel)).toBe('NOTHING_TO_RELEASE');

    // 시세 집계(T-11-080e): 산 선수를 기준가 90%에 되팔면 같은 날 · 같은 포지션군 · OVR대 묶음에 한 건 더한다.
    const resale = await list(buyer.cookie, card, 900_000);
    const resaleId = ((await resale.json()) as { data: { listing: { id: string } } }).data.listing
      .id;
    const back = await call('POST', `/v1/market/listings/${resaleId}/buy`, {
      cookie: seller.cookie,
      headers: idem(),
      body: { price: 900_000 },
    });
    expect(back.status).toBe(200);
    const daily = await ctx.db.select().from(marketDaily);
    expect(daily).toHaveLength(1);
    expect(daily[0]).toMatchObject({
      trades: 2,
      volume: 2_100_000,
      ratioSum: 1200 + 900,
      ratioMin: 900,
      ratioMax: 1200,
    });
    // 0059 마이그레이션의 지난 거래 채우기 SELECT도 같은 행을 만든다(두 계산이 어긋나지 않게 묶는다).
    const migration = readFileSync(
      new URL('../../migrations/0059_market_daily.sql', import.meta.url),
      'utf8',
    );
    const backfill = migration
      .slice(migration.lastIndexOf('INSERT INTO'))
      .replace(/^INSERT INTO[^\n]*\n/, '')
      .replace(/;\s*$/, '');
    const recomputed = await ctx.db.$client.prepare(backfill).all();
    expect(recomputed.results.map((r) => Object.values(r as object))).toEqual(
      daily.map((r) => Object.values(r)),
    );
    // 실패한 영입(이미 팔림)은 집계에 더하지 않는다.
    expect(await reason(await buy(buyer.cookie, 1_200_000))).toBe('LISTING_GONE');
    expect((await ctx.db.select().from(marketDaily))[0]!.trades).toBe(2);

    // 시세 차트(T-11-080f): 묶음과 시장 전체가 같은 하루치를 돌려주고, 선수 거래는 최신순이다.
    const chart = async (q: string) => {
      const res = await call('GET', `/v1/market/chart${q}`);
      expect(res.status).toBe(200);
      return ChartRes.parse(await res.json()).data;
    };
    const day = { day: '2026-09-30', trades: 2, volume: 2_100_000, avg: 1050, min: 900, max: 1200 };
    expect(await chart('')).toEqual({ season: 0, points: [day] });
    expect(await chart('?range=season&pos=FW&band=85')).toEqual({ season: 0, points: [day] });
    expect((await chart('?range=month&pos=FW&band=80')).points).toEqual([]);
    expect((await call('GET', '/v1/market/chart?pos=FW')).status).toBe(400);
    const trades = TradesRes.parse(
      await (await call('GET', `/v1/market/cards/${card}/trades`)).json(),
    ).data.trades;
    expect(trades.map((t) => [t.price, t.ratio])).toEqual([
      [900_000, 900],
      [1_200_000, 1200],
    ]);
  });

  it('다른 시즌 카드는 내놓을 수 없고, 내 등록은 내릴 수 있다', async () => {
    const seller = await issueGoogleCookie(ctx);
    const other = await addCard(seller.profileId, 1);
    expect(await reason(await list(seller.cookie, other, 1_000_000))).toBe('CARD_OTHER_SEASON');
    const card = await addCard(seller.profileId);
    const created = await list(seller.cookie, card, 1_000_000);
    const id = ((await created.json()) as { data: { listing: { id: string } } }).data.listing.id;
    expect((await me(seller.cookie)).listings.map((l) => l.id)).toEqual([id]);
    // 판매 중에는 방출할 수 없다
    const rel = await call('POST', '/v1/cards/release', {
      cookie: seller.cookie,
      headers: idem(),
      body: { careerIds: [card] },
    });
    expect(await reason(rel)).toBe('NOTHING_TO_RELEASE');
    expect(
      (await call('DELETE', `/v1/market/listings/${id}`, { cookie: seller.cookie })).status,
    ).toBe(204);
    expect((await me(seller.cookie)).listings).toEqual([]);
  });

  it('계정을 지우면 열린 등록을 내리고 자금 행을 지운다', async () => {
    const seller = await issueGoogleCookie(ctx);
    const card = await addCard(seller.profileId);
    await list(seller.cookie, card, 1_000_000);
    await fund(seller.profileId, 500_000);
    expect((await deleteProfile(ctx.env, seller.cookie, 'del-market')).status).toBe(204);
    const rows = await ctx.db.select().from(marketListings);
    expect(rows.map((r) => r.status)).toEqual(['cancelled']);
    expect(await ctx.db.select().from(ownerFunds)).toEqual([]);
  });
});
