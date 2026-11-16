import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GameCenterProgressSchema,
  ACHIEVEMENT_EUROPEAN_LEAGUES,
} from '@offside/contracts/game-center';
import { NATIONAL_WINS } from '@offside/contracts/nations';
import { createApp } from '../app.js';
import { createDb } from '../db/client.js';
import { gameCenterProgress } from '../db/repos/gameCenter.js';
import { careers, careerSeasons } from '../db/schema.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { issueCookie, TEST_CAREER } from '../test/http.js';

describe('Game Center server progress', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  const retired = (
    id: string,
    profileId: string,
    extra: Partial<typeof careers.$inferInsert> = {},
  ) => ({
    ...TEST_CAREER,
    id,
    profileId,
    pos: 'FW' as const,
    foot: '오른발' as const,
    status: 'retired' as const,
    retireAge: 40,
    legendScore: 100,
    ballon: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    retiredAt: '2026-10-01T00:00:00.000Z',
    ...extra,
  });
  const season = (careerId: string, league: string, honors: string[] = []) => ({
    careerId,
    year: 2026,
    age: 20,
    club: 'Test',
    league,
    apps: 30,
    goals: 0,
    assists: 0,
    rating: 6,
    rank: '1',
    ovr: 70,
    honorsJson: JSON.stringify(honors),
    mil: 0,
    eventsJson: '[]',
    createdAt: '2026-10-01T00:00:00.000Z',
  });

  it('requires a session, supports guests and never shares private progress', async () => {
    const app = createApp();
    expect((await app.request('/v1/owner/game-center', {}, ctx.env)).status).toBe(401);
    const me = await issueCookie(ctx);
    const r = await app.request(
      '/v1/owner/game-center',
      { headers: { Cookie: me.cookie } },
      ctx.env,
    );
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(GameCenterProgressSchema.parse(((await r.json()) as { data: unknown }).data)).toEqual({
      profileId: me.profileId,
      legendScore: null,
      achievements: [],
    });
  });

  it('combines past seasons while excluding hidden, active, short and other-owner records', async () => {
    const me = await issueCookie(ctx),
      other = await issueCookie(ctx);
    for (const row of [
      retired('old', me.profileId, { serviceSeason: 0, legendScore: 900, ballon: 1 }),
      retired('current', me.profileId, { serviceSeason: 2, legendScore: 200 }),
      retired('hidden', me.profileId, { hidden: 1, legendScore: 9000 }),
      retired('active', me.profileId, { status: 'active', legendScore: 8000 }),
      retired('short', me.profileId, { retireAge: 18, legendScore: 7000 }),
      retired('other', other.profileId, { legendScore: 6000 }),
    ])
      await ctx.db.insert(careers).values(row);
    await ctx.db
      .insert(careerSeasons)
      .values([
        season('old', ACHIEVEMENT_EUROPEAN_LEAGUES[0]!, [NATIONAL_WINS[0]!]),
        season('current', '고교리그'),
      ]);
    expect(await gameCenterProgress(ctx.db, me.profileId)).toEqual({
      profileId: me.profileId,
      legendScore: 900,
      achievements: ['first_retirement', 'first_europe', 'first_national_title', 'first_ballon'],
    });
  });

  it('does not infer milestones from excluded careers or malformed honor JSON; uses one indexed query', async () => {
    const me = await issueCookie(ctx);
    await ctx.db
      .insert(careers)
      .values([
        retired('valid', me.profileId, { legendScore: 0 }),
        retired('hidden', me.profileId, { hidden: 1, ballon: 5 }),
      ]);
    await ctx.db
      .insert(careerSeasons)
      .values([
        { ...season('valid', '고교리그'), honorsJson: 'broken' },
        season('hidden', ACHIEVEMENT_EUROPEAN_LEAGUES[0]!, [NATIONAL_WINS[0]!]),
      ]);
    const observed = spyDb(ctx.env.DB);
    expect(await gameCenterProgress(createDb(observed.DB), me.profileId)).toEqual({
      profileId: me.profileId,
      legendScore: 0,
      achievements: ['first_retirement'],
    });
    expect(observed.trips.n).toBe(1);
    const query = observed.seen[0]!;
    const plan = await ctx.env.DB.prepare(`EXPLAIN QUERY PLAN ${query}`)
      .bind(...Array.from({ length: (query.match(/\?/g) ?? []).length }, () => null))
      .all();
    const details = plan.results.map((r) => String(r.detail)).join('\n');
    expect(details).toMatch(/SEARCH careers USING INDEX careers_profile_status/);
    expect(details).toMatch(/SEARCH career_seasons USING/);
  });

  it('awards a first retirement for a short career without submitting an ineligible ranking score', async () => {
    const me = await issueCookie(ctx);
    await ctx.db.insert(careers).values(retired('short', me.profileId, { retireAge: 20 }));
    expect(await gameCenterProgress(ctx.db, me.profileId)).toEqual({
      profileId: me.profileId,
      legendScore: null,
      achievements: ['first_retirement'],
    });
  });
});
