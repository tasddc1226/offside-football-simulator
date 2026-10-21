// T-11-357 업적 달성 보상 — 새로 달성하면 한 번만 주고, 다시 불리거나 겹쳐 불려도 두 번 주지 않으며, 보상을 주기 전
// 시즌(시즌 1)에는 주지도 적지도 않는다. 한 시즌에 받는 양에는 상한이 없다.
import { ACH_REWARD_FIRST_SEASON, achRewardOf } from '@offside/contracts/owner-team';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { giftClaims, ownerItems } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie } from '../test/http.js';
import {
  achRewardSteps,
  clubAchievements,
  withAchRewards,
  type AchievementCareer,
} from './achievements.js';
import { settleAchievementRewards } from './ownerAchievements.js';

const career = (over: Partial<AchievementCareer> = {}): AchievementCareer => ({
  pos: 'FW',
  dpos: null,
  caps: 0,
  ballon: 0,
  trophies: 0,
  awards: 0,
  apps: 0,
  goals: 0,
  assists: 0,
  legendScore: 0,
  retiredNumber: false,
  nation: null,
  retireAge: 35,
  seasons: [],
  ...over,
});
const owner = { retireDays: 0, matchDays: 0, likesGiven: 0, nickname: false };
const groupsOf = (careers: AchievementCareer[]) =>
  clubAchievements({ careers, team: null, owner, detail: true, retireAt: 45 });
const NOW = '2026-10-17T00:00:00.000Z';

describe('업적 보상 표(achRewardOf · achRewardSteps)', () => {
  it('40점 미만은 없음, 점수가 높을수록 강화권이 늘고 150점부터 스카우트권을 더한다', () => {
    expect(achRewardOf(30)).toBeNull();
    expect(achRewardOf(40)).toEqual({ boost: 1, scout: 0 });
    expect(achRewardOf(79)).toEqual({ boost: 1, scout: 0 });
    expect(achRewardOf(80)).toEqual({ boost: 2, scout: 0 });
    expect(achRewardOf(149)).toEqual({ boost: 2, scout: 0 });
    expect(achRewardOf(150)).toEqual({ boost: 3, scout: 1 });
    expect(achRewardOf(249)).toEqual({ boost: 3, scout: 1 });
    expect(achRewardOf(250)).toEqual({ boost: 3, scout: 2 });
  });

  it('단계 업적은 넘은 단계마다 그 단계 점수로 따진다', () => {
    // 골 1~6단계(10·20·40·80·160·320점): 3단계부터 보상, 5단계부터 스카우트권을 더한다.
    const steps = achRewardSteps(groupsOf([career({ goals: 30_000 })])).filter(
      (s) => s.id === 'goals',
    );
    expect(steps).toEqual([
      { id: 'goals', key: 'goals:3', boost: 1, scout: 0 },
      { id: 'goals', key: 'goals:4', boost: 2, scout: 0 },
      { id: 'goals', key: 'goals:5', boost: 3, scout: 1 },
      { id: 'goals', key: 'goals:6', boost: 3, scout: 2 },
    ]);
  });

  it('응답에는 다음 달성의 보상을 붙인다', () => {
    const all = withAchRewards(groupsOf([]), new Map());
    // 아직 하나도 못 깬 지금 — 다음 단계 보상이 있는 업적에만 reward가 붙는다.
    const goals = all.flatMap((g) => g.items).find((i) => i.id === 'goals');
    expect(goals?.reward).toBeUndefined(); // 1단계(10점)는 보상 없음
    const ballon = all.flatMap((g) => g.items).find((i) => i.id === 'ballon-10');
    expect(ballon?.reward).toEqual({ boost: 3, scout: 1 });
    const goat = all.flatMap((g) => g.items).find((i) => i.id === 'ballon-100');
    expect(goat?.reward).toEqual({ boost: 3, scout: 2 });
  });
});

