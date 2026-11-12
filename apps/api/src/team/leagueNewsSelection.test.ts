import { describe, expect, it } from 'vitest';
import type { LeagueEntryRow, LeagueMatchRow } from './leagueRead.js';
import { planLeagueNews, type LeagueNewsGoal } from './leagueNewsSelection.js';
import { projectLeagueNews } from './leagueNewsProjection.js';
import type { MatchDetail } from '../db/repos/ownerTeams.js';

const match = (id: string, h: number, a: number, round = 1): LeagueMatchRow => ({
  id,
  season: 2,
  tier: 1,
  leagueNo: 1,
  round,
  slot: 0,
  homeTeamId: `${id}-h`,
  awayTeamId: `${id}-a`,
  at: '2026-11-01T00:00:00.000Z',
  playedAt: '2026-11-01T00:00:00.000Z',
  homeGoals: h,
  awayGoals: a,
  forfeit: 0,
});
const goal = (
  id: string,
  minute: number,
  side: 'home' | 'away',
  careerId: string | null = null,
): LeagueNewsGoal => ({ id, minute, side, careerId });
const team = (id: string) => ({ teamId: id, name: id, owner: id, logo: null, ovr: 80 });

describe('league news editorial plan', () => {
  it('keeps stable score ties and excludes the upset from the goalfest, while team-of-round can repeat', () => {
    const a = match('first', 4, 3);
    const b = match('second', 4, 3);
    const c = { ...match('lower-tier', 4, 3), tier: 2 };
    const plan = planLeagueNews([], [a, b, c], 'seed', 1, [], (id) =>
      id.endsWith('-h') ? 70 : 80,
    );
    expect(plan.upset?.match.id).toBe(a.id);
    expect(plan.goalfest?.id).toBe(b.id);
    expect(plan.top?.match.id).toBe(a.id);
    expect(plan.picked.map((m) => m.id)).toEqual([a.id, b.id, a.id]);
    expect(plan.playerIds).toEqual([]);
  });

  it('sorts goals before choosing a comeback or late winner, keeps hattricks independent and loads only the chosen scorers', () => {
    const cb = match('comeback', 2, 1);
    const late = match('late', 1, 0);
    const trick = match('trick', 3, 1);
    const rows = [
      goal(cb.id, 80, 'home'),
      goal(cb.id, 10, 'away'),
      goal(cb.id, 50, 'home'),
      goal(late.id, 90, 'home', 'late-scorer'),
      goal(trick.id, 1, 'home', 'trick-scorer'),
      goal(trick.id, 20, 'home', 'trick-scorer'),
      goal(trick.id, 40, 'home', 'trick-scorer'),
      goal(trick.id, 70, 'away', 'unused-scorer'),
    ];
    const plan = planLeagueNews([], [cb, late, trick], 'seed', 1, rows, () => 80);
    expect(plan.comeback).toMatchObject({ match: { id: cb.id }, trailed: 1, side: 'home' });
    expect(plan.late).toMatchObject({
      match: { id: late.id },
      minute: 90,
      careerId: 'late-scorer',
    });
    expect(plan.trick).toMatchObject({ m: { id: trick.id }, n: 3, careerId: 'trick-scorer' });
    expect(plan.playerIds).toEqual(['trick-scorer', 'late-scorer']);
    const news = projectLeagueNews(
      2,
      1,
      plan,
      team,
      new Map([['trick-scorer', { name: null, pos: 'FW', number: 9 }]]),
      new Map(),
    );
    expect(news.items.map((x) => x.kind)).toEqual([
      'comeback',
      'lateWinner',
      'hattrick',
      'teamOfRound',
    ]);
    expect(news.items.find((x) => x.kind === 'lateWinner')).toMatchObject({ scorer: null });
    expect(news.items.find((x) => x.kind === 'hattrick')).toMatchObject({
      scorer: { name: null, pos: 'FW', number: 9 },
    });
    expect(rows[0]?.minute).toBe(80);
  });

  it('projects recorded OVR and both xG values without changing upset selection based on current OVR', () => {
    const m = match('upset', 1, 0);
    const plan = planLeagueNews([], [m], 'seed', 1, [], (id) => (id.endsWith('-h') ? 70 : 80));
    const details = new Map([
      [m.id, { home: { ovr: 60, xg: 0.7 }, away: { ovr: 85, xg: 2.1 } } as MatchDetail],
    ]);
    const news = projectLeagueNews(2, 1, plan, team, new Map(), details);
    expect(news.items[0]).toMatchObject({
      kind: 'upset',
      gap: 25,
      match: { home: { ovr: 60 }, away: { ovr: 85 }, homeXg: 0.7, awayXg: 2.1 },
    });
  });

  it('round zero projects only the upcoming big match and needs no detailed matches or players', () => {
    const next = { ...match('next', 0, 0), playedAt: null };
    const entries = [next.homeTeamId, next.awayTeamId].map(
      (teamId) =>
        ({ teamId, tier: 1, leagueNo: 1, status: 'active', forfeits: 0 }) as LeagueEntryRow,
    );
    const plan = planLeagueNews(entries, [next], 'seed', 0, [], () => 80);
    expect(plan.picked).toEqual([]);
    expect(plan.playerIds).toEqual([]);
    expect(projectLeagueNews(2, 0, plan, team, new Map(), new Map())).toMatchObject({
      items: [],
      lastBig: null,
      bigMatch: { id: next.id, round: 1 },
    });
  });
});
