import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { planLeagueCycle, leagueKickoffAt } from '@offside/contracts/league';
import {
  cards,
  cups,
  cupEntries,
  ownerTeams,
  careers,
  leagueEntries,
  leagueMatches,
  leagueSeasons,
  leagueState,
} from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { currentLeague, saveLeagueCycle } from './leagueSchedule.js';
import { runLeague, leagueLineupLocked } from './league.js';
import { checkEditableSeason } from './saveOwnerTeam.js';

const S2 = '2026-10-01T15:00:00.000Z';
const S3 = '2026-10-25T15:00:00.000Z';
const S4 = '2026-11-24T15:00:00.000Z';
const L = planLeagueCycle(3, S3, 3, true);
const plus = (at: string, ms: number) => new Date(Date.parse(at) + ms).toISOString();
const DAY = 86_400_000;

describe('independent league cycles (T-11-708)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(plus(S3, 2 * DAY)));
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(1, S2, false));
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(2, S3, false));
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(3, S4, false));
  });
  afterEach(async () => {
    vi.useRealTimers();
    applySeasonSchedule([]);
    forgetSeasonSchedule();
    await ctx.dispose();
  });
  async function drain(now: string) {
    const steps = [];
    for (let n = 0; n < 100; n++) {
      const step = await runLeague(ctx.db, now);
      if (!step) return steps;
      steps.push(step);
    }
    throw new Error('league did not drain');
  }
  async function entrant(n: number) {
    const who = await issueGoogleCookie(ctx, { nickname: `Cycle${n}` });
    const ids = [];
    for (let i = 0; i < 8; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      await ctx.db.insert(careers).values({
        id,
        profileId: who.profileId,
        pos: 'FW',
        foot: '오른발',
        type: 'poacher',
        trait: 'late',
        startYear: 2027,
        status: 'retired',
        appVersion: '1.0.0',
        createdAt: S3,
        updatedAt: S3,
        retiredAt: S3,
        retireAge: 34,
        peak: 80,
        legendScore: 300,
        shirtNumber: 9,
        serviceSeason: 3,
      });
      await ctx.db.insert(cards).values({
        careerId: id,
        ownerId: who.profileId,
        serviceSeason: 3,
        pos: 'FW',
        number: 9,
        peak: 80,
        legendScore: 300,
        retireValue: 0,
        createdAt: S3,
        updatedAt: S3,
      });
    }
    const body = {
      name: `Team${n}`,
      manager: 'Manager',
      formation: '4-3-3',
      season: 3,
      slots: [...ids, null, null, null],
    };
    const save = await callJson(ctx.env, 'PUT', '/v1/owner-team', { cookie: who.cookie, body });
    expect(save.status).toBe(200);
    const enter = await callJson(ctx.env, 'POST', '/v1/leagues/current/entries', {
      cookie: who.cookie,
      headers: { 'Idempotency-Key': `cycle-entry-${n}` },
    });
    expect(enter.status).toBe(204);
    return { ...who, body };
  }
  it('reads the first full schedule without writing on public GETs', async () => {
    const league = await currentLeague(ctx.db, plus(S3, 2 * DAY));
    expect(league).toMatchObject({ season: 3, teamSeason: 3 });
    expect(league?.rounds).toHaveLength(28);
    const view = await callJson(ctx.env, 'GET', '/v1/leagues/current');
    expect(view.status).toBe(200);
    expect(await ctx.db.select().from(leagueSeasons)).toEqual([]);
  });
  it('keeps the requested league team editable when another past-season cup is active', async () => {
    const who = await entrant(0);
    const [team] = await ctx.db
      .select()
      .from(ownerTeams)
      .where(eq(ownerTeams.profileId, who.profileId));
    await saveLeagueCycle(ctx.db, L, L.drawAt);
    await ctx.db
      .insert(leagueState)
      .values({ season: 3, seed: 'cycle', tiersJson: '[]', drawnAt: L.drawAt });
    await ctx.db
      .update(leagueEntries)
      .set({ teamId: team!.id })
      .where(eq(leagueEntries.profileId, who.profileId));
    await ctx.db.insert(cups).values({
      id: 'overlapping-old-cup',
      season: 2,
      edition: 99,
      opensAt: S2,
      closesAt: S3,
      drawAt: S3,
      roundsJson: '[]',
      capacity: 8,
      minFilled: 8,
      createdAt: S2,
    });
    await ctx.db.insert(cupEntries).values({
      cupId: 'overlapping-old-cup',
      teamId: 'old-team',
      profileId: who.profileId,
      name: 'Old team',
      manager: 'Manager',
      ovr: 80,
      createdAt: S2,
      updatedAt: S2,
    });
    vi.setSystemTime(new Date(plus(S4, DAY)));
    const view = await callJson(ctx.env, 'GET', '/v1/owner-team?season=3', { cookie: who.cookie });
    expect(view.status).toBe(200);
    expect(await view.json()).toMatchObject({ data: { season: 3, current: 4, cupSeason: 3 } });
  });
  it('waits for delayed settlement instead of skipping a league season', async () => {
    await saveLeagueCycle(ctx.db, L, L.drawAt);
    await ctx.db
      .insert(leagueState)
      .values({ season: 3, seed: 'cycle', tiersJson: '[]', drawnAt: L.drawAt });
    const later = plus(L.rounds.at(-1)!, 5 * DAY);
    expect((await currentLeague(ctx.db, later))?.season).toBe(3);
    await ctx.db.update(leagueState).set({ doneAt: later }).where(eq(leagueState.season, 3));
    const next = await currentLeague(ctx.db, later);
    expect(next).toMatchObject({ season: 4, teamSeason: 4 });
    expect(next?.rounds).toHaveLength(28);
  });
  it('plays, settles once, carries promotion, and runs the next edition with the service team', async () => {
    const people = [];
    for (let n = 0; n < 15; n++) people.push(await entrant(n));
    await drain(L.drawAt);
    // The service season changes during this league. Its team season remains pinned at 3.
    const last = leagueKickoffAt(L.rounds.at(-1)!, 28, 0, 1, true);
    expect(last > S4).toBe(true);
    expect(await checkEditableSeason(ctx.db, people[0]!.profileId, 3, 4)).toBe(true);
    const [entry] = await ctx.db
      .select()
      .from(leagueEntries)
      .where(eq(leagueEntries.profileId, people[0]!.profileId));
    const scheduled = await ctx.db.select().from(leagueMatches).where(eq(leagueMatches.season, 3));
    const match = scheduled.find(
      (m) => m.homeTeamId === entry!.teamId || m.awayTeamId === entry!.teamId,
    )!;
    expect(
      await leagueLineupLocked(ctx.db, people[0]!.profileId, 3, plus(match.at, -30 * 60_000)),
    ).toBe(true);
    vi.setSystemTime(new Date(plus(S4, DAY)));
    const me = await callJson(ctx.env, 'GET', '/v1/owner-team?season=3', {
      cookie: people[0]!.cookie,
    });
    expect(me.status).toBe(200);
    const steps = await drain(plus(last, 1000));
    expect(steps.some((s) => s.step === 'settle')).toBe(true);
    const matches = await ctx.db.select().from(leagueMatches).where(eq(leagueMatches.season, 3));
    expect(matches).toHaveLength(28 * 7);
    expect(matches.every((m) => m.playedAt && m.forfeit === 0)).toBe(true);
    const final = await ctx.db.select().from(leagueEntries).where(eq(leagueEntries.season, 3));
    expect(final.every((e) => e.rewardedAt && e.outcome)).toBe(true);
    const items = (
      await ctx.env.DB.prepare('SELECT * FROM owner_items ORDER BY profile_id, item').all()
    ).results;
    await drain(plus(last, 2000));
    expect(
      (await ctx.env.DB.prepare('SELECT * FROM owner_items ORDER BY profile_id, item').all())
        .results,
    ).toEqual(items);
    const next = await currentLeague(ctx.db, plus(last, 2 * DAY));
    expect(next).toMatchObject({ season: 4, teamSeason: 4 });
    expect(next?.rounds).toHaveLength(28);
    // Historical matches and settled entries remain intact after moving to edition 4.
    expect(await ctx.db.select().from(leagueEntries).where(eq(leagueEntries.season, 3))).toEqual(
      final,
    );
    const previousTeamEditable = checkEditableSeason(ctx.db, people[0]!.profileId, 3, 4);
    await expect(previousTeamEditable).rejects.toMatchObject({
      details: { reason: 'SEASON_CLOSED' },
    });
    // Re-enter with service-season 4 teams. League 4 must use league 3's promotion results.
    vi.setSystemTime(new Date(next!.opensAt));
    for (const [n, who] of people.entries()) {
      expect(
        (
          await callJson(ctx.env, 'PUT', '/v1/owner-team', {
            cookie: who.cookie,
            body: { ...who.body, season: 4 },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await callJson(ctx.env, 'POST', '/v1/leagues/current/entries', {
            cookie: who.cookie,
            headers: { 'Idempotency-Key': `cycle4-${n}` },
          })
        ).status,
      ).toBe(204);
    }
    await drain(next!.drawAt);
    const promoted = final.find((e) => e.outcome === 'promoted')!;
    const fourth = (
      await ctx.db.select().from(leagueEntries).where(eq(leagueEntries.season, 4))
    ).find((e) => e.profileId === promoted.profileId);
    expect(fourth?.tier).toBe(1);
    await drain(plus(leagueKickoffAt(next!.rounds.at(-1)!, 28, 0, 1, true), 1000));
    const fifth = await currentLeague(ctx.db, plus(next!.rounds.at(-1)!, 2 * DAY));
    expect(fifth).toMatchObject({ season: 5, teamSeason: 4 });
    // League IDs now differ from team seasons; eligibility still uses service season 4.
    await saveLeagueCycle(ctx.db, fifth!, fifth!.drawAt);
    const [persisted] = await ctx.db
      .select()
      .from(leagueSeasons)
      .where(eq(leagueSeasons.season, 5));
    expect(persisted?.teamSeason).toBe(4);
    vi.setSystemTime(new Date(fifth!.opensAt));
    for (const [n, who] of people.entries()) {
      const enter = await callJson(ctx.env, 'POST', '/v1/leagues/current/entries', {
        cookie: who.cookie,
        headers: { 'Idempotency-Key': `cycle5-${n}` },
      });
      expect(enter.status).toBe(204);
    }
    await drain(fifth!.drawAt);
    const fifthMatches = await ctx.db
      .select()
      .from(leagueMatches)
      .where(eq(leagueMatches.season, 5));
    expect(fifthMatches).toHaveLength(28 * 7);
    const firstKickoffs = fifthMatches
      .filter((m) => m.round === 1)
      .map((m) => m.at)
      .sort();
    await drain(plus(firstKickoffs.at(-1)!, 1000));
    const firstRound = (
      await ctx.db.select().from(leagueMatches).where(eq(leagueMatches.season, 5))
    ).filter((m) => m.round === 1);
    expect(firstRound.every((m) => m.playedAt && m.forfeit === 0)).toBe(true);
  }, 60_000);
});
