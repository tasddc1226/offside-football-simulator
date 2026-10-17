// T-11-357 업적 달성 보상 — 새로 달성하면 한 번만 주고, 다시 불리거나 겹쳐 불려도 두 번 주지 않으며, 보상을 연 시즌에
// 이미 달성해 둔 업적에는 주지 않는다.
import { ACH_REWARD_BASELINE_SEASON, achRewardOf } from '@offside/contracts/owner-team';
import { and, eq } from 'drizzle-orm';
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
  it('40점 미만은 없음, 40~149점은 강화권 1장, 150점 이상은 스카우트권 1장', () => {
    expect(achRewardOf(30)).toBeNull();
    expect(achRewardOf(40)).toEqual({ boost: 1, scout: 0 });
    expect(achRewardOf(149)).toEqual({ boost: 1, scout: 0 });
    expect(achRewardOf(150)).toEqual({ boost: 0, scout: 1 });
  });

  it('단계 업적은 넘은 단계마다 그 단계 점수로 따진다', () => {
    // 골 1~5단계(10·20·40·80·160점): 3·4단계 강화권, 5단계 스카우트권.
    const steps = achRewardSteps(groupsOf([career({ goals: 10_000 })])).filter(
      (s) => s.id === 'goals',
    );
    expect(steps).toEqual([
      { id: 'goals', key: 'goals:3', boost: 1, scout: 0 },
      { id: 'goals', key: 'goals:4', boost: 1, scout: 0 },
      { id: 'goals', key: 'goals:5', boost: 0, scout: 1 },
    ]);
  });

  it('응답에는 다음 달성의 보상을 붙인다', () => {
    const all = withAchRewards(groupsOf([]), new Map());
    // 아직 하나도 못 깬 지금 — 다음 단계 보상이 있는 업적에만 reward가 붙는다.
    const goals = all.flatMap((g) => g.items).find((i) => i.id === 'goals');
    expect(goals?.reward).toBeUndefined(); // 1단계(10점)는 보상 없음
    const legend = all.flatMap((g) => g.items).find((i) => i.id === 'ballon-10');
    expect(legend?.reward).toEqual({ boost: 0, scout: 1 });
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
  // 50골 시즌(3단계 위업 50점 → 강화권 1장) · 레전드 점수 3,000점 선수(5단계 150점 → 스카우트권 1장).
  const feat = career({
    seasons: [{ league: 'K리그1', honors: [], club: 'A', goals: 50, cs: null }],
  });
  const star = career({ legendScore: 3000 });
  const SEASON = ACH_REWARD_BASELINE_SEASON + 1;

  it('새로 달성한 업적에 한 번만 주고, 다시 불러도 더 주지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    expect(await settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([]), NOW)).toEqual(
      new Map(),
    );
    const got = await settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([feat]), NOW);
    expect(got.get('season-50')).toEqual({ boost: 1, scout: 0 });
    expect(await items(me.profileId)).toEqual({ boost: 1 });
    // 재시도 · 다음 화면에서 다시 세도 그대로다(받은 보상은 계속 보인다).
    const again = await settleAchievementRewards(
      ctx.db,
      me.profileId,
      SEASON,
      groupsOf([feat]),
      NOW,
    );
    expect(again.get('season-50')).toEqual({ boost: 1, scout: 0 });
    expect(await items(me.profileId)).toEqual({ boost: 1 });
    // 다음 업적은 그 업적만 더 준다.
    await settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([feat, star]), NOW);
    expect(await items(me.profileId)).toEqual({ boost: 1, scout: 1 });
  });

  it('겹쳐 불려도 한 번만 준다', async () => {
    const me = await issueGoogleCookie(ctx);
    await Promise.all(
      Array.from({ length: 4 }, () =>
        settleAchievementRewards(ctx.db, me.profileId, SEASON, groupsOf([star]), NOW),
      ),
    );
    expect(await items(me.profileId)).toEqual({ scout: 1 });
  });

  it('보상을 연 시즌에는 처음 셀 때 이미 달성한 업적을 주지 않고, 그 뒤 달성한 것만 준다', async () => {
    const me = await issueGoogleCookie(ctx);
    const base = ACH_REWARD_BASELINE_SEASON;
    const first = await settleAchievementRewards(ctx.db, me.profileId, base, groupsOf([star]), NOW);
    expect(first.size).toBe(0);
    expect(await items(me.profileId)).toEqual({});
    const claims = await ctx.db
      .select()
      .from(giftClaims)
      .where(and(eq(giftClaims.profileId, me.profileId)));
    expect(claims.map((c) => c.giftId).sort()).toEqual([
      `ach:${base}:#base`,
      `ach:${base}:legend-3000`,
    ]);
    // 다시 세도 기준선 업적은 주지 않는다.
    await settleAchievementRewards(ctx.db, me.profileId, base, groupsOf([star]), NOW);
    expect(await items(me.profileId)).toEqual({});
    // 기준선 뒤에 새로 달성한 업적은 준다.
    const after = await settleAchievementRewards(
      ctx.db,
      me.profileId,
      base,
      groupsOf([star, feat]),
      NOW,
    );
    expect(await items(me.profileId)).toEqual({ boost: 1 });
    expect([...after.keys()]).toEqual(['season-50']);
  });

  it('기준선 시즌에 아무것도 달성하지 않았어도 표시를 남겨, 처음 달성한 업적을 준다', async () => {
    const me = await issueGoogleCookie(ctx);
    const base = ACH_REWARD_BASELINE_SEASON;
    await settleAchievementRewards(ctx.db, me.profileId, base, groupsOf([]), NOW);
    await settleAchievementRewards(ctx.db, me.profileId, base, groupsOf([star]), NOW);
    expect(await items(me.profileId)).toEqual({ scout: 1 });
  });
});
