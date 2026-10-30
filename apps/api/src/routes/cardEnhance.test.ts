import {
  EnhanceResponseSchema,
  EnhanceStateResponseSchema,
  ErrorEnvelopeSchema,
  FundsHistoryResponseSchema,
  MarketMeResponseSchema,
  OwnerTeamResponseSchema,
  successEnvelope,
  type EnhanceBody,
} from '@offside/contracts';
import { ENHANCE_COSTS } from '@offside/contracts/card-enhance';
import { tradeValue } from '@offside/contracts/card-enhance';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  balanceVersions,
  cardEnhanceLog,
  cards,
  careers,
  marketListings,
  ownerFunds,
  ownerTeams,
} from '../db/schema.js';
import { createTestD1, syncCards, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

const StateRes = successEnvelope(EnhanceStateResponseSchema);
const EnhanceRes = successEnvelope(EnhanceResponseSchema);
const HistoryRes = successEnvelope(FundsHistoryResponseSchema);
const TeamRes = successEnvelope(OwnerTeamResponseSchema);
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
  /** 다음 판정 난수(만분율 0~9999)를 고정한다. */
  const nextRoll = (r: number) =>
    vi.spyOn(crypto, 'getRandomValues').mockImplementationOnce(((a: Uint32Array) => {
      a[0] = r;
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
  /** 이 카드를 선발에 넣은 팀(그 시즌). */
  async function addTeam(profileId: string, slots: (string | null)[], season = 0) {
    const id = `tem_${crypto.randomUUID()}`;
    await ctx.db.insert(ownerTeams).values({
      id,
      profileId,
      season,
      name: '강화 FC',
      manager: '감독',
      formation: '4-3-3',
      slotsJson: JSON.stringify(slots),
      filled: slots.filter(Boolean).length,
      ovr: 60,
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
    });
    return id;
  }
  const play = (teamId: string, wins: number) =>
    ctx.db.update(ownerTeams).set({ wins }).where(eq(ownerTeams.id, teamId));
  const setSlots = (teamId: string, slots: (string | null)[]) =>
    ctx.db
      .update(ownerTeams)
      .set({ slotsJson: JSON.stringify(slots) })
      .where(eq(ownerTeams.id, teamId));
  const fund = (profileId: string, balance: number) =>
    ctx.db.insert(ownerFunds).values({ profileId, balance, updatedAt: '2026-09-30T00:00:00.000Z' });
  const balanceOf = async (profileId: string) =>
    (await ctx.db.select().from(ownerFunds).where(eq(ownerFunds.profileId, profileId)))[0]!.balance;
  const cardOf = async (id: string) =>
    (await ctx.db.select().from(cards).where(eq(cards.careerId, id)))[0]!;
  const state = async (cookie: string, id: string) =>
    StateRes.parse(await (await call('GET', `/v1/cards/${id}/enhance`, { cookie })).json()).data;
  const enhance = (cookie: string, id: string, body: EnhanceBody, key?: string) =>
    call('POST', `/v1/cards/${id}/enhance`, {
      cookie,
      headers: { 'Idempotency-Key': key ?? `enh-${++seq}-key` },
      body,
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
  /** 강화를 열고, 카드 하나를 선발에 넣어 20경기를 뛴 구단주. */
  async function ready(balance = 100_000_000) {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, balance);
    await activate({ enhanceOpen: 1 });
    const team = await addTeam(owner.profileId, [id, ...Array<null>(10).fill(null)]);
    await play(team, 20);
    return { owner, id, team };
  }
  const first: EnhanceBody = { level: 0, fails: 0, used: 0, cost: ENHANCE_COSTS[0], rateBp: 9000 };

  it('강화 창 상태: 기본은 닫혀 있고, 남의 카드는 찾을 수 없다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 1_000_000);
    expect((await call('GET', `/v1/cards/${id}/enhance`)).status).toBe(401);
    expect(await state(owner.cookie, id)).toEqual({
      rules: { open: false, startsPerTry: 20, costScale: 1, rateScale: 1 },
      card: { level: 0, fails: 0, starts: 0, used: 0 },
      balance: 1_000_000,
    });
    const res = await call('GET', `/v1/cards/${id}/enhance`, { cookie: other.cookie });
    expect(res.status).toBe(404);
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('ENHANCE_CLOSED');
    // 팀 화면도 닫힘을 알린다(버튼을 그리지 않는다).
    const team = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    expect(team.enhanceOpen).toBe(false);
  });

  it('시도권은 선발로 뛴 랭크 경기 수로 생긴다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    await activate({ enhanceOpen: 1 });
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('ENHANCE_NO_TRY');
    const team = await addTeam(owner.profileId, [id, ...Array<null>(10).fill(null)]);
    await play(team, 19);
    expect((await state(owner.cookie, id)).card.starts).toBe(19);
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('ENHANCE_NO_TRY');
    await play(team, 20);
    nextRoll(0);
    expect((await enhance(owner.cookie, id, first)).status).toBe(200);
    // 한 장을 썼으니 다음 시도권은 40경기째다.
    nextRoll(0);
    expect(
      await reason(
        await enhance(owner.cookie, id, {
          level: 1,
          fails: 0,
          used: 1,
          cost: ENHANCE_COSTS[1],
          rateBp: 7500,
        }),
      ),
    ).toBe('ENHANCE_NO_TRY');
  });

  it('선발 자리를 옮겨도 경기 수를 지키고, 빠지면 카드에 쌓는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    const team = await addTeam(owner.profileId, [id, ...Array<null>(10).fill(null)]);
    await play(team, 12);
    // 자리 옮기기.
    await setSlots(team, [null, null, id, ...Array<null>(8).fill(null)]);
    await play(team, 15);
    expect((await state(owner.cookie, id)).card.starts).toBe(15);
    // 선발에서 빼면 15경기를 카드에 쌓고, 그 뒤 경기는 세지 않는다.
    await setSlots(team, Array<null>(11).fill(null));
    expect((await cardOf(id)).enhanceStarts).toBe(15);
    await play(team, 30);
    expect((await state(owner.cookie, id)).card.starts).toBe(15);
    // 다시 넣으면 그때부터 센다.
    await setSlots(team, [id, ...Array<null>(10).fill(null)]);
    await play(team, 35);
    expect((await state(owner.cookie, id)).card.starts).toBe(20);
  });

  it('성공하면 단계와 팀 자리 실력이 오르고, 비용이 빠지며 자금 내역에 남는다', async () => {
    const { owner, id } = await ready();
    const before = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    nextRoll(8999);
    const res = await enhance(owner.cookie, id, first);
    expect(res.status).toBe(200);
    expect(EnhanceRes.parse(await res.json()).data).toEqual({
      success: true,
      from: 0,
      to: 1,
      cost: 100_000,
      balance: 99_900_000,
      card: { level: 1, fails: 0, starts: 20, used: 1 },
    });
    expect(await cardOf(id)).toMatchObject({ enhance: 1, enhanceFails: 0, enhanceUsed: 1 });
    const history = HistoryRes.parse(
      await (await call('GET', '/v1/market/funds/history', { cookie: owner.cookie })).json(),
    ).data;
    expect(history.items[0]).toMatchObject({ kind: 'spent', item: null, amount: -100_000 });
    expect(history.items[0]!.id.startsWith('enhance:')).toBe(true);
    expect(history.items[0]!.card?.careerId).toBe(id);
    const after = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    expect(after.enhanceOpen).toBe(true);
    expect(after.players.find((p) => p.careerId === id)?.enhance).toBe(1);
    // 강화 OVR +1이 그 자리 실력에 더해진다(커리어 최고 OVR은 그대로).
    expect(after.players.find((p) => p.careerId === id)?.peak).toBe(85);
    // 강화 OVR은 경기 줄 힘에 그대로 들어간다(+5면 한 명만으로도 정수 줄 힘이 오른다).
    await ctx.db.update(cards).set({ enhance: 5 }).where(eq(cards.careerId, id));
    const maxed = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    const power = (t: typeof after) => Object.values(t.team!.lines).reduce((a, b) => a + b, 0);
    expect(power(maxed)).toBeGreaterThan(power(before));
  });

  it('실패해도 단계는 그대로이고, 천장에 닿으면 다음 시도는 확정이다', async () => {
    const { owner, id, team } = await ready();
    await play(team, 60);
    nextRoll(9000);
    const fail = EnhanceRes.parse(await (await enhance(owner.cookie, id, first)).json()).data;
    expect(fail).toMatchObject({ success: false, from: 0, to: 0 });
    expect(fail.card).toEqual({ level: 0, fails: 1, starts: 60, used: 1 });
    // +0 단계 천장은 1번 — 다음 시도는 100%로 보내야 한다.
    const sure: EnhanceBody = { level: 0, fails: 1, used: 1, cost: ENHANCE_COSTS[0], rateBp: 9000 };
    expect(await reason(await enhance(owner.cookie, id, sure))).toBe('ENHANCE_STALE');
    nextRoll(9999);
    const ok = EnhanceRes.parse(
      await (await enhance(owner.cookie, id, { ...sure, rateBp: 10_000 })).json(),
    ).data;
    expect(ok).toMatchObject({ success: true, to: 1, card: { level: 1, fails: 0, used: 2 } });
  });

  it('같은 멱등 키로 다시 보내면 한 번만 판정 · 차감한다', async () => {
    const { owner, id } = await ready();
    nextRoll(0);
    const a = await enhance(owner.cookie, id, first, 'same-key-123');
    const b = await enhance(owner.cookie, id, first, 'same-key-123');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(EnhanceRes.parse(await b.json()).data).toMatchObject({ success: true, from: 0, to: 1 });
    expect(await ctx.db.select().from(cardEnhanceLog)).toHaveLength(1);
    expect(await balanceOf(owner.profileId)).toBe(100_000_000 - ENHANCE_COSTS[0]);
  });

  it('본 값이 지금과 다르거나 막힌 카드는 판정하지 않는다', async () => {
    const { owner, id } = await ready();
    const other = await issueGoogleCookie(ctx);
    await fund(other.profileId, 100_000_000);
    expect(await reason(await enhance(other.cookie, id, first))).toBe('CARD_NOT_FOUND');
    expect(await reason(await enhance(owner.cookie, id, { ...first, cost: 1 }))).toBe(
      'ENHANCE_STALE',
    );
    expect(await reason(await enhance(owner.cookie, id, { ...first, used: 1 }))).toBe(
      'ENHANCE_STALE',
    );
    await ctx.db.update(cards).set({ manager: true }).where(eq(cards.careerId, id));
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('CARD_MANAGER');
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
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('CARD_LISTED');
    await ctx.db.delete(marketListings);
    await ctx.db.update(cards).set({ enhance: 5 }).where(eq(cards.careerId, id));
    expect(await reason(await enhance(owner.cookie, id, { ...first, level: 5 }))).toBe(
      'ENHANCE_MAX',
    );
    expect(await ctx.db.select().from(cardEnhanceLog)).toHaveLength(0);
  });

  it('구단 자금이 모자라면 판정하지 않는다', async () => {
    const { owner, id } = await ready(ENHANCE_COSTS[0] - 1);
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('FUNDS_SHORT');
    expect(await ctx.db.select().from(cardEnhanceLog)).toHaveLength(0);
  });

  it('비용 배율이 바뀌면 화면 비용도 그 값이어야 한다', async () => {
    const { owner, id } = await ready();
    await ctx.db
      .update(balanceVersions)
      .set({ valuesJson: JSON.stringify({ enhanceOpen: 1, enhanceCostScale: 2 }) });
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('ENHANCE_STALE');
    nextRoll(0);
    expect((await enhance(owner.cookie, id, { ...first, cost: ENHANCE_COSTS[0] * 2 })).status).toBe(
      200,
    );
  });

  it('카드가 팔리면 판 사람 팀에서 뛴 경기 수는 카드에 쌓이고 그 뒤로는 세지 않는다', async () => {
    const { owner, id, team } = await ready();
    const buyer = await issueGoogleCookie(ctx);
    await ctx.db.update(cards).set({ ownerId: buyer.profileId }).where(eq(cards.careerId, id));
    expect((await cardOf(id)).enhanceStarts).toBe(20);
    await play(team, 50);
    expect((await state(buyer.cookie, id)).card.starts).toBe(20);
    // 판 사람이 선발을 고쳐도 다시 쌓지 않는다.
    await setSlots(team, Array<null>(11).fill(null));
    expect((await cardOf(id)).enhanceStarts).toBe(20);
    expect(owner.profileId).not.toBe(buyer.profileId);
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
