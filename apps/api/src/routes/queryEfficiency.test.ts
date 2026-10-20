import { planCup } from '@offside/contracts/cup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cupMatchesIn } from '../team/cup.js';
import { createDb } from '../db/client.js';
import { cups, cupEntries, cupMatches, cupState, ownerTeams } from '../db/schema.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueAdminCookie, issueGoogleCookie } from '../test/http.js';
import { flushEdge, installFakeEdgeCache } from '../test/edgeCache.js';
import { checkCupLineup, checkCupListing, checkCupManager } from './cup.js';

const NOW = '2026-10-10T03:00:00.000Z';
const defs = Array.from({ length: 8 }, (_, i) =>
  planCup({ id: `s1-${i + 10}`, season: 1, edition: i + 10, opensOn: '2026-10-09', capacity: 64 }),
);

describe('API query counts without changing eligibility or response data', () => {
  let ctx: TestD1;
  let edge: ReturnType<typeof installFakeEdgeCache> | undefined;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    await ctx.db.insert(cups).values(
      defs.map((cup) => ({
        id: cup.id,
        season: cup.season,
        edition: cup.edition,
        opensAt: cup.opensAt,
        closesAt: cup.closesAt,
        drawAt: cup.drawAt,
        roundsJson: JSON.stringify(cup.rounds),
        capacity: cup.capacity,
        minFilled: cup.minFilled,
        createdAt: NOW,
      })),
    );
  });
  afterEach(async () => {
    edge?.uninstall();
    edge = undefined;
    vi.useRealTimers();
    await ctx.dispose();
  });

  async function entrant() {
    const who = await issueGoogleCookie(ctx);
    await ctx.db.insert(ownerTeams).values({
      id: 'audit-team',
      profileId: who.profileId,
      season: 1,
      name: 'Audit',
      manager: 'Manager',
      formation: '4-4-2',
      filled: 1,
      ovr: 60,
      slotsJson: JSON.stringify(['starter', ...Array(10).fill(null)]),
      createdAt: NOW,
      updatedAt: NOW,
    });
    await ctx.db.insert(cupEntries).values(
      defs.slice(0, 2).map((cup) => ({
        cupId: cup.id,
        profileId: who.profileId,
        teamId: 'audit-team',
        name: 'Audit',
        manager: 'Manager',
        ovr: 60,
        createdAt: NOW,
        updatedAt: NOW,
      })),
    );
    return who;
  }

  it('lists every cup with constant SQL count and preserves scheduled/entry/running/done and withdrawn totals', async () => {
    const who = await entrant();
    await ctx.db.insert(cupEntries).values({
      cupId: defs[0]!.id,
      profileId: (await issueGoogleCookie(ctx)).profileId,
      teamId: 'withdrawn',
      name: 'Withdrawn',
      manager: 'Manager',
      ovr: 60,
      status: 'withdrawn',
      createdAt: NOW,
      updatedAt: NOW,
    });
    await ctx.db.insert(cupState).values([
      { cupId: defs[0]!.id, seed: 'a', groups: 1, drawnAt: NOW },
      { cupId: defs[1]!.id, seed: 'b', groups: 1, drawnAt: NOW, doneAt: NOW },
    ]);
    const { cookie } = await issueAdminCookie(ctx);
    const traced = spyDb(ctx.env.DB);
    const res = await callJson(
      { ...ctx.env, DB: traced.DB, ADMIN_EMAILS: ADMIN_EMAIL },
      'GET',
      '/v1/admin/cups',
      { cookie },
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { items: { cup: { id: string }; status: string; entries: number }[] };
    };
    expect(data.items).toHaveLength(9); // eight fixture cups plus the migrated first cup
    expect(data.items.find((x) => x.cup.id === defs[0]!.id)).toMatchObject({
      status: 'running',
      entries: 1,
    });
    expect(data.items.find((x) => x.cup.id === defs[1]!.id)).toMatchObject({
      status: 'done',
      entries: 1,
    });
    expect(data.items.find((x) => x.cup.id === defs[2]!.id)).toMatchObject({
      status: 'entry',
      entries: 0,
    });
    const relevant = traced.seen.filter((q) => /(?:from|join) "cup_(?:state|entries)"/.test(q));
    expect(relevant).toHaveLength(2);
    expect(traced.trips.log.filter((q) => q.startsWith('batch[2]'))).toHaveLength(1);
    // Authentication remains required even when the list was just read.
    expect((await callJson(ctx.env, 'GET', '/v1/admin/cups', { cookie: who.cookie })).status).toBe(
      403,
    );
  });

  it('sales and manager conversion check active participation without loading unused matches; starters stay locked', async () => {
    const who = await entrant();
    for (const check of [checkCupListing, checkCupManager]) {
      const traced = spyDb(ctx.env.DB),
        db = createDb(traced.DB);
      await expect(check(db, who.profileId, 1, 'starter')).rejects.toMatchObject({
        details: { reason: 'CUP_CARD_LOCKED' },
      });
      await expect(check(db, who.profileId, 1, 'not-a-starter')).resolves.toBeUndefined();
      expect(traced.seen.filter((q) => /from "cup_matches"/.test(q))).toHaveLength(0);
    }
  });

  it('lineup checks read all active-cup matches once and listings once, and still reject a lock in the second cup', async () => {
    const who = await entrant();
    const traced = spyDb(ctx.env.DB),
      db = createDb(traced.DB);
    await checkCupLineup(db, who.profileId, 1, ['starter'], 11, NOW, 60);
    expect(traced.seen.filter((q) => /from "cup_matches"/.test(q))).toHaveLength(1);
    expect(traced.seen.filter((q) => /FROM market_listings/i.test(q))).toHaveLength(1);
    expect(traced.seen.filter((q) => /from "cup_matches"/.test(q))[0]).not.toContain('detail_json');
    await ctx.db.insert(cupMatches).values({
      id: 'audit-lock',
      cupId: defs[1]!.id,
      round: 'g1',
      grp: 1,
      slot: 0,
      homeTeamId: 'audit-team',
      awayTeamId: 'other',
      at: NOW,
    });
    await expect(
      checkCupLineup(db, who.profileId, 1, ['starter'], 11, NOW, 60),
    ).rejects.toMatchObject({ details: { reason: 'CUP_LINEUP_LOCKED' } });
    await expect(
      checkCupLineup(db, who.profileId, 1, ['starter'], 7, NOW, 60),
    ).rejects.toMatchObject({ details: { reason: 'CUP_MIN_FILLED' } });
  });

  it('active-cup reads stay within D1 binding limits beyond 100 cup ids', async () => {
    const traced = spyDb(ctx.env.DB);
    expect(
      await cupMatchesIn(
        createDb(traced.DB),
        Array.from({ length: 128 }, (_, i) => `s1-${i}`),
      ),
    ).toEqual([]);
    expect(traced.trips.n).toBe(1);
  });

  it('a stable prediction cache hit reads neither schedule, predictions nor session; a vote purges it', async () => {
    edge = installFakeEdgeCache();
    const { cookie } = await issueGoogleCookie(ctx);
    const path = `/v1/cups/${defs[0]!.id}/predictions`;
    expect((await callJson(ctx.env, 'GET', path, { cookie })).status).toBe(200);
    await flushEdge();
    const traced = spyDb(ctx.env.DB);
    expect((await callJson({ ...ctx.env, DB: traced.DB }, 'GET', path, { cookie })).status).toBe(
      200,
    );
    expect(traced.seen).toEqual([]);
    await ctx.db.insert(cupMatches).values({
      id: 'audit-vote',
      cupId: defs[0]!.id,
      round: 'g1',
      grp: 1,
      slot: 0,
      homeTeamId: 'home',
      awayTeamId: 'away',
      at: '2026-10-11T12:00:00.000Z',
    });
    expect(
      (
        await callJson(ctx.env, 'PUT', `/v1/cups/${defs[0]!.id}/matches/audit-vote/prediction`, {
          cookie,
          body: { pick: 'home' },
        })
      ).status,
    ).toBe(200);
    await flushEdge();
    expect(edge.purged.some((k) => k.endsWith('/cups/home') || k.endsWith('/cups/current'))).toBe(
      false,
    );
    const res = await callJson(ctx.env, 'GET', path);
    expect(await res.json()).toMatchObject({
      data: { items: [{ matchId: 'audit-vote', home: 1, draw: 0, away: 0 }] },
    });
    expect((await callJson(ctx.env, 'GET', '/v1/cups/not-a-cup/predictions')).status).toBe(404);
    expect(edge.store.has('http://localhost/v1/cups/not-a-cup/predictions')).toBe(false);
  });
});
