// T-11-487 시즌 1 기록 보상 — 시즌 2 동안 홈 선물 칸에서 한 번. 명예의 전당 순위 · 레전드 점수 · 발롱도르 세 갈래를
// 마감 시각까지 은퇴한 명예의 전당 선수로 세고, 로그인한 구단주만 받는다. 업적 보상이 있으면 그것을 먼저 보인다.
import {
  HomeGiftResponseSchema,
  OwnerItemsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { ACH_SEASON_GIFT, RECORD_SEASON_GIFT } from '@offside/contracts/owner-team';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { careers, ownerAchievements } from '../db/schema.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';

const GiftRes = successEnvelope(HomeGiftResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const S1_END = '2026-10-30T15:00:00.000Z';
const IN_S1 = '2026-10-20T03:00:00.000Z';
const IN_S2 = '2026-11-02T03:00:00.000Z';

describe('T-11-487 시즌 1 기록 보상(GET /v1/items/gift?v=2 · POST /v1/items/gift/claim)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(1, S1_END, false));
  });
  afterEach(async () => {
    vi.useRealTimers();
    forgetSeasonSchedule();
    applySeasonSchedule([]);
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const key = () => ({ 'Idempotency-Key': crypto.randomUUID() });
  const gift = async (cookie: string, v2 = true) =>
    GiftRes.parse(
      await (await call('GET', v2 ? '/v1/items/gift?v=2' : '/v1/items/gift', { cookie })).json(),
    ).data.gift;
  const claim = (cookie: string, id: string) =>
    call('POST', '/v1/items/gift/claim', { cookie, headers: key(), body: { id } });

  /** 시즌 1 명예의 전당 선수(30세 이상 은퇴). */
  async function addCareer(
    profileId: string,
    legendScore: number,
    o: { ballon?: number; at?: string; retireAge?: number; hidden?: number; season?: number } = {},
  ) {
    const at = o.at ?? '2026-10-15T00:00:00.000Z';
    await ctx.db.insert(careers).values({
      id: crypto.randomUUID(),
      profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: 'retired',
      appVersion: '1.0.0',
      createdAt: at,
      updatedAt: at,
      retiredAt: at,
      retireAge: o.retireAge ?? 34,
      peak: 90,
      legendScore,
      ballon: o.ballon ?? 0,
      hidden: o.hidden ?? 0,
      serviceSeason: o.season ?? 1,
    });
  }
  /** 다른 구단주의 선수로 순위를 채운다(n명이 score점). */
  async function fillAhead(n: number, score: number) {
    const other = await issueCookie(ctx);
    for (let i = 0; i < n; i++) await addCareer(other.profileId, score);
  }

  it('시즌 1 중에는 없고, 시즌 2에 세 갈래를 더해 한 번 준다', async () => {
    const me = await issueGoogleCookie(ctx);
    await fillAhead(12, 3000);
    await addCareer(me.profileId, 2500, { ballon: 2 }); // 13위 · 아이콘 · 발롱도르
    await addCareer(me.profileId, 1900, { ballon: 1 }); // 아이콘 · 발롱도르
    await addCareer(me.profileId, 1200); // 레전드
    vi.setSystemTime(new Date(IN_S1));
    expect(await gift(me.cookie)).toBeNull();

    vi.setSystemTime(new Date(IN_S2));
    const g = await gift(me.cookie);
    // 11~100위 7 · 1 · 1 + 아이콘 1~4명 0 · 0 · 2 + 발롱도르 2~4명 5 · 0 · 1.
    expect(g).toEqual({
      id: RECORD_SEASON_GIFT.id,
      kind: 'recordSeason',
      season: 1,
      reroll: 12,
      scout: 1,
      boost: 4,
      record: {
        hofRank: 13,
        icons: 2,
        legends: 3,
        ballonPlayers: 2,
        hof: { reroll: 7, scout: 1, boost: 1 },
        legend: { reroll: 0, scout: 0, boost: 2 },
        ballon: { reroll: 5, scout: 0, boost: 1 },
      },
    });
    // 옛 기기(v 없음)에는 그리지 못하는 카드라 싣지 않는다.
    expect(await gift(me.cookie, false)).toBeNull();

    const res = await claim(me.cookie, RECORD_SEASON_GIFT.id);
    expect(ItemsRes.parse(await res.json()).data).toMatchObject({ reroll: 12, scout: 1, boost: 4 });
    expect((await claim(me.cookie, RECORD_SEASON_GIFT.id)).status).toBe(409);
    expect(await gift(me.cookie)).toBeNull();
  });

  it('세지 않는 선수: 마감 뒤 은퇴 · 30세 전 은퇴 · 가린 선수 · 다른 시즌', async () => {
    const me = await issueGoogleCookie(ctx);
    await addCareer(me.profileId, 3000, { at: '2026-11-01T00:00:00.000Z', ballon: 3 });
    await addCareer(me.profileId, 3000, { retireAge: 29, ballon: 3 });
    await addCareer(me.profileId, 3000, { hidden: 1, ballon: 3 });
    await addCareer(me.profileId, 3000, { season: 0, ballon: 3 });
    vi.setSystemTime(new Date(IN_S2));
    expect(await gift(me.cookie)).toBeNull();
    expect((await claim(me.cookie, RECORD_SEASON_GIFT.id)).status).toBe(409);
  });

  it('1000위 밖이면 순위 갈래는 없고 레전드만 받는다', async () => {
    const me = await issueGoogleCookie(ctx);
    await fillAhead(1000, 1500);
    await addCareer(me.profileId, 1100);
    vi.setSystemTime(new Date(IN_S2));
    const g = await gift(me.cookie);
    expect(g?.record?.hofRank).toBeNull();
    expect([g?.reroll, g?.scout, g?.boost]).toEqual([0, 0, 1]);
  });

  it('같은 점수는 먼저 은퇴한 선수가 앞선다(명예의 전당 순서)', async () => {
    const me = await issueGoogleCookie(ctx);
    const other = await issueCookie(ctx);
    await addCareer(other.profileId, 2000, { at: '2026-10-10T00:00:00.000Z' });
    await addCareer(me.profileId, 2000, { at: '2026-10-12T00:00:00.000Z' });
    vi.setSystemTime(new Date(IN_S2));
    expect((await gift(me.cookie))?.record?.hofRank).toBe(2);
  });

  it('업적 보상이 있으면 그것이 먼저고, 받은 뒤 기록 보상이 보인다', async () => {
    const me = await issueGoogleCookie(ctx);
    await addCareer(me.profileId, 1200);
    await ctx.db.insert(ownerAchievements).values({
      profileId: me.profileId,
      season: 1,
      score: 600,
      done: 1,
      players: 1,
      teamKept: null,
      reachedAt: IN_S1,
      updatedAt: IN_S1,
      rewardBoost: 2,
      rewardScout: 0,
    });
    vi.setSystemTime(new Date(IN_S2));
    expect((await gift(me.cookie))?.id).toBe(ACH_SEASON_GIFT.id);
    expect((await claim(me.cookie, ACH_SEASON_GIFT.id)).status).toBe(200);
    expect((await gift(me.cookie))?.id).toBe(RECORD_SEASON_GIFT.id);
  });

  it('로그인하지 않은 프로필은 묻지도 받지도 못한다', async () => {
    const anon = await issueCookie(ctx);
    await addCareer(anon.profileId, 3000, { ballon: 5 });
    vi.setSystemTime(new Date(IN_S2));
    const res = await call('GET', '/v1/items/gift?v=2', { cookie: anon.cookie });
    expect(res.status).toBe(403);
    const c = await claim(anon.cookie, RECORD_SEASON_GIFT.id);
    expect(c.status).toBe(403);
    expect(await c.json()).toMatchObject({
      error: { details: { reason: 'GOOGLE_LOGIN_REQUIRED' } },
    });
  });
});
