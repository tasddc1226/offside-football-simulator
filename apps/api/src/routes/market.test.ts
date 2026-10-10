import {
  ErrorEnvelopeSchema,
  FundsHistoryResponseSchema,
  MarketCardTradesResponseSchema,
  MarketChartResponseSchema,
  MarketListResponseSchema,
  AdminFundsOwnerSchema,
  AdminFundsReportSchema,
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
import { FUNDS_HISTORY_PAGE } from '../db/repos/fundsHistory.js';
import { createTestD1, spyDb, syncCards, type TestD1 } from '../test/d1.js';
import {
  ADMIN_EMAIL,
  callJson,
  deleteProfile,
  issueAdminCookie,
  issueGoogleCookie,
} from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';

const ListRes = successEnvelope(MarketListResponseSchema);
const MeRes = successEnvelope(MarketMeResponseSchema);
const TeamRes = successEnvelope(OwnerTeamResponseSchema);
const ChartRes = successEnvelope(MarketChartResponseSchema);
const TradesRes = successEnvelope(MarketCardTradesResponseSchema);
const HistoryRes = successEnvelope(FundsHistoryResponseSchema);

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

  it('T-11-188 잠긴 선수는 내놓거나 방출할 수 없고, 판매 중인 선수는 내린 뒤 잠근다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const a = await addCard(owner.profileId);
    const b = await addCard(owner.profileId);
    const lock = (cookie: string, careerId: string, locked: boolean, lang = '') =>
      call('POST', `/v1/cards/lock${lang}`, { cookie, body: { careerId, locked } });
    const team = async () =>
      TeamRes.parse(await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json())
        .data.players;

    expect((await lock(owner.cookie, a, true)).status).toBe(200);
    expect(await team()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ careerId: a, locked: true }),
        expect.objectContaining({ careerId: b, locked: false }),
      ]),
    );
    const listed = await list(owner.cookie, a, 1_000_000);
    expect(listed.status).toBe(409);
    expect(await reason(listed)).toBe('CARD_LOCKED');
    const rel = await call('POST', '/v1/cards/release', {
      cookie: owner.cookie,
      headers: idem(),
      body: { careerIds: [a] },
    });
    expect(await reason(rel)).toBe('NOTHING_TO_RELEASE');
    expect((await ctx.db.select().from(cards).where(eq(cards.careerId, a)))[0]?.ownerId).toBe(
      owner.profileId,
    );

    // 남의 카드는 잠그지 못한다. 판매 중이면 잠글 수 없고 내린 뒤에는 잠근다.
    expect(await reason(await lock(other.cookie, b, true))).toBe('CARD_NOT_FOUND');
    const created = await list(owner.cookie, b, 1_000_000);
    expect(created.status).toBe(201);
    const listedLock = await lock(owner.cookie, b, true);
    expect(listedLock.status).toBe(409);
    expect(await reason(listedLock)).toBe('CARD_LISTED');
    const en = await lock(owner.cookie, b, true, '?lang=en');
    expect(ErrorEnvelopeSchema.parse(await en.json()).error.message).toBe(
      'This player is listed. Take the listing down to lock them.',
    );
    const id = ((await created.json()) as { data: { listing: { id: string } } }).data.listing.id;
    expect(
      (await call('DELETE', `/v1/market/listings/${id}`, { cookie: owner.cookie })).status,
    ).toBe(204);
    expect((await lock(owner.cookie, b, true)).status).toBe(200);

    // 풀면 다시 내놓을 수 있다.
    expect((await lock(owner.cookie, a, false)).status).toBe(200);
    expect((await list(owner.cookie, a, 1_000_000)).status).toBe(201);
  });

  it('T-11-180 OVR 높은 순으로 본다(같으면 싼 것부터)', async () => {
    const seller = await issueGoogleCookie(ctx);
    const [lo, hi, mid] = [
      await addCard(seller.profileId),
      await addCard(seller.profileId),
      await addCard(seller.profileId),
    ];
    await ctx.db.update(cards).set({ peak: 70 }).where(eq(cards.careerId, lo));
    await ctx.db.update(cards).set({ peak: 92 }).where(eq(cards.careerId, hi));
    for (const [id, price] of [
      [lo, 1_000_000],
      [hi, 1_500_000],
      [mid, 1_200_000],
    ] as const)
      expect((await list(seller.cookie, id, price)).status).toBe(201);
    const data = ListRes.parse(await (await call('GET', '/v1/market?sort=ovr')).json()).data;
    expect(data.items.map((i) => i.card.careerId)).toEqual([hi, mid, lo]);
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
  it('T-11-153 자금 내역에 구단 자금 사용이 보이고, 운영 도구가 잔액을 기록과 대조한다', async () => {
    const owner = await issueGoogleCookie(ctx, { nickname: '대조구단' });
    const card = await addCard(owner.profileId);
    await call('POST', '/v1/cards/release', {
      cookie: owner.cookie,
      headers: idem(),
      body: { careerIds: [card] },
    });
    vi.setSystemTime(new Date('2026-09-30T01:00:00.000Z'));
    const bought = await call('POST', '/v1/items/reroll/buy', {
      cookie: owner.cookie,
      headers: idem(),
      body: { price: 1_000_000 },
    });
    expect(bought.status).toBe(200);
    const mine = await me(owner.cookie);
    expect(mine.balance).toBe(0);
    expect(mine.trades).toMatchObject([{ kind: 'released', amount: 1_000_000 }]);
    expect(mine.spends).toMatchObject([{ item: 'reroll', amount: 1_000_000 }]);

    const env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
    const admin = await issueAdminCookie(ctx);
    expect((await callJson(env, 'GET', '/v1/admin/funds', { cookie: owner.cookie })).status).toBe(
      403,
    );
    const report = async () =>
      successEnvelope(AdminFundsReportSchema).parse(
        await (await callJson(env, 'GET', '/v1/admin/funds', { cookie: admin.cookie })).json(),
      ).data;
    expect(await report()).toMatchObject({
      owners: 1,
      balance: 0,
      released: 1_000_000,
      items: { reroll: 1_000_000 },
      mismatched: 0,
      mismatches: [],
    });
    // 기록 밖에서 잔액이 바뀌면(직접 넣은 자금) 어긋난 구단주로 잡힌다.
    await ctx.db
      .update(ownerFunds)
      .set({ balance: 5 })
      .where(eq(ownerFunds.profileId, owner.profileId));
    expect(await report()).toMatchObject({
      mismatched: 1,
      mismatches: [{ profileId: owner.profileId, nickname: '대조구단', balance: 5, diff: 5 }],
    });
    for (const q of [owner.profileId, '대조구단']) {
      const res = await callJson(env, 'GET', `/v1/admin/funds/owner?q=${encodeURIComponent(q)}`, {
        cookie: admin.cookie,
      });
      const one = successEnvelope(AdminFundsOwnerSchema).parse(await res.json()).data;
      expect(one).toMatchObject({ released: 1_000_000, items: 1_000_000, diff: 5 });
      expect(one.moves.map((m) => [m.kind, m.item, m.amount])).toEqual([
        ['item', 'reroll', -1_000_000],
        ['released', null, 1_000_000],
      ]);
    }
    const none = await callJson(env, 'GET', '/v1/admin/funds/owner?q=없는구단', {
      cookie: admin.cookie,
    });
    expect(none.status).toBe(404);
  });

  it('T-11-163 은퇴 장려금은 자금 내역과 운영 도구 대조에 출처로 잡힌다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const card = await addCard(owner.profileId);
    await ctx.db.update(cards).set({ bonusValue: 100_000 }).where(eq(cards.careerId, card));
    await fund(owner.profileId, 100_000);
    const h = HistoryRes.parse(
      await (await call('GET', '/v1/market/funds/history', { cookie: owner.cookie })).json(),
    ).data;
    expect(h.totals).toMatchObject({ bonus: 100_000, released: 0 });
    expect(h.items).toMatchObject([{ kind: 'bonus', amount: 100_000, card: { careerId: card } }]);
    const env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
    const admin = await issueAdminCookie(ctx);
    const r = successEnvelope(AdminFundsReportSchema).parse(
      await (await callJson(env, 'GET', '/v1/admin/funds', { cookie: admin.cookie })).json(),
    ).data;
    expect(r).toMatchObject({ bonus: 100_000, mismatched: 0 });
  });

  it('자금 내역: 방출·판매·영입·구단 자금 사용을 최근 순으로, 출처별 합과 페이지로 준다', async () => {
    const seller = await issueGoogleCookie(ctx);
    const buyer = await issueGoogleCookie(ctx);
    const history = async (cookie: string, page = 0) =>
      HistoryRes.parse(
        await (await call('GET', `/v1/market/funds/history?page=${page}`, { cookie })).json(),
      ).data;
    expect((await call('GET', '/v1/market/funds/history')).status).toBe(401);
    expect(await history(seller.cookie)).toEqual({
      balance: 0,
      totals: { released: 0, bonus: 0, sold: 0, bought: 0, spent: 0 },
      items: [],
      hasMore: false,
    });

    const keep = await addCard(seller.profileId);
    const sell = await addCard(seller.profileId);
    await call('POST', '/v1/cards/release', {
      cookie: seller.cookie,
      headers: idem(),
      body: { careerIds: [keep] },
    });
    vi.setSystemTime(new Date('2026-09-30T01:00:00.000Z'));
    const created = await list(seller.cookie, sell, 1_200_000);
    const listingId = ((await created.json()) as { data: { listing: { id: string } } }).data.listing
      .id;
    await fund(buyer.profileId, 2_000_000);
    vi.setSystemTime(new Date('2026-09-30T02:00:00.000Z'));
    await call('POST', `/v1/market/listings/${listingId}/buy`, {
      cookie: buyer.cookie,
      headers: idem(),
      body: { price: 1_200_000 },
    });
    vi.setSystemTime(new Date('2026-09-30T03:00:00.000Z'));
    expect(
      (
        await call('POST', '/v1/items/reroll/buy', {
          cookie: seller.cookie,
          headers: idem(),
          body: { price: 1_000_000 },
        })
      ).status,
    ).toBe(200);

    const s = await history(seller.cookie);
    expect(s.balance).toBe(1_000_000 + 1_140_000 - 1_000_000);
    expect(s.totals).toEqual({
      released: 1_000_000,
      bonus: 0,
      sold: 1_140_000,
      bought: 0,
      spent: 1_000_000,
    });
    expect(s.items.map((i) => [i.kind, i.item, i.amount, i.fee, i.card?.careerId ?? null])).toEqual(
      [
        ['spent', 'reroll', -1_000_000, null, null],
        ['sold', null, 1_140_000, 60_000, sell],
        ['released', null, 1_000_000, null, keep],
      ],
    );
    expect(s.items[1]!.card).toMatchObject({ pos: 'FW', peak: 85, number: 9 });
    const b = await history(buyer.cookie);
    expect(b.totals.bought).toBe(1_200_000);
    expect(b.items).toMatchObject([
      { kind: 'bought', amount: -1_200_000, card: { careerId: sell } },
    ]);

    // 한 번에 여러 장 방출하면 시각이 같아도 페이지가 겹치거나 빠지지 않는다.
    const many: string[] = [];
    for (let i = 0; i < FUNDS_HISTORY_PAGE; i++) many.push(await addCard(buyer.profileId));
    await call('POST', '/v1/cards/release', {
      cookie: buyer.cookie,
      headers: idem(),
      body: { careerIds: many },
    });
    const p0 = await history(buyer.cookie);
    const p1 = await history(buyer.cookie, 1);
    expect([p0.items.length, p0.hasMore, p1.items.length, p1.hasMore]).toEqual([
      FUNDS_HISTORY_PAGE,
      true,
      1,
      false,
    ]);
    const ids = [...p0.items, ...p1.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(FUNDS_HISTORY_PAGE + 1);
    expect(p1.items[0]).toMatchObject({ kind: 'bought' });
  });
});
