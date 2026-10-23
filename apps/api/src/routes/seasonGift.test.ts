// T-11-386 시즌 1 업적 보상 — 시즌 2 동안 홈 선물 칸의 받기 버튼으로 한 번. 장수는 처음 물을 때 시즌 1 업적을 세어
// 적어 두고, 시즌 2 실시간 보상과 같은 표 · 시즌 상한으로 센다.
import {
  HomeGiftResponseSchema,
  OwnerItemsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { ACH_SEASON_GIFT } from '@offside/contracts/owner-team';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { careers, giftClaims, ownerAchievements } from '../db/schema.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

const GiftRes = successEnvelope(HomeGiftResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);
const S1_END = '2026-10-30T15:00:00.000Z';
const IN_S1 = '2026-10-20T03:00:00.000Z';
const IN_S2 = '2026-11-02T03:00:00.000Z';

describe('T-11-386 시즌 1 업적 보상(GET /v1/items/gift · POST /v1/items/gift/claim)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    // 요청마다 app_meta의 일정을 다시 입히므로 거기에 굳혀 둔다.
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

  /** 시즌 1에 은퇴한 선수 한 명(통산 3만 골 — 강화권 16장 · 스카우트권 6장 칸). */
  async function addS1Career(profileId: string, goals: number, at = '2026-10-15T00:00:00.000Z') {
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
      retireAge: 34,
      peak: 80,
      goals,
      legendScore: 300,
      shirtNumber: 9,
      serviceSeason: 1,
    });
  }
  /** 시즌 1 업적 행(점수는 업적 화면이 적는 값 — 여기서는 문턱 판정용으로만). */
  const addS1Row = (profileId: string, score: number) =>
    ctx.db.insert(ownerAchievements).values({
      profileId,
      season: 1,
      score,
      done: 1,
      players: 1,
      teamKept: null,
      reachedAt: IN_S1,
      updatedAt: IN_S1,
    });
  async function owner(goals: number, score: number) {
    const me = await issueGoogleCookie(ctx);
    await addS1Career(me.profileId, goals);
    await addS1Row(me.profileId, score);
    vi.setSystemTime(new Date(IN_S1));
    return me;
  }
  const gift = async (cookie: string) =>
    GiftRes.parse(await (await call('GET', '/v1/items/gift', { cookie })).json()).data.gift;
  const claim = (cookie: string, body?: { id?: string }, headers = key()) =>
    call('POST', '/v1/items/gift/claim', { cookie, headers, ...(body ? { body } : {}) });

  it('시즌 1 중에는 없고, 시즌 2에 시즌 1 업적으로 센 장수를 한 번 준다', async () => {
    const me = await owner(30_000, 600);
    expect(await gift(me.cookie)).toBeNull();

    vi.setSystemTime(new Date(IN_S2));
    const g = await gift(me.cookie);
    expect(g).toEqual({
      id: ACH_SEASON_GIFT.id,
      kind: 'achSeason',
      season: 1,
      boost: 16,
      scout: 6,
    });
    // 처음 물을 때 센 장수를 적어 둔다.
    const [row] = await ctx.db
      .select()
      .from(ownerAchievements)
      .where(and(eq(ownerAchievements.profileId, me.profileId), eq(ownerAchievements.season, 1)));
    expect([row?.rewardBoost, row?.rewardScout]).toEqual([16, 6]);

    // 다른 선물 id(T-11-472 없앤 구단주 선물 포함)로는 받지 못한다.
    expect((await claim(me.cookie, { id: 'gift-2026-10' })).status).toBe(409);
    const first = key();
    const res = await claim(me.cookie, { id: ACH_SEASON_GIFT.id }, first);
    const items = ItemsRes.parse(await res.json()).data;
    expect(items).toMatchObject({ boost: 16, scout: 6 });
    // 같은 키 재시도는 같은 응답, 새로 누르면 409이고 장수는 그대로다.
    expect(
      ItemsRes.parse(await (await claim(me.cookie, { id: ACH_SEASON_GIFT.id }, first)).json()).data,
    ).toEqual(items);
    const again = await claim(me.cookie, { id: ACH_SEASON_GIFT.id });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { details: { reason: 'GIFT_CLAIMED' } } });
    expect(await gift(me.cookie)).toBeNull();
  });

  it('시즌 1 출신이라도 마감 뒤에 은퇴한 선수는 세지 않는다(시즌 결산과 같은 기준)', async () => {
    const me = await owner(300, 600);
    // 마감 뒤(시즌 2)에 은퇴한 시즌 1 출신 3만 골 선수.
    await addS1Career(me.profileId, 30_000, '2026-11-01T00:00:00.000Z');
    vi.setSystemTime(new Date(IN_S2));
    expect(await gift(me.cookie)).toBeNull();
  });

  it('옛 앱처럼 id 없이 누르면 지금 보이는 첫 선물을 준다', async () => {
    const me = await owner(30_000, 600);
    vi.setSystemTime(new Date(IN_S2));
    const res = await claim(me.cookie);
    expect(ItemsRes.parse(await res.json()).data).toMatchObject({ boost: 16, scout: 6 });
    expect(
      await ctx.db
        .select()
        .from(giftClaims)
        .where(
          and(eq(giftClaims.profileId, me.profileId), eq(giftClaims.giftId, ACH_SEASON_GIFT.id)),
        ),
    ).toHaveLength(1);
  });

  it('겹쳐 눌러도 한 번만 준다', async () => {
    const me = await owner(30_000, 600);
    vi.setSystemTime(new Date(IN_S2));
    const all = await Promise.all(
      Array.from({ length: 4 }, async () => claim(me.cookie, { id: ACH_SEASON_GIFT.id })),
    );
    expect(all.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);
    const items = ItemsRes.parse(
      await (await call('GET', '/v1/items', { cookie: me.cookie })).json(),
    );
    expect(items.data).toMatchObject({ boost: 16, scout: 6 });
  });

  it('받을 칸이 없으면(점수가 문턱 아래 · 작은 업적만) 카드가 없고 받기는 409', async () => {
    // 점수가 보상 문턱(40점) 아래면 시즌 1 업적을 세지 않는다.
    const low = await owner(30_000, 30);
    vi.setSystemTime(new Date(IN_S2));
    expect(await gift(low.cookie)).toBeNull();
    // 300골은 골 1 · 2단계(10 · 20점)뿐이라 보상 칸이 없다 — 세고 0장을 적는다.
    vi.setSystemTime(new Date(IN_S1));
    const small = await owner(300, 200);
    vi.setSystemTime(new Date(IN_S2));
    expect(await gift(small.cookie)).toBeNull();
    const [row] = await ctx.db
      .select()
      .from(ownerAchievements)
      .where(
        and(eq(ownerAchievements.profileId, small.profileId), eq(ownerAchievements.season, 1)),
      );
    expect([row?.rewardBoost, row?.rewardScout]).toEqual([0, 0]);
    expect((await claim(small.cookie, { id: ACH_SEASON_GIFT.id })).status).toBe(409);
  });

  it('T-11-472 구단주 선물은 없앴다 — 시즌 1 업적 보상만 보이고, 옛 구단주 선물 id는 받지 못한다', async () => {
    const me = await issueGoogleCookie(ctx);
    vi.setSystemTime(new Date(IN_S1));
    expect(await gift(me.cookie)).toBeNull();
    expect((await claim(me.cookie, { id: 'gift-2026-10' })).status).toBe(409);
    expect((await claim(me.cookie)).status).toBe(409);
  });
});
