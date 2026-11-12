import type {
  LeagueBigMatch,
  LeagueNewsItem,
  LeagueNewsMatch,
  LeagueNewsPlayer,
  LeagueNewsResponse,
  LeagueNewsTeam,
} from '@offside/contracts';
import type { MatchDetail } from '../db/repos/ownerTeams.js';
import type { LeagueMatchRow } from './leagueRead.js';
import type { LeagueNewsPlan } from './leagueNewsSelection.js';

type Person = { name: string | null; pos: string; number: number | null };

/** Project only selected references; this layer cannot fetch more match details. */
export function projectLeagueNews(
  season: number,
  round: number,
  plan: LeagueNewsPlan,
  team: (id: string) => LeagueNewsTeam,
  people: ReadonlyMap<string, Person>,
  details: ReadonlyMap<string, MatchDetail | null>,
): LeagueNewsResponse {
  const next = plan.next;
  const bigMatch: LeagueBigMatch | null = next
    ? {
        id: next.m.id,
        tier: next.m.tier,
        league: next.m.leagueNo,
        round: next.m.round,
        at: next.m.at,
        home: team(next.m.homeTeamId),
        away: team(next.m.awayTeamId),
        homeRank: next.h.rank,
        awayRank: next.a.rank,
      }
    : null;
  if (round === 0) return { season, round, items: [], bigMatch, lastBig: null };

  const player = (id: string | null | undefined): LeagueNewsPlayer => {
    const c = id ? people.get(id) : undefined;
    return c
      ? { name: c.name, pos: c.pos as NonNullable<LeagueNewsPlayer>['pos'], number: c.number }
      : null;
  };
  const newsMatch = (m: LeagueMatchRow): LeagueNewsMatch => {
    const d = details.get(m.id);
    const home = team(m.homeTeamId);
    const away = team(m.awayTeamId);
    return {
      id: m.id,
      tier: m.tier,
      league: m.leagueNo,
      round: m.round,
      // Prefer match-time OVR to the current team.
      home: d ? { ...home, ovr: d.home.ovr } : home,
      away: d ? { ...away, ovr: d.away.ovr } : away,
      homeGoals: m.homeGoals ?? 0,
      awayGoals: m.awayGoals ?? 0,
      ...(d?.home.xg !== undefined && d.away.xg !== undefined
        ? { homeXg: d.home.xg, awayXg: d.away.xg }
        : {}),
    };
  };
  const {
    upset,
    leader,
    derby,
    comeback,
    late,
    trick,
    goalfest,
    firstWin,
    streak,
    top,
    lastBigPick,
  } = plan;
  const items: LeagueNewsItem[] = [];
  if (upset) {
    const m = newsMatch(upset.match);
    const gap = m.homeGoals > m.awayGoals ? m.away.ovr - m.home.ovr : m.home.ovr - m.away.ovr;
    items.push({ kind: 'upset', match: m, gap: Math.max(gap, upset.gap) });
  }
  if (leader)
    items.push({
      kind: 'leader',
      tier: leader.tier,
      league: leader.league,
      team: team(leader.teamId),
      points: leader.points,
      changed: leader.changed,
    });
  if (derby)
    items.push({
      kind: 'derby',
      match: newsMatch(derby.match),
      homeRank: derby.homeRank,
      awayRank: derby.awayRank,
    });
  if (comeback)
    items.push({
      kind: 'comeback',
      match: newsMatch(comeback.match),
      side: comeback.side,
      trailed: comeback.trailed,
    });
  if (late)
    items.push({
      kind: 'lateWinner',
      match: newsMatch(late.match),
      side: late.side,
      minute: late.minute,
      scorer: player(late.careerId),
    });
  if (trick)
    items.push({
      kind: 'hattrick',
      match: newsMatch(trick.m),
      side: trick.side,
      goals: trick.n,
      scorer: player(trick.careerId),
    });
  if (goalfest) items.push({ kind: 'goalfest', match: newsMatch(goalfest) });
  if (firstWin)
    items.push({
      kind: 'firstWin',
      match: newsMatch(firstWin.match),
      side: firstWin.side,
      before: firstWin.before,
    });
  if (streak)
    items.push({
      kind: 'streak',
      tier: streak.tier,
      league: streak.league,
      team: team(streak.teamId),
      n: streak.n,
    });
  if (top) items.push({ kind: 'teamOfRound', match: newsMatch(top.match), side: top.side });
  return {
    season,
    round,
    items,
    bigMatch,
    lastBig:
      lastBigPick && lastBigPick.m.playedAt && !lastBigPick.m.forfeit
        ? newsMatch(lastBigPick.m)
        : null,
  };
}