describe('settleAchievementRewards (gift_claims · owner_items)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  const items = async (profileId: string) => {
    const rows = await ctx.db.select().from(ownerItems).where(eq(ownerItems.profileId, profileId));
    return Object.fromEntries(rows.map((r) => [r.item, r.qty]));
  };
  // 레전드 점수 3,000점 선수(150점 → 강화권 3장 · 스카우트권 1장) · 통산 3만 골(골 3~6단계와 골 업적들 → 강화권 16장 ·
  // 스카우트권 6장).
  const feat = career({ legendScore: 3000 });
  const star = career({ goals: 30_000 });
  // 단계 업적을 모두 끝까지 깬 선수 — 강화권·스카우트권 칸이 예전 시즌 상한보다 많다.
  const goat = career({
    goals: 30_000,
    assists: 15_000,
    apps: 100_000,
    caps: 10_000,
    trophies: 2_000,
    awards: 3_000,
    legendScore: 100_000,
    ballon: 100,
  });
  const SEASON = ACH_REWARD_FIRST_SEASON;

  it('새로 달성한 업적에 한 번만 주고, 다시 불러도 더 주지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const none = await settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([]), NOW);
    expect(none).toEqual(new Map());
    const got = await settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([feat]), NOW);
    expect(got.get('legend-3000')).toEqual({ boost: 3, scout: 1 });
    expect(await items(me.profileId)).toEqual({ boost: 3, scout: 1 });
    // 재시도 · 다음 화면에서 다시 세도 그대로다(받은 보상은 계속 보인다).
    const again = await settleAchievementRewards(
      ctx.db,
      me.profileId,
      SEASON,
      groupsOf([feat]),
      NOW,
    );
    expect(again.get('legend-3000')).toEqual({ boost: 3, scout: 1 });
    expect(await items(me.profileId)).toEqual({ boost: 3, scout: 1 });
    // 다음 업적은 그 업적만 더 준다.
    await settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([feat, star]), NOW);
    expect(await items(me.profileId)).toEqual({ boost: 19, scout: 7 });
  });

  it('겹쳐 불려도 한 번만 준다', async () => {
    const me = await issueGoogleCookie(ctx);
    await Promise.all(
      Array.from({ length: 4 }, () =>
        settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([star]), NOW),
      ),
    );
    expect(await items(me.profileId)).toEqual({ boost: 16, scout: 6 });
  });

  it('한 시즌에 받는 보상에는 상한이 없다', async () => {
    const me = await issueGoogleCookie(ctx);
    const groups = groupsOf([goat]);
    const want = achRewardSteps(groups).reduce(
      (t, r) => ({ boost: t.boost + r.boost, scout: t.scout + r.scout }),
      { boost: 0, scout: 0 },
    );
    // 예전 상한(강화권 10 · 스카우트권 3)보다 훨씬 많다.
    expect(want.boost).toBeGreaterThan(10);
    expect(want.scout).toBeGreaterThan(3);
    const first = await settleAchievementRewards(ctx.db, me.profileId, SEASON, groups, NOW);
    expect(await items(me.profileId)).toEqual(want);
    // 다시 세도 더 주지 않고, 받은 보상 합은 그대로다.
    const again = await settleAchievementRewards(ctx.db, me.profileId, SEASON, groups, NOW);
    expect(await items(me.profileId)).toEqual(want);
    const sum = [...again.values()].reduce(
      (t, r) => ({ boost: t.boost + r.boost, scout: t.scout + r.scout }),
      { boost: 0, scout: 0 },
    );
    expect(sum).toEqual(want);
    expect(first).toEqual(again);
  });

  it('보상을 주기 전 시즌에는 주지도 적지도 않고, 다음 시즌은 첫 달성부터 준다', async () => {
    const me = await issueGoogleCookie(ctx);
    const before = ACH_REWARD_FIRST_SEASON - 1;
    const first = await settleAchievementRewards(
      ctx.db,
      me.profileId,
      before,
      groupsOf([star]),
      NOW,
    );
    expect(first).toEqual(new Map());
    expect(await items(me.profileId)).toEqual({});
    expect(
      await ctx.db.select().from(giftClaims).where(eq(giftClaims.profileId, me.profileId)),
    ).toEqual([]);
    // 시즌 1에 이미 달성해 둔 업적도 시즌 2에는 첫 달성으로 받는다(시즌마다 새로 센다).
    await settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([star]), NOW);
    expect(await items(me.profileId)).toEqual({ boost: 16, scout: 6 });
  });
});
