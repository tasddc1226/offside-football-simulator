import {
  EnhanceResponseSchema,
  EnhanceStateResponseSchema,
  ErrorEnvelopeSchema,
  FundsHistoryResponseSchema,
  MarketMeResponseSchema,
  OwnerTeamResponseSchema,
  TickerResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { ENHANCE_COSTS } from '@offside/contracts/card-enhance';
import { tradeValue } from '@offside/contracts/market-value';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  balanceVersions,
  cardEnhanceLog,
  cards,
  careers,
  marketListings,
  ownerFunds,
} from '../db/schema.js';
import { createTestD1, syncCards, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

const StateRes = successEnvelope(EnhanceStateResponseSchema);
const EnhanceRes = successEnvelope(EnhanceResponseSchema);
const HistoryRes = successEnvelope(FundsHistoryResponseSchema);
const TeamRes = successEnvelope(OwnerTeamResponseSchema);
const TickerRes = successEnvelope(TickerResponseSchema);
const MeRes = successEnvelope(MarketMeResponseSchema);

let seq = 0;

describe('카드 강화 (T-11-373)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T03:00:00.000Z'));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const reason = async (res: Response) =>
    (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)
      ?.reason;
  /** 다음 판정 난수(0~1)를 고정한다. */
  const nextRoll = (r: number) =>
    vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementationOnce(((a: Uint32Array) => {
        a[0] = Math.floor(r * 2 ** 32);
        return a;
      }) as unknown as typeof crypto.getRandomValues);

  /** 이 프로필이 키운 은퇴 선수 + 카드(기준가 100억). */
  async function addCard(profileId: string) {
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
      serviceSeason: 0,
      value: 3_000_000,
      publicName: '강화 선수',
    });
    await syncCards(ctx, 1_000_000);
    return id;
  }
  const fund = (profileId: string, balance: number) =>
    ctx.db.insert(ownerFunds).values({ profileId, balance, updatedAt: '2026-09-30T00:00:00.000Z' });
  const balanceOf = async (profileId: string) =>
    (await ctx.db.select().from(ownerFunds).where(eq(ownerFunds.profileId, profileId)))[0]!.balance;
  const cardOf = async (id: string) =>
    (await ctx.db.select().from(cards).where(eq(cards.careerId, id)))[0]!;
  const enhance = (cookie: string, id: string, level: number, cost: number, key?: string) =>
    call('POST', `/v1/cards/${id}/enhance`, {
      cookie,
      headers: { 'Idempotency-Key': key ?? `enh-${++seq}-key` },
      body: { level, cost },
    });
  const activate = (values: Record<string, number>) =>
    ctx.db.insert(balanceVersions).values({
      version: 1,
      status: 'active',
      note: '',
      valuesJson: JSON.stringify(values),
      createdBy: 'test',
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
      activatedAt: '2026-09-29T00:00:00.000Z',
    });

  it('강화 창 상태: 오늘 쓴 횟수 · 잔액 · 기본 수치', async () => {
    const owner = await issueGoogleCookie(ctx);
    await fund(owner.profileId, 1_000_000);
    expect((await call('GET', '/v1/cards/enhance')).status).toBe(401);
    const res = await call('GET', '/v1/cards/enhance', { cookie: owner.cookie });
    expect(StateRes.parse(await res.json()).data).toEqual({
      rules: { costScale: 1, rateScale: 1, pity: 0.1, dailyCap: 30, effectScale: 0.8 },
      used: 0,
      balance: 1_000_000,
    });
  });

  it('성공하면 단계가 오르고 비용만큼 자금이 빠지며, 자금 내역에 카드와 함께 남는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 1_000_000);
    nextRoll(0.5);
    const res = await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0]);
    expect(res.status).toBe(200);
    expect(EnhanceRes.parse(await res.json()).data).toEqual({
      success: true,
      from: 0,
      to: 1,
      fails: 0,
      cost: 50_000,
      balance: 950_000,
      used: 1,
    });
    expect(await cardOf(id)).toMatchObject({ enhance: 1, enhanceFails: 0 });
    const history = HistoryRes.parse(
      await (await call('GET', '/v1/market/funds/history', { cookie: owner.cookie })).json(),
    ).data;
    expect(history.items[0]).toMatchObject({ kind: 'spent', item: null, amount: -50_000 });
    expect(history.items[0]!.id.startsWith('enhance:')).toBe(true);
    expect(history.items[0]!.card?.careerId).toBe(id);
    expect(history.totals.spent).toBe(50_000);
    // 내 팀 화면의 선수 카드에 단계가 실린다.
    const team = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    expect(team.players.find((p) => p.careerId === id)?.enhance).toBe(1);
    expect(team.enhanceEffectScale).toBe(0.8);
  });

  it('+7 시도부터 실패하면 한 단계 내려가고 연속 실패가 쌓인다(천장)', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 10_000_000);
    await ctx.db.update(cards).set({ enhance: 6, enhanceFails: 2 }).where(eq(cards.careerId, id));
    nextRoll(0.99);
    const res = await enhance(owner.cookie, id, 6, ENHANCE_COSTS[6]);
    expect(EnhanceRes.parse(await res.json()).data).toMatchObject({
      success: false,
      from: 6,
      to: 5,
      fails: 3,
      balance: 10_000_000 - 900_000,
    });
    expect(await cardOf(id)).toMatchObject({ enhance: 5, enhanceFails: 3 });
    const [log] = await ctx.db.select().from(cardEnhanceLog);
    // +7 기본 50% × (1 + 0.1 × 2) = 60%
    expect(log).toMatchObject({
      fromLevel: 6,
      toLevel: 5,
      success: false,
      rateBp: 6000,
      cost: 900_000,
    });
  });

  it('+6 아래에서 실패하면 그대로 남는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 10_000_000);
    await ctx.db.update(cards).set({ enhance: 3 }).where(eq(cards.careerId, id));
    nextRoll(0.95);
    const data = EnhanceRes.parse(
      await (await enhance(owner.cookie, id, 3, ENHANCE_COSTS[3])).json(),
    ).data;
    expect(data).toMatchObject({ success: false, from: 3, to: 3, fails: 1 });
  });

  it('같은 멱등 키로 다시 보내면 한 번만 판정 · 차감한다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 1_000_000);
    const a = await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0], 'same-key-enhance');
    const b = await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0], 'same-key-enhance');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await balanceOf(owner.profileId)).toBe(950_000);
    expect(await ctx.db.select().from(cardEnhanceLog)).toHaveLength(1);
  });

  it('화면이 본 단계 · 비용이 다르면 409이고 아무것도 쓰지 않는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 1_000_000);
    const stale = await enhance(owner.cookie, id, 1, ENHANCE_COSTS[1]);
    expect(stale.status).toBe(409);
    expect(await reason(stale)).toBe('ENHANCE_STALE');
    const wrongCost = await enhance(owner.cookie, id, 0, 1);
    expect(await reason(wrongCost)).toBe('ENHANCE_STALE');
    expect(await balanceOf(owner.profileId)).toBe(1_000_000);
    expect(await ctx.db.select().from(cardEnhanceLog)).toHaveLength(0);
  });

  it('잔액이 모자라거나 자금 행이 없으면 409(FUNDS_SHORT)', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    expect(await reason(await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0]))).toBe('FUNDS_SHORT');
    await fund(owner.profileId, 10_000);
    expect(await reason(await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0]))).toBe('FUNDS_SHORT');
    expect(await cardOf(id)).toMatchObject({ enhance: 0 });
  });

  it('남의 카드 · 감독 카드 · 판매 등록 중 · +10은 강화할 수 없다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    await fund(other.profileId, 100_000_000);
    expect(await reason(await enhance(other.cookie, id, 0, ENHANCE_COSTS[0]))).toBe(
      'CARD_NOT_FOUND',
    );
    await ctx.db.update(cards).set({ manager: true }).where(eq(cards.careerId, id));
    expect(await reason(await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0]))).toBe('CARD_MANAGER');
    await ctx.db.update(cards).set({ manager: false }).where(eq(cards.careerId, id));
    await ctx.db.insert(marketListings).values({
      id: `lst_${crypto.randomUUID()}`,
      careerId: id,
      sellerId: owner.profileId,
      season: 0,
      price: 1_000_000,
      status: 'open',
      createdAt: '2026-09-30T00:00:00.000Z',
    });
    expect(await reason(await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0]))).toBe('CARD_LISTED');
    await ctx.db.delete(marketListings);
    await ctx.db.update(cards).set({ enhance: 10 }).where(eq(cards.careerId, id));
    expect(await reason(await enhance(owner.cookie, id, 10, 0))).toBe('ENHANCE_MAX');
    expect(await ctx.db.select().from(cardEnhanceLog)).toHaveLength(0);
  });

  it('하루 한도와 enhanceDailyCap = 0(닫힘)', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    await activate({ enhanceDailyCap: 1 });
    expect((await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0])).status).toBe(200);
    const limit = await enhance(owner.cookie, id, 1, ENHANCE_COSTS[1]);
    expect(await reason(limit)).toBe('DAILY_LIMIT');
    // 다음 날(한국 시각 0시)이면 다시 된다.
    vi.setSystemTime(new Date('2026-09-30T15:00:00.000Z'));
    nextRoll(0);
    expect((await enhance(owner.cookie, id, 1, ENHANCE_COSTS[1])).status).toBe(200);
    await ctx.db
      .update(balanceVersions)
      .set({ valuesJson: JSON.stringify({ enhanceDailyCap: 0 }) });
    expect(await reason(await enhance(owner.cookie, id, 2, ENHANCE_COSTS[2]))).toBe(
      'ENHANCE_CLOSED',
    );
  });

  it('비용 배율이 바뀌면 화면 비용도 그 값이어야 한다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    await activate({ enhanceCostScale: 2 });
    expect(await reason(await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0]))).toBe(
      'ENHANCE_STALE',
    );
    expect((await enhance(owner.cookie, id, 0, ENHANCE_COSTS[0] * 2)).status).toBe(200);
  });

  it('+8 이상 성공만 홈 전광판에 공개 이름으로 뜬다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    await ctx.db.update(cards).set({ enhance: 6 }).where(eq(cards.careerId, id));
    nextRoll(0);
    await enhance(owner.cookie, id, 6, ENHANCE_COSTS[6]);
    let ticker = TickerRes.parse(await (await call('GET', '/v1/ticker')).json()).data;
    expect(ticker.enhances).toEqual([]);
    nextRoll(0);
    vi.setSystemTime(new Date('2026-09-30T03:10:00.000Z'));
    await enhance(owner.cookie, id, 7, ENHANCE_COSTS[7]);
    vi.setSystemTime(new Date('2026-09-30T03:20:00.000Z'));
    ticker = TickerRes.parse(await (await call('GET', '/v1/ticker')).json()).data;
    expect(ticker.enhances).toEqual([
      { at: '2026-09-30T03:10:00.000Z', name: '강화 선수', pos: 'FW', number: 9, level: 8 },
    ]);
  });

  it('판매 가격 범위의 기준 가치에 강화 가치가 더해진다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await ctx.db.update(cards).set({ enhance: 5 }).where(eq(cards.careerId, id));
    const me = MeRes.parse(
      await (await call('GET', '/v1/market/me', { cookie: owner.cookie })).json(),
    ).data;
    const max = Math.floor((tradeValue(1_000_000, 5) * me.rules.priceMax) / 100) * 100;
    // 기준가만으로는 넘는 값이지만 강화 가치까지 더한 범위 안이다.
    expect(max).toBeGreaterThan(1_000_000 * me.rules.priceMax);
    const res = await call('POST', '/v1/market/listings', {
      cookie: owner.cookie,
      headers: { 'Idempotency-Key': `enh-list-${++seq}` },
      body: { careerId: id, price: max },
    });
    expect(res.status).toBe(201);
  });
});
