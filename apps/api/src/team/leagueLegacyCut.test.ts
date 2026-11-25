// T-11-828 시즌 2 리그를 28라운드(12/2)에서 끝내고 제3기를 이틀 뒤 바로 잇는다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { leagueKickoffAt, planLeague } from '@offside/contracts/league';
import { leagueMatches, leagueState } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { currentLeague } from './leagueSchedule.js';
import { runLeague } from './league.js';

const S2 = '2026-10-30T15:00:00.000Z';
const L2 = planLeague(2, S2);

describe('시즌 2 리그 28라운드 마감과 제3기 잇기 (T-11-828)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T00:00:00.000Z'));
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(1, S2, false));
  });
  afterEach(async () => {
    vi.useRealTimers();
    applySeasonSchedule([]);
    forgetSeasonSchedule();
    await ctx.dispose();
  });

  const drawn = (doneAt: string | null = null) =>
    ctx.db.insert(leagueState).values({
      season: 2,
      seed: 'legacy',
      tiersJson: JSON.stringify([{ tier: 1, leagues: 1, teams: 2 }]),
      drawnAt: L2.drawAt,
      doneAt,
    });

  it('시즌 마감이 정해지지 않아도 시즌 2 일정은 12/2 28라운드에서 끝난다', async () => {
    const league = await currentLeague(ctx.db, '2026-11-25T00:00:00.000Z');
    expect(league).toMatchObject({ season: 2 });
    expect(league?.teamSeason).toBeUndefined();
    expect(league?.rounds).toHaveLength(28);
    expect(league?.rounds.at(-1)).toBe('2026-12-02T04:00:00.000Z');
  });

  it('cron이 28라운드 뒤로 잡힌 경기를 지우고 28라운드를 21:00에 함께 연다', async () => {
    await drawn();
    // 옛 일정(55라운드)으로 만든 경기: 27라운드까지 치렀고 28 · 29 · 30라운드가 남았다.
    const dayOf = (round: number) =>
      new Date(Date.parse(L2.rounds[0]!) + (round - 1) * 86_400_000).toISOString();
    for (let round = 1; round <= 30; round++)
      await ctx.db.insert(leagueMatches).values({
        id: `m${round}`,
        season: 2,
        tier: 1,
        leagueNo: 1,
        round,
        slot: 0,
        homeTeamId: 'a',
        awayTeamId: 'b',
        at: dayOf(round),
        ...(round <= 27 ? { playedAt: dayOf(round), homeGoals: 1, awayGoals: 0 } : {}),
      });
    const now = '2026-12-01T06:00:00.000Z';
    expect(await runLeague(ctx.db, now)).toEqual({ season: 2, step: 'trim', rounds: 28 });
    const left = await ctx.db
      .select({ round: leagueMatches.round, at: leagueMatches.at })
      .from(leagueMatches)
      .where(eq(leagueMatches.season, 2))
      .orderBy(asc(leagueMatches.round));
    expect(left.map((m) => m.round).at(-1)).toBe(28);
    expect(left.at(-1)?.at).toBe(leagueKickoffAt(L2.rounds.at(-1)!, 28, 0, 1, true));
    expect(left.at(-1)?.at).toBe('2026-12-02T12:00:00.000Z');
  });

  it('결산이 끝나고 결과를 하루 보여 준 뒤에는 제3기를 이틀 뒤 하루 접수로 연다(시즌 2 팀)', async () => {
    // 결과를 보여 주는 하루(12/2 21:00 KST 마지막 라운드부터 하루) 동안은 시즌 2.
    await drawn('2026-12-02T13:00:00.000Z');
    expect((await currentLeague(ctx.db, '2026-12-03T11:00:00.000Z'))?.season).toBe(2);
    const next = await currentLeague(ctx.db, '2026-12-03T13:00:00.000Z');
    expect(next).toMatchObject({
      season: 3,
      teamSeason: 2,
      startsAt: '2026-12-03T15:00:00.000Z',
      opensAt: '2026-12-03T15:00:00.000Z',
      closesAt: '2026-12-04T15:00:00.000Z',
      drawAt: '2026-12-05T00:00:00.000Z',
    });
    expect(next?.rounds).toHaveLength(28);
    expect(next?.rounds[0]).toBe('2026-12-05T04:00:00.000Z');
  });

  it('시즌 2 결산이 밀리면 제3기로 넘어가지 않는다', async () => {
    await drawn();
    expect((await currentLeague(ctx.db, '2026-12-04T13:00:00.000Z'))?.season).toBe(2);
  });
});
