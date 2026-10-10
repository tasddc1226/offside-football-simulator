import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { collectStandings } from './provider.js';
import { SourcesSchema } from '@offside/contracts/club-strength-provider';
import { readStrengthState, readStrengthHistory, RUN_PREFIX, LOCK_KEY } from './store.js';
import { updateClubStrength, validateLeague } from './update.js';

const source = SourcesSchema.parse([
  {
    league: 'k1',
    provider: 'football-data',
    competition: 'KL',
    teams: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(100 + i), `k1-${i}`])),
    exclude: ['111'],
  },
])[0]!;
const table = Array.from({ length: 12 }, (_, i) => ({
  team: { id: 100 + i },
  playedGames: 4,
  won: i === 0 ? 3 : 0,
  draw: i === 0 || i === 11 ? 1 : 4,
  lost: i === 11 ? 3 : 0,
  points: i === 0 ? 10 : i === 11 ? 1 : 4,
  goalsFor: i === 0 ? 6 : i === 11 ? 0 : 1,
  goalsAgainst: i === 11 ? 6 : i === 0 ? 0 : 1,
}));
const response = () =>
  Response.json({ season: { startDate: '2026-01-01' }, standings: [{ type: 'TOTAL', table }] });
const day = Date.parse('2026-10-10T04:00:00Z');

