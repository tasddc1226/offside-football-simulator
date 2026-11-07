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
import { tradeBand, tradeValue } from '@offside/contracts/card-enhance';
import { eq, inArray } from 'drizzle-orm';
import { applySeasonSchedule } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeOwnerAchievements } from '../team/ownerAchievements.js';
import { enhanceTitlesAfter, permanentTitlesOf, titleMetricsOf } from '../db/repos/ownerTitles.js';
import {
  balanceVersions,
  cardEnhanceLog,
  cards,
  careers,
  marketListings,
  ownerFunds,
  ownerTeams,
} from '../db/schema.js';
import { cardTrades } from '../db/repos/market.js';
import { careersByIds, eligibleMap } from '../db/repos/ownerTeams.js';
import { buildLineup, lineupOvr } from '../team/sim.js';
import { marketRatio } from '@offside/contracts/market-value';
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
  /** 활성 밸런스 버전을 두고, 카드 하나를 선발에 넣어 10경기를 뛴 구단주. */
  async function ready(balance = 100_000_000) {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, balance);
    await activate({ enhanceOpen: 1 });
    const team = await addTeam(owner.profileId, [id, ...Array<null>(10).fill(null)]);
    return { owner, id, team };
  }
  const first: EnhanceBody = {
    level: 0,
    fails: 0,
    cost: ENHANCE_COSTS[0],
    rateBp: 9000,
    downBp: 0,
  };

  it('강화 창 상태: 기본은 열려 있고, 남의 카드는 찾을 수 없다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 1_000_000);
    expect((await call('GET', `/v1/cards/${id}/enhance`)).status).toBe(401);
    expect(await state(owner.cookie, id)).toEqual({
      rules: { open: true, costScale: 1, rateScale: 1 },
      card: { level: 0, fails: 0, tier: 'normal' },
      balance: 1_000_000,
    });
    const res = await call('GET', `/v1/cards/${id}/enhance`, { cookie: other.cookie });
    expect(res.status).toBe(404);
    const team = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    expect(team.enhanceOpen).toBe(true);
  });

  it('운영 도구에서 닫으면 시도를 거절하고 팀 화면에도 알린다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 1_000_000);
    await activate({ enhanceOpen: 0 });
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('ENHANCE_CLOSED');
    const team = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    expect(team.enhanceOpen).toBe(false);
  });

  it('경기를 뛰지 않은 카드도 자금만 있으면 바로 강화한다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    await activate({ enhanceOpen: 1 });
    nextRoll(0);
    const res = await enhance(owner.cookie, id, first);
    expect(res.status).toBe(200);
    expect(EnhanceRes.parse(await res.json()).data.card).toEqual({
      level: 1,
      fails: 0,
      tier: 'normal',
    });
  });

  it('은퇴 전이라 카드가 없는 커리어는 강화할 수 없다', async () => {
    const owner = await issueGoogleCookie(ctx);
    await fund(owner.profileId, 100_000_000);
    await activate({ enhanceOpen: 1 });
    expect(await reason(await enhance(owner.cookie, crypto.randomUUID(), first))).toBe(
      'CARD_NOT_FOUND',
    );
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
      card: { level: 1, fails: 0, tier: 'normal' },
    });
    expect(await cardOf(id)).toMatchObject({ enhance: 1, enhanceFails: 0 });
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

  it('실패하면 한 단계 내려가 팀 실력도 줄고, 유지되면 그대로다', async () => {
    const { owner, id } = await ready();
    await ctx.db.update(cards).set({ enhance: 3 }).where(eq(cards.careerId, id));
    const body: EnhanceBody = { level: 3, fails: 0, cost: 700_000, rateBp: 4500, downBp: 1500 };
    // 45% 성공 · 15% 실패 · 40% 유지. 경계값으로 잰다.
    nextRoll(6000);
    const keep = EnhanceRes.parse(await (await enhance(owner.cookie, id, body)).json()).data;
    expect(keep).toMatchObject({
      success: false,
      from: 3,
      to: 3,
      card: { level: 3, fails: 1, tier: 'normal' },
    });
    nextRoll(5999);
    const down = EnhanceRes.parse(
      await (await enhance(owner.cookie, id, { ...body, fails: 1 })).json(),
    ).data;
    expect(down).toMatchObject({
      success: false,
      from: 3,
      to: 2,
      card: { level: 2, fails: 2, tier: 'normal' },
    });
    expect(await cardOf(id)).toMatchObject({ enhance: 2, enhanceFails: 2 });
    expect(await balanceOf(owner.profileId)).toBe(100_000_000 - 2 * 700_000);
    const log = await ctx.db.select().from(cardEnhanceLog);
    expect(log.map((l) => [l.toLevel, l.downBp, l.roll]).sort()).toEqual([
      [2, 1500, 5999],
      [3, 1500, 6000],
    ]);
    // 본 실패 확률이 지금과 다르면 판정하지 않는다.
    expect(
      await reason(
        await enhance(owner.cookie, id, {
          level: 2,
          fails: 2,
          cost: 400_000,
          rateBp: 6000,
          downBp: 0,
        }),
      ),
    ).toBe('ENHANCE_STALE');
    // +1에서 실패하면 +0까지 내려가고, +0에서는 더 내려가지 않는다.
    await ctx.db.update(cards).set({ enhance: 1, enhanceFails: 0 }).where(eq(cards.careerId, id));
    nextRoll(7500);
    const zero = EnhanceRes.parse(
      await (
        await enhance(owner.cookie, id, {
          level: 1,
          fails: 0,
          cost: 200_000,
          rateBp: 7500,
          downBp: 500,
        })
      ).json(),
    ).data;
    expect(zero.card.level).toBe(0);
    const team = TeamRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: owner.cookie })).json(),
    ).data;
    expect(team.players.find((p) => p.careerId === id)?.enhance ?? 0).toBe(0);
  });

  it('+0에서는 몇 번을 실패해도 그대로이고 확률도 오르지 않는다(천장 없음)', async () => {
    const { owner, id } = await ready();
    let body = first;
    for (let n = 1; n <= 12; n++) {
      nextRoll(9000);
      const fail = EnhanceRes.parse(await (await enhance(owner.cookie, id, body)).json()).data;
      expect(fail).toMatchObject({ success: false, from: 0, to: 0 });
      expect(fail.card).toEqual({ level: 0, fails: n, tier: 'normal' });
      body = { ...body, fails: n };
    }
    // 12번 실패 뒤에도 같은 난수는 실패고, 확률을 100%로 보내면 다시 확인을 받는다.
    expect(await reason(await enhance(owner.cookie, id, { ...body, rateBp: 10_000 }))).toBe(
      'ENHANCE_STALE',
    );
    nextRoll(8999);
    const ok = EnhanceRes.parse(await (await enhance(owner.cookie, id, body)).json()).data;
    expect(ok).toMatchObject({
      success: true,
      to: 1,
      card: { level: 1, fails: 0, tier: 'normal' },
    });
    expect(await balanceOf(owner.profileId)).toBe(100_000_000 - 13 * ENHANCE_COSTS[0]);
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
    expect(await reason(await enhance(owner.cookie, id, { ...first, fails: 1 }))).toBe(
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
    await ctx.db.update(cards).set({ enhance: 10 }).where(eq(cards.careerId, id));
    expect(await reason(await enhance(owner.cookie, id, { ...first, level: 10 }))).toBe(
      'ENHANCE_MAX',
    );
    expect(await ctx.db.select().from(cardEnhanceLog)).toHaveLength(0);
  });

  it('시즌 2 업적: 시도 기록으로 세고, 카드가 내려가도 최고 단계는 남으며, 강화가 닫혀 있고 기록이 없으면 보이지 않는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    const me = { id: owner.profileId, nickname: null };
    // 시즌 2가 열린 뒤로 시계를 옮긴다(마감된 시즌 1까지 일정이 있어야 시즌 2가 이어진다).
    // 요청마다 서버가 저장된 일정으로 되돌리므로 업적을 잴 때마다 시즌 2 일정을 다시 적는다.
    const season2 = () =>
      applySeasonSchedule([
        {
          id: 1,
          startsAt: '2026-10-05T15:00:00.000Z',
          endsAt: '2026-10-30T15:00:00.000Z',
          retireAt: 45,
        },
        { id: 2, startsAt: '2026-10-30T15:00:00.000Z', endsAt: null, retireAt: 45 },
      ]);
    try {
      const at = '2026-11-03T00:00:00.000Z';
      vi.setSystemTime(new Date(at));
      const items = async () => {
        season2();
        const { groups } = await computeOwnerAchievements(ctx.db, me, 2, at);
        return groups.find((g) => g.id === 'enhance')?.items;
      };
      await activate({ enhanceOpen: 0 });
      expect(await items()).toBeUndefined();
      await ctx.db.update(balanceVersions).set({ valuesJson: JSON.stringify({ enhanceOpen: 1 }) });
      expect((await items())!.every((i) => !i.done)).toBe(true);
      await ctx.db.update(cards).set({ enhance: 3 }).where(eq(cards.careerId, id));
      nextRoll(0);
      const up: EnhanceBody = { level: 3, fails: 0, cost: 700_000, rateBp: 4500, downBp: 1500 };
      expect((await enhance(owner.cookie, id, up)).status).toBe(200);
      const hi: EnhanceBody = { level: 4, fails: 0, cost: 1_000_000, rateBp: 3000, downBp: 2000 };
      nextRoll(3000);
      expect((await enhance(owner.cookie, id, hi)).status).toBe(200);
      expect((await cardOf(id)).enhance).toBe(3);
      const got = Object.fromEntries((await items())!.map((i) => [i.id, i]));
      expect(got['enh-first']!.done).toBe(true);
      expect(got['enh-best']).toMatchObject({ cur: 4, level: 1, next: 5 });
      expect(got['enh-success']).toMatchObject({ cur: 1, level: 0 });
      expect(got['enh-down']).toMatchObject({ cur: 1, level: 1 });
      // 기록이 있으면 강화를 닫아도 보인다.
      await ctx.db.update(balanceVersions).set({ valuesJson: JSON.stringify({ enhanceOpen: 0 }) });
      expect(await items()).toBeDefined();
    } finally {
      applySeasonSchedule([
        { id: 1, startsAt: '2026-10-05T15:00:00.000Z', endsAt: null, retireAt: 45 },
      ]);
    }
  });

  it('최고 OVR 95+ 카드는 낮은 확률로 판정하고, 레전드 점수와 상관없으며, 맞지 않는 본 값은 받지 않는다', async () => {
    const { owner, id } = await ready();
    await ctx.db.update(cards).set({ legendScore: 1800 }).where(eq(cards.careerId, id));
    expect((await state(owner.cookie, id)).card.tier).toBe('normal'); // 레전드 점수는 확률에 영향이 없다.
    await ctx.db.update(cards).set({ legendScore: 300, peak: 95 }).where(eq(cards.careerId, id));
    expect((await state(owner.cookie, id)).card.tier).toBe('top');
    expect(await reason(await enhance(owner.cookie, id, first))).toBe('ENHANCE_STALE');
    nextRoll(7200); // 기본 표면 성공(90%)이지만 95+는 72%라 유지다.
    const res = EnhanceRes.parse(
      await (await enhance(owner.cookie, id, { ...first, rateBp: 7200 })).json(),
    ).data;
    expect(res).toMatchObject({ success: false, to: 0, card: { tier: 'top' } });
  });

  it('칭호: 목표에 닿은 시도의 응답에 한 번만 실리고, 강화가 닫히면 받지 않은 칭호는 목표로 보이지 않는다', async () => {
    const { owner, id } = await ready();
    const me = owner.profileId;
    const seen = async () =>
      (await permanentTitlesOf(ctx.db, me, '2026-09-30T00:00:00.000Z')).map((t) => t.id);
    expect(await seen()).toContain('owner-enh-near');
    await ctx.db.update(cards).set({ enhance: 9 }).where(eq(cards.careerId, id));
    const nine: EnhanceBody = { level: 9, fails: 0, cost: 10_000_000, rateBp: 1000, downBp: 2000 };
    nextRoll(1000);
    const down = EnhanceRes.parse(await (await enhance(owner.cookie, id, nine)).json()).data;
    expect(down.to).toBe(8);
    expect(down.titles).toContain('owner-enh-near');
    const again = await enhanceTitlesAfter(ctx.db, me, '2026-09-30T00:00:00.000Z');
    expect(again).toEqual([]);
    const m = await titleMetricsOf(ctx.db, me);
    expect(m).toMatchObject({
      enhanceTries: 1,
      enhanceDowns: 1,
      enhanceNear: 1,
      enhanceSpent: 1000,
    });
    // 강화를 닫아도 기록이 있으면 그대로 보이고, 기록 없는 구단주에게는 보이지 않는다.
    await ctx.db.update(balanceVersions).set({ valuesJson: JSON.stringify({ enhanceOpen: 0 }) });
    const other = await issueGoogleCookie(ctx);
    const others = await permanentTitlesOf(ctx.db, other.profileId, '2026-09-30T00:00:00.000Z');
    expect(others.some((t) => t.id.startsWith('owner-enh-'))).toBe(false);
    expect(await seen()).toContain('owner-enh-near');
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

  it('지난 시즌 선수로 채운 선발도 급여 예산 없이 강화한다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const starter = await addCard(owner.profileId);
    const bench = await addCard(owner.profileId);
    const stars = [
      await addCard(owner.profileId),
      await addCard(owner.profileId),
      await addCard(owner.profileId),
    ];
    const low = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1, 카드는 시즌 0(지난 시즌)
    await activate({ enhanceOpen: 1 });
    // 예전 급여 예산(80)이었다면 95가 96이 되는 순간 넘었던 선발이다.
    await ctx.db.update(cards).set({ peak: 96 }).where(inArray(cards.careerId, stars));
    await ctx.db.update(cards).set({ peak: 95 }).where(eq(cards.careerId, starter));
    await ctx.db.update(cards).set({ peak: 80 }).where(eq(cards.careerId, low));
    await addTeam(owner.profileId, [starter, ...stars, low, ...Array<null>(6).fill(null)], 1);
    // 최고 OVR 95라 성공 확률은 0.8배(72%)다.
    nextRoll(0);
    expect((await enhance(owner.cookie, starter, { ...first, rateBp: 7200 })).status).toBe(200);
    expect((await cardOf(starter)).enhance).toBe(1);
    nextRoll(0);
    expect((await enhance(owner.cookie, bench, first)).status).toBe(200);
  });

  it('단계가 바뀌면 저장된 팀 OVR을 고치고, 유지되거나 선발 밖이면 팀을 건드리지 않는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const players = await Promise.all(Array.from({ length: 11 }, () => addCard(owner.profileId)));
    const bench = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    await activate({ enhanceOpen: 1 });
    const teamId = await addTeam(owner.profileId, players);
    const ovrNow = async () =>
      (await ctx.db.select().from(ownerTeams).where(eq(ownerTeams.id, teamId)))[0]!.ovr;
    const expected = async () =>
      lineupOvr(
        buildLineup(
          '4-3-3',
          players,
          eligibleMap(await careersByIds(ctx.db, players), owner.profileId, 0, true),
        ),
      );
    // 선발 밖 카드는 팀을 건드리지 않는다.
    nextRoll(0);
    expect((await enhance(owner.cookie, bench, first)).status).toBe(200);
    expect(await ovrNow()).toBe(60);
    // 유지(실패 수만 는다)도 그대로다.
    nextRoll(9500);
    expect((await enhance(owner.cookie, players[0]!, first)).status).toBe(200);
    expect(await ovrNow()).toBe(60);
    // 성공하면 저장값이 편성 저장과 같은 계산이 된다.
    await ctx.db
      .update(cards)
      .set({ enhance: 9, enhanceFails: 0 })
      .where(eq(cards.careerId, players[0]!));
    await ctx.db
      .update(cards)
      .set({ enhance: 9 })
      .where(inArray(cards.careerId, players.slice(1)));
    const atNine = { level: 9, fails: 0, cost: ENHANCE_COSTS[9]!, rateBp: 1000, downBp: 2000 };
    nextRoll(0);
    expect((await enhance(owner.cookie, players[1]!, atNine)).status).toBe(200);
    const up = await ovrNow();
    expect(up).toBe(await expected());
    expect(up).toBeGreaterThan(60);
    // 실패로 내려가도 같이 내려간다.
    nextRoll(1500);
    expect((await enhance(owner.cookie, players[2]!, atNine)).status).toBe(200);
    expect((await cardOf(players[2]!)).enhance).toBe(8);
    expect(await ovrNow()).toBe(await expected());
  });

  it('컵 명단에만 든 카드도 컵 OVR을 고친다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const stars = await Promise.all(Array.from({ length: 3 }, () => addCard(owner.profileId)));
    const starter = await addCard(owner.profileId);
    const low = await addCard(owner.profileId);
    const spare = await addCard(owner.profileId);
    await fund(owner.profileId, 100_000_000);
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1, 카드는 시즌 0(지난 시즌)
    await activate({ enhanceOpen: 1 });
    await ctx.db.update(cards).set({ peak: 96 }).where(inArray(cards.careerId, stars));
    await ctx.db.update(cards).set({ peak: 95 }).where(eq(cards.careerId, starter));
    await ctx.db.update(cards).set({ peak: 80 }).where(eq(cards.careerId, low));
    const slots = [starter, ...stars, low, spare, ...Array<null>(5).fill(null)];
    const teamId = await addTeam(owner.profileId, Array<null>(11).fill(null), 1);
    await ctx.db
      .update(ownerTeams)
      .set({
        cupOvr: 30,
        presetsJson: JSON.stringify([
          { name: '컵', formation: '4-3-3', slots, layout: null, cup: true, ovr: 30, filled: 6 },
        ]),
      })
      .where(eq(ownerTeams.id, teamId));
    // 강화되면 컵 OVR과 프리셋 OVR이 함께 바뀌고 팀 OVR은 그대로다.
    nextRoll(0);
    expect((await enhance(owner.cookie, spare, first)).status).toBe(200);
    const [row] = await ctx.db.select().from(ownerTeams).where(eq(ownerTeams.id, teamId));
    expect(row!.ovr).toBe(60);
    expect(row!.cupOvr).not.toBe(30);
    expect(JSON.parse(row!.presetsJson!)[0].ovr).toBe(row!.cupOvr);
  });

  it('등록에 강화 단계를 남기고, 거래 기록 %는 그 단계로 잰다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await ctx.db.update(cards).set({ enhance: 5 }).where(eq(cards.careerId, id));
    const price = tradeValue(1_000_000, 5);
    const res = await call('POST', '/v1/market/listings', {
      cookie: owner.cookie,
      headers: { 'Idempotency-Key': `enh-list-${++seq}` },
      body: { careerId: id, price },
    });
    expect(res.status).toBe(201);
    const [listing] = await ctx.db
      .select()
      .from(marketListings)
      .where(eq(marketListings.careerId, id));
    expect(listing!.enhance).toBe(5);
    // 판 뒤 새 주인이 더 올려도 그 거래의 %는 그대로다.
    await ctx.db
      .update(marketListings)
      .set({ status: 'sold', closedAt: '2026-09-30T02:00:00.000Z' })
      .where(eq(marketListings.id, listing!.id));
    await ctx.db.update(cards).set({ enhance: 9 }).where(eq(cards.careerId, id));
    expect((await cardTrades(ctx.db, id))[0]!.ratio).toBe(marketRatio(price, price));
  });

  it('이적시장에서 산 카드도 새 주인이 강화하고, 단계와 실패 수는 카드를 따라간다', async () => {
    const { owner, id } = await ready();
    nextRoll(9000);
    expect((await enhance(owner.cookie, id, first)).status).toBe(200);
    const buyer = await issueGoogleCookie(ctx);
    await fund(buyer.profileId, 100_000_000);
    await ctx.db.update(cards).set({ ownerId: buyer.profileId }).where(eq(cards.careerId, id));
    // 판 사람은 더 강화할 수 없다.
    const next = { ...first, fails: 1 };
    expect(await reason(await enhance(owner.cookie, id, next))).toBe('CARD_NOT_FOUND');
    expect((await state(buyer.cookie, id)).card).toEqual({ level: 0, fails: 1, tier: 'normal' });
    nextRoll(0);
    const res = await enhance(buyer.cookie, id, next);
    expect(EnhanceRes.parse(await res.json()).data.card).toEqual({
      level: 1,
      fails: 0,
      tier: 'normal',
    });
    expect(await balanceOf(buyer.profileId)).toBe(100_000_000 - ENHANCE_COSTS[0]);
  });

  it('판매 가격 하한은 강화 가치까지 보고, 상한 배수는 기준가에만 붙는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const id = await addCard(owner.profileId);
    await ctx.db.update(cards).set({ enhance: 5 }).where(eq(cards.careerId, id));
    const me = MeRes.parse(
      await (await call('GET', '/v1/market/me', { cookie: owner.cookie })).json(),
    ).data;
    const band = tradeBand(1_000_000, 5, me.rules);
    const list = (price: number) =>
      call('POST', '/v1/market/listings', {
        cookie: owner.cookie,
        headers: { 'Idempotency-Key': `enh-list-${++seq}` },
        body: { careerId: id, price },
      });
    // 기준가만으로는 범위 안이어도 강화 가치를 넣은 하한 아래면 받지 않는다.
    expect(band.min).toBeGreaterThan(1_000_000 * me.rules.priceMin);
    expect(await reason(await list(band.min - 100))).toBe('PRICE_OUT_OF_BAND');
    // 강화 가치에 배수를 곱한 예전 상한은 받지 않는다.
    expect(await reason(await list(band.max + 100))).toBe('PRICE_OUT_OF_BAND');
    expect(band.max).toBeLessThan(tradeValue(1_000_000, 5) * me.rules.priceMax);
    expect((await list(band.max)).status).toBe(201);
  });
});
