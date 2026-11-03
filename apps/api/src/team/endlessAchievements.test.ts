// T-11-541 업적 상한 없애기 — 단계 업적은 정해 둔 마지막 단계 뒤로도 다음 목표가 이어지고(시즌 2부터), 점수 보너스는
// 1,500점마다 끝없이 한 번씩 준다. 시즌 1은 정해 둔 단계에서 멈춰 마감 점수가 바뀌지 않는다.
import {
  ACH_SCORE_BONUS,
  achScoreBonusCount,
  achScoreBonusOf,
} from '@offside/contracts/owner-team';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ownerItems } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie } from '../test/http.js';
import {
  achRewardSteps,
  achievementScore,
  clubAchievements,
  stepsOf,
  teamKeptOf,
  type AchievementCareer,
  type AchievementInput,
} from './achievements.js';
import { achBonusSteps, settleSeasonRewards } from './ownerAchievements.js';

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
const groupsOf = (careers: AchievementCareer[], over: Partial<AchievementInput> = {}) =>
  clubAchievements({ careers, team: null, owner, detail: true, retireAt: 45, ...over });
const item = (groups: ReturnType<typeof clubAchievements>, id: string) =>
  groups.flatMap((g) => g.items).find((i) => i.id === id)!;
const NOW = '2026-11-02T00:00:00.000Z';

describe('끝없는 단계(stepsOf)', () => {
  it('끝없는 시즌이 아니면 정해 둔 단계 그대로다', () => {
    expect(stepsOf([100, 300, 1000], 5000, false)).toEqual([100, 300, 1000]);
  });

  it('비율이 1.5 이상이면 같은 비율로, 유효숫자 두 자리로 다듬어 cur 다음 목표까지 만든다', () => {
    // 골: 30,000 다음은 ×3.
    expect(stepsOf([10000, 30000], 100_000, true)).toEqual([10000, 30000, 90000, 270000]);
    // 도움: 15,000 다음은 ×1.5(22,500 → 23,000).
    expect(stepsOf([10000, 15000], 15000, true)).toEqual([10000, 15000, 23000]);
    // 출전: ×1.67(166,667 → 170,000).
    expect(stepsOf([60000, 100000], 100_000, true)).toEqual([60000, 100000, 170000]);
  });

  it('비율이 작으면(레이팅 · RP) 같은 간격으로, add가 있으면 그 간격으로 늘린다', () => {
    expect(stepsOf([1400, 1700, 2000], 2300, true)).toEqual([1400, 1700, 2000, 2300, 2600]);
    expect(stepsOf([3, 7, 14, 30], 60, true, { add: 15 })).toEqual([3, 7, 14, 30, 45, 60, 75]);
  });

  it('목표는 늘 앞 단계보다 크다(작은 수의 반올림에도)', () => {
    const s = stepsOf([2, 3, 5], 1000, true);
    for (let i = 1; i < s.length; i++) expect(s[i]!).toBeGreaterThan(s[i - 1]!);
    expect(s[s.length - 1]!).toBeGreaterThan(1000);
  });
});

describe('끝없는 단계 업적(clubAchievements endless)', () => {
  it('마지막 단계를 넘어도 다음 목표가 남고, 넘은 단계마다 사다리 마지막 점수(320점)를 더한다', () => {
    const before = item(groupsOf([career({ goals: 100_000 })]), 'goals');
    expect(before).toMatchObject({ level: 6, next: null, points: 630, worth: 0 });
    const g = groupsOf([career({ goals: 100_000 })], { endless: true });
    // 정해 둔 6단계(10·20·40·80·160·320) + 9만 골 7단계(320).
    expect(item(g, 'goals')).toMatchObject({ level: 7, next: 270000, points: 950, worth: 320 });
    // 막 시작한 업적은 예전과 같다.
    expect(item(groupsOf([career({ goals: 150 })], { endless: true }), 'goals')).toMatchObject({
      level: 1,
      next: 300,
      points: 10,
      worth: 20,
    });
  });

  it('정해 둔 단계가 사다리보다 짧은 업적은 사다리를 이어 쓴다(A매치 6단계 320점)', () => {
    const g = groupsOf([career({ caps: 40_000 })], { endless: true });
    // 100 · 300 · 1,000 · 3,000 · 10,000 → 33,000(320점).
    expect(item(g, 'caps')).toMatchObject({ level: 6, next: 110000, points: 630, worth: 320 });
  });

  it('구단주 날 수 업적은 15일씩 이어진다', () => {
    const g = groupsOf([], { endless: true, owner: { ...owner, retireDays: 60 } });
    // 3 · 7 · 14 · 30 · 45 · 60일 → 다음 75일. 5단계 160점 · 6단계 320점.
    expect(item(g, 'owner-retire-days')).toMatchObject({ level: 6, next: 75, worth: 320 });
  });

  it('팀 단계 업적도 이어지고, 넘은 값은 팀 업적 기록(team_kept)에 그대로 남는다', () => {
    const team = {
      slots: [],
      wins: 400,
      bestStreak: 0,
      bestMargin: 0,
      goalsFor: 0,
      rating: 0,
      likes: 0,
    };
    const g = groupsOf([], { endless: true, team });
    // 10 · 30 · 100 → 330(80점) → 1,100.
    expect(item(g, 'team-wins')).toMatchObject({ level: 4, next: 1100, points: 220, worth: 80 });
    expect(teamKeptOf(g)['team-wins']).toBe(400);
  });

  it('끝없는 단계도 단계마다 보상 칸이 하나씩이다', () => {
    const steps = achRewardSteps(
      groupsOf([career({ goals: 300_000 })], { endless: true }),
      2,
    ).filter((s) => s.id === 'goals');
    // 시즌 2 표: 끝없는 단계(7 · 8단계)는 강화권 1장씩이다.
    expect(steps.map((s) => s.key)).toEqual([
      'goals:3',
      'goals:4',
      'goals:5',
      'goals:6',
      'goals:7',
      'goals:8',
    ]);
    expect(steps.slice(-2).every((s) => s.boost === 1 && s.scout === 0)).toBe(true);
  });
});