describe('daily strength publication', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    Object.assign(ctx.env, {
      CLUB_STRENGTH_ENABLED: '1',
      FOOTBALL_DATA_TOKEN: 'private-key',
      CLUB_STRENGTH_SOURCES: JSON.stringify([source]),
    });
  });
  afterEach(async () => ctx.dispose());
  it('disabled/before 13:00 do not fetch or publish', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    expect(
      await updateClubStrength({ ...ctx.env, CLUB_STRENGTH_ENABLED: '0' }, day, fetcher),
    ).toBeNull();
    expect(await updateClubStrength(ctx.env, day - 1, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('one daily publication, immutable snapshot, same standings do not drift next day', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    const [a, b] = await Promise.all([
      updateClubStrength(ctx.env, day, fetcher),
      updateClubStrength(ctx.env, day, fetcher),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const first = await readStrengthState(ctx.env.DB);
    expect(first.snapshot.v).toBeGreaterThan(1);
    expect(Object.keys(first.snapshot.values).every((id) => id.startsWith('k1-'))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const next = await updateClubStrength(ctx.env, day + 86_400_000, fetcher);
    expect(next?.leagues[0]).toMatchObject({
      status: 'unchanged',
      reason: 'same-standings',
      changes: [],
    });
    expect((await readStrengthState(ctx.env.DB)).snapshot).toEqual(first.snapshot);
    expect(await updateClubStrength(ctx.env, day - 86_400_000, fetcher)).toBeNull();
    expect((await readStrengthHistory(ctx.env.DB)).runs).toHaveLength(2);
  });
  it('upstream failure preserves last good values and never records the key', async () => {
    await updateClubStrength(ctx.env, day, async () => response());
    const first = await readStrengthState(ctx.env.DB);
    const result = await updateClubStrength(
      ctx.env,
      day + 86_400_000,
      async () => new Response('private-key', { status: 503 }),
    );
    expect(result?.leagues[0]).toMatchObject({ status: 'failed', reason: 'provider-http-503' });
    expect((await readStrengthState(ctx.env.DB)).snapshot).toEqual(first.snapshot);
    expect(JSON.stringify(await readStrengthHistory(ctx.env.DB))).not.toContain('private-key');
  });
  it('older season or regressed played counts retain the last good snapshot', async () => {
    await updateClubStrength(ctx.env, day, async () => response());
    const first = await readStrengthState(ctx.env.DB);
    const oldSeason = await updateClubStrength(ctx.env, day + 86_400_000, async () =>
      Response.json({ season: { startDate: '2025-01-01' }, standings: [{ type: 'TOTAL', table }] }),
    );
    expect(oldSeason?.leagues[0]).toMatchObject({ status: 'failed', reason: 'stale-standings' });
    const fewer = table.map((r) => ({
      ...r,
      playedGames: 0,
      won: 0,
      draw: 0,
      lost: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }));
    const regressed = await updateClubStrength(ctx.env, day + 2 * 86_400_000, async () =>
      Response.json({
        season: { startDate: '2026-01-01' },
        standings: [{ type: 'TOTAL', table: fewer }],
      }),
    );
    expect(regressed?.leagues[0]).toMatchObject({ status: 'failed', reason: 'stale-standings' });
    expect((await readStrengthState(ctx.env.DB)).snapshot).toEqual(first.snapshot);
  });
  it('expired lease prevents a late worker from publishing', async () => {
    const result = await updateClubStrength(ctx.env, day, async () => {
      await ctx.env.DB.prepare('UPDATE app_meta SET value=? WHERE key=?')
        .bind('replacement', LOCK_KEY)
        .run();
      return response();
    });
    expect(result).toBeNull();
    expect((await readStrengthState(ctx.env.DB)).snapshot.v).toBe(1);
    expect(
      await ctx.env.DB.prepare('SELECT key FROM app_meta WHERE key=?')
        .bind(RUN_PREFIX + '2026-10-10')
        .first(),
    ).toBeNull();
    expect(
      await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
        .bind(LOCK_KEY)
        .first('value'),
    ).toBe('replacement');
  });
  it('bad settings and missing API keys remain visible as unconfigured', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    const r = await updateClubStrength({ ...ctx.env, CLUB_STRENGTH_SOURCES: '{' }, day, fetcher);
    expect(
      r?.leagues.every((l) => l.status === 'unconfigured' && l.reason === 'source-config-invalid'),
    ).toBe(true);
    const noKey = { ...ctx.env };
    delete noKey.FOOTBALL_DATA_TOKEN;
    const r2 = await updateClubStrength(noKey, day + 86_400_000, fetcher);
    expect(r2?.leagues[0]?.status).toBe('unconfigured');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fixed leagues, partial/duplicate/cross-league mappings and unknown teams fail closed', async () => {
    expect(SourcesSchema.safeParse([{ ...source, league: 'k2' }]).success).toBe(false);
    const collected = await collectStandings(source, 'key', async () => response());
    expect(() => validateLeague({ ...source, teams: { '100': 'k1-0' } }, collected.rows)).toThrow(
      'team-mapping-invalid',
    );
    expect(() =>
      validateLeague({ ...source, teams: { ...source.teams, '100': 'pl-0' } }, collected.rows),
    ).toThrow('team-mapping-invalid');
    expect(() => validateLeague({ ...source, exclude: [] }, collected.rows)).toThrow(
      'unmapped-team-ids:111',
    );
  });
  it('history paginates by indexed primary key without exposing private state', async () => {
    for (let i = 0; i < 32; i++) {
      const d = new Date(day - i * 86_400_000).toISOString().slice(0, 10);
      await ctx.env.DB.prepare('INSERT INTO app_meta(key,value) VALUES(?,?)')
        .bind(
          RUN_PREFIX + d,
          JSON.stringify({
            day: d,
            at: new Date(day - i * 86_400_000).toISOString(),
            version: 1,
            leagues: [],
          }),
        )
        .run();
    }
    const p1 = await readStrengthHistory(ctx.env.DB);
    expect(p1.runs).toHaveLength(30);
    expect(p1.nextBefore).not.toBeNull();
    const p2 = await readStrengthHistory(ctx.env.DB, p1.nextBefore!);
    expect(p2.runs).toHaveLength(2);
    expect(p2.runs.every((r) => !p1.runs.some((old) => old.day === r.day))).toBe(true);
  });
});

describe('API-Football normalization', () => {
  const config = { ...source, provider: 'api-football' as const, season: 2026 };
  const row = {
    team: { id: 100 },
    points: 3,
    all: { played: 1, win: 1, draw: 0, lose: 0, goals: { for: 1, against: 0 } },
  };
  const response = (standings: unknown, season = 2026) =>
    Response.json({ errors: [], response: [{ league: { season, standings } }] });
  it('deduplicates identical conference rows and rejects conflicting rows or wrong season', async () => {
    const collected = await collectStandings(config, 'key', async () => response([[row], [row]]));
    expect(collected.rows).toHaveLength(1);
    await expect(
      collectStandings(config, 'key', async () => response([[row], [{ ...row, points: 0 }]])),
    ).rejects.toThrow('conflicting-standing-groups');
    await expect(
      collectStandings(config, 'key', async () => response([[row]], 2025)),
    ).rejects.toThrow('wrong-provider-season');
  });
});