describe('점수 보너스(ACH_SCORE_BONUS)', () => {
  it('1,500점마다 강화권 1장 · 리롤권 2장, 네 번째마다 스카우트권 1장을 더한다', () => {
    expect(ACH_SCORE_BONUS.every).toBe(1500);
    expect(achScoreBonusCount(1499)).toBe(0);
    expect(achScoreBonusCount(1500)).toBe(1);
    expect(achScoreBonusCount(9740)).toBe(6);
    expect(achScoreBonusOf(1)).toEqual({ boost: 1, scout: 0, reroll: 2 });
    expect(achScoreBonusOf(4)).toEqual({ boost: 1, scout: 1, reroll: 2 });
    expect(achScoreBonusOf(8)).toEqual({ boost: 1, scout: 1, reroll: 2 });
    const steps = achBonusSteps(2, 12_345);
    expect(steps.map((s) => s.key)).toEqual(Array.from({ length: 8 }, (_, i) => `score:${i + 1}`));
    const sum = steps.reduce(
      (t, s) => ({
        boost: t.boost + s.boost,
        scout: t.scout + s.scout,
        reroll: t.reroll + s.reroll,
      }),
      { boost: 0, scout: 0, reroll: 0 },
    );
    expect(sum).toEqual({ boost: 8, scout: 2, reroll: 16 });
    // 시즌 1은 없다.
    expect(achBonusSteps(1, 12_345)).toEqual([]);
  });
});

describe('settleSeasonRewards — 점수 보너스는 한 번만', () => {
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

  it('다시 세거나 겹쳐 불려도 보너스를 한 번만 주고, 점수가 오르면 새 보너스만 더한다', async () => {
    const me = await issueGoogleCookie(ctx);
    const small = groupsOf([career({ goals: 1000 })], { endless: true });
    const big = groupsOf(
      [career({ goals: 30_000, assists: 15_000, apps: 100_000, legendScore: 3000, ballon: 10 })],
      { endless: true },
    );
    const scoreSmall = achievementScore(small).score;
    const scoreBig = achievementScore(big).score;
    expect(achScoreBonusCount(scoreSmall)).toBe(0);
    expect(achScoreBonusCount(scoreBig)).toBeGreaterThan(0);
    const stepSum = (g: typeof small) =>
      achRewardSteps(g, 2).reduce(
        (t, r) => ({ boost: t.boost + r.boost, scout: t.scout + r.scout }),
        {
          boost: 0,
          scout: 0,
        },
      );

    const first = await settleSeasonRewards(ctx.db, me.profileId, 2, small, NOW);
    expect(first.bonus).toEqual({
      next: 1500,
      reward: { boost: 1, scout: 0, reroll: 2 },
      got: { boost: 0, scout: 0, reroll: 0 },
    });
    expect(await items(me.profileId)).toEqual(stepSum(small));

    await Promise.all(
      Array.from({ length: 3 }, () => settleSeasonRewards(ctx.db, me.profileId, 2, big, NOW)),
    );
    const again = await settleSeasonRewards(ctx.db, me.profileId, 2, big, NOW);
    const n = achScoreBonusCount(scoreBig);
    const bonus = achBonusSteps(2, scoreBig).reduce(
      (t, s) => ({
        boost: t.boost + s.boost,
        scout: t.scout + s.scout,
        reroll: t.reroll + s.reroll,
      }),
      { boost: 0, scout: 0, reroll: 0 },
    );
    expect(again.bonus).toEqual({
      next: (n + 1) * ACH_SCORE_BONUS.every,
      reward: achScoreBonusOf(n + 1),
      got: bonus,
    });
    const steps = stepSum(big);
    expect(await items(me.profileId)).toEqual({
      boost: steps.boost + bonus.boost,
      scout: steps.scout + bonus.scout,
      reroll: bonus.reroll,
    });
  });

  it('보너스 없이 부르면(settleAchievementRewards 길) 보너스를 주지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const big = groupsOf([career({ goals: 30_000, legendScore: 3000, ballon: 10 })], {
      endless: true,
    });
    const r = await settleSeasonRewards(ctx.db, me.profileId, 2, big, NOW, false);
    expect(r.bonus).toBeNull();
    expect((await items(me.profileId)).reroll).toBeUndefined();
  });
});
