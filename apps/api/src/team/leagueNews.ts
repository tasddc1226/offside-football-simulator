import type {
  LeagueBigMatch,
  LeagueNewsItem,
  LeagueNewsMatch,
  LeagueNewsResponse,
  LeagueNewsTeam,
} from '@offside/contracts';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { logoOf, type MatchDetail } from '../db/repos/ownerTeams.js';
import { leagueEntries, leagueMatches, ownerTeams } from '../db/schema.js';
import {
  inLeague,
  leagueEntriesOf,
  leagueStateOf,
  leagueTable,
  type LeagueEntryRow,
  type LeagueMatchRow,
} from './league.js';

// T-11-652 오프사이드 데일리(라운드 신문). 끝난 라운드 하나의 기사 재료를 고른다: 이변 · 골 잔치 · 더비 · 이 라운드의 팀 · 1부
// 선두 · 연승, 그리고 이 라운드 빅매치 결과와 다음 라운드 빅매치. 끝난 라운드는 바뀌지 않아 라우트가 엣지에 오래 둔다.
// 문장은 화면이 만든다(app-core leagueNews) — 서버는 언어와 상관없는 숫자 · 이름만 보낸다.

/** 이변으로 싣는 최소 OVR 차. */
export const NEWS_UPSET_GAP = 3;
/** 골 잔치로 싣는 최소 골 수(두 팀 합). */
export const NEWS_GOALFEST_GOALS = 5;
/** 더비: 라운드 전 순위가 붙어 있고 승점 차가 이 안. */
export const NEWS_DERBY_POINTS = 3;
/** 연승 기사로 싣는 최소 연승. */
export const NEWS_STREAK_MIN = 3;

type Standing = ReturnType<typeof leagueTable>[number];
type TeamRow = { id: string; name: string; manager: string; ovr: number; logoJson: string | null };

const keyOf = (tier: number, league: number) => `${tier}:${league}`;

const matchCols = {
  id: leagueMatches.id,
  season: leagueMatches.season,
  tier: leagueMatches.tier,
  leagueNo: leagueMatches.leagueNo,
  round: leagueMatches.round,
  slot: leagueMatches.slot,
  homeTeamId: leagueMatches.homeTeamId,
  awayTeamId: leagueMatches.awayTeamId,
  at: leagueMatches.at,
  playedAt: leagueMatches.playedAt,
  homeGoals: leagueMatches.homeGoals,
  awayGoals: leagueMatches.awayGoals,
  forfeit: leagueMatches.forfeit,
};

/** 리그마다 순위표(그 라운드까지 친 경기). */
function tablesUpTo(
  entries: readonly LeagueEntryRow[],
  matches: readonly LeagueMatchRow[],
  seed: string,
  leagues: readonly { tier: number; league: number }[],
  round: number,
) {
  const upTo = matches.filter((m) => m.round <= round);
  return new Map(
    leagues.map((l) => [
      keyOf(l.tier, l.league),
      new Map(
        leagueTable(entries, upTo, seed, l.tier, l.league).map((s) => [s.teamId, s] as const),
      ),
    ]),
  );
}

/** 빅매치: 가장 높은 부의 첫 리그에서 순위 합이 가장 작은 경기(같으면 승점 차가 작은 쪽, 다음은 경기 순서). */
function pickBig(
  matches: readonly LeagueMatchRow[],
  round: number,
  tables: Map<string, Map<string, Standing>>,
) {
  const inRound = matches.filter((m) => m.round === round);
  const top = Math.min(...inRound.map((m) => m.tier));
  const pool = inRound.filter((m) => m.tier === top && m.leagueNo === 1);
  let best: { m: LeagueMatchRow; h: Standing; a: Standing } | null = null;
  for (const m of pool) {
    const t = tables.get(keyOf(m.tier, m.leagueNo));
    const h = t?.get(m.homeTeamId);
    const a = t?.get(m.awayTeamId);
    if (!h || !a) continue;
    if (!best) {
      best = { m, h, a };
      continue;
    }
    const sum = h.rank + a.rank;
    const bestSum = best.h.rank + best.a.rank;
    const gap = Math.abs(h.pts - a.pts);
    const bestGap = Math.abs(best.h.pts - best.a.pts);
    if (sum < bestSum || (sum === bestSum && gap < bestGap)) best = { m, h, a };
  }
  return best;
}

/** 팀의 지금 연승(마지막 경기부터 거꾸로). 기권은 나오지 못한 쪽의 패다. */
function winStreak(teamId: string, played: readonly LeagueMatchRow[]) {
  let n = 0;
  for (const m of played) {
    if (m.homeTeamId !== teamId && m.awayTeamId !== teamId) continue;
    const home = m.homeTeamId === teamId;
    const won = m.forfeit
      ? m.forfeit === (home ? 2 : 1)
      : home
        ? (m.homeGoals ?? 0) > (m.awayGoals ?? 0)
        : (m.awayGoals ?? 0) > (m.homeGoals ?? 0);
    if (!won) break;
    n++;
  }
  return n;
}

/** 그 라운드가 끝난 뒤의 신문. 리그가 없거나 그 라운드가 아직 끝나지 않았으면 null. */
export async function buildLeagueNews(
  db: Db,
  season: number,
  round: number,
): Promise<LeagueNewsResponse | null> {
  const [[state], entryRows, matches] = await Promise.all([
    leagueStateOf(db, season),
    leagueEntriesOf(db, season),
    db
      .select(matchCols)
      .from(leagueMatches)
      .where(and(eq(leagueMatches.season, season), lte(leagueMatches.round, round + 1)))
      .orderBy(leagueMatches.round, leagueMatches.slot),
  ]);
  if (!state) return null;
  const thisRound = matches.filter((m) => m.round === round);
  if (round > 0 && (!thisRound.length || thisRound.some((m) => !m.playedAt))) return null;
  const entries = entryRows.filter(inLeague);
  const leagues = [
    ...new Map(
      entries.map((e) => [keyOf(e.tier!, e.leagueNo!), { tier: e.tier!, league: e.leagueNo! }]),
    ).values(),
  ];
  // 팀 이름 · 로고 · OVR은 지금 팀 기준(없어졌으면 배치 때 값). 팀 수가 바인드 상한을 넘어 신청 행으로 이어 읽는다.
  const live = new Map<string, TeamRow>(
    (
      await db
        .select({
          id: ownerTeams.id,
          name: ownerTeams.name,
          manager: ownerTeams.manager,
          ovr: ownerTeams.ovr,
          logoJson: ownerTeams.logoJson,
        })
        .from(ownerTeams)
        .where(
          inArray(
            ownerTeams.id,
            db
              .select({ id: sql<string>`${leagueEntries.teamId}` })
              .from(leagueEntries)
              .where(eq(leagueEntries.season, season)),
          ),
        )
    ).map((t) => [t.id, t]),
  );
  const byTeam = new Map(entries.map((e) => [e.teamId!, e]));
  const team = (id: string): LeagueNewsTeam => {
    const t = live.get(id);
    const e = byTeam.get(id);
    return {
      teamId: id,
      name: t?.name ?? e?.name ?? '-',
      owner: t?.manager ?? e?.manager ?? '-',
      logo: t ? logoOf(t) : null,
      ovr: t?.ovr ?? e?.ovr ?? 0,
    };
  };

  const pre = tablesUpTo(entries, matches, state.seed, leagues, round - 1);
  const post = tablesUpTo(entries, matches, state.seed, leagues, round);
  const next = pickBig(matches, round + 1, post);
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

  const games = thisRound.filter((m) => m.playedAt && !m.forfeit);
  const ovrOf = (id: string) => live.get(id)?.ovr ?? byTeam.get(id)?.ovr ?? 0;
  const goals = (m: LeagueMatchRow) => (m.homeGoals ?? 0) + (m.awayGoals ?? 0);
  const margin = (m: LeagueMatchRow) => Math.abs((m.homeGoals ?? 0) - (m.awayGoals ?? 0));
  const winnerSide = (m: LeagueMatchRow) =>
    (m.homeGoals ?? 0) > (m.awayGoals ?? 0)
      ? 'home'
      : (m.homeGoals ?? 0) < (m.awayGoals ?? 0)
        ? 'away'
        : null;
  const used = new Set<string>();
  const best = <T>(list: readonly T[], better: (a: T, b: T) => boolean) =>
    list.reduce<T | null>((b, x) => (b === null || better(x, b) ? x : b), null);

  // 이변: 진 팀 OVR - 이긴 팀 OVR이 가장 큰 경기.
  const gapOf = (m: LeagueMatchRow) => {
    const w = winnerSide(m);
    if (!w) return 0;
    const [win, lose] = w === 'home' ? [m.homeTeamId, m.awayTeamId] : [m.awayTeamId, m.homeTeamId];
    return ovrOf(lose) - ovrOf(win);
  };
  const upset = best(
    games.filter((m) => gapOf(m) >= NEWS_UPSET_GAP),
    (a, b) => gapOf(a) > gapOf(b) || (gapOf(a) === gapOf(b) && a.tier < b.tier),
  );
  if (upset) used.add(upset.id);
  const goalfest = best(
    games.filter((m) => goals(m) >= NEWS_GOALFEST_GOALS && !used.has(m.id)),
    (a, b) => goals(a) > goals(b) || (goals(a) === goals(b) && a.tier < b.tier),
  );
  if (goalfest) used.add(goalfest.id);
  const ranksOf = (m: LeagueMatchRow) => {
    const t = pre.get(keyOf(m.tier, m.leagueNo));
    return [t?.get(m.homeTeamId), t?.get(m.awayTeamId)] as const;
  };
  const derby =
    round > 1
      ? best(
          games.filter((m) => {
            const [h, a] = ranksOf(m);
            return (
              !used.has(m.id) &&
              !!h &&
              !!a &&
              Math.abs(h.rank - a.rank) === 1 &&
              Math.abs(h.pts - a.pts) <= NEWS_DERBY_POINTS
            );
          }),
          (a, b) => {
            const [ah, aa] = ranksOf(a);
            const [bh, ba] = ranksOf(b);
            return (
              a.tier < b.tier || (a.tier === b.tier && ah!.rank + aa!.rank < bh!.rank + ba!.rank)
            );
          },
        )
      : null;
  if (derby) used.add(derby.id);
  // 이 라운드의 팀: 가장 크게 이긴 팀(같으면 높은 부, 다음은 OVR이 낮은 팀).
  const winnerOvr = (m: LeagueMatchRow) =>
    ovrOf(winnerSide(m) === 'home' ? m.homeTeamId : m.awayTeamId);
  const top = best(
    games.filter((m) => winnerSide(m)),
    (a, b) =>
      margin(a) > margin(b) ||
      (margin(a) === margin(b) &&
        (a.tier < b.tier || (a.tier === b.tier && winnerOvr(a) < winnerOvr(b)))),
  );

  // 기대 득점 · 경기 때 OVR은 고른 경기만 읽는다(많아야 다섯 경기).
  const lastBigPick = pickBig(matches, round, pre);
  const picked = [upset, goalfest, derby, top, lastBigPick?.m].filter(
    (m): m is LeagueMatchRow => !!m,
  );
  const details = new Map(
    picked.length
      ? (
          await db
            .select({ id: leagueMatches.id, detailJson: leagueMatches.detailJson })
            .from(leagueMatches)
            .where(
              inArray(
                leagueMatches.id,
                picked.map((m) => m.id),
              ),
            )
        ).map((r) => [r.id, r.detailJson ? (JSON.parse(r.detailJson) as MatchDetail) : null])
      : [],
  );
  const newsMatch = (m: LeagueMatchRow): LeagueNewsMatch => {
    const d = details.get(m.id);
    const home = team(m.homeTeamId);
    const away = team(m.awayTeamId);
    return {
      id: m.id,
      tier: m.tier,
      league: m.leagueNo,
      round: m.round,
      // 그 경기 때 OVR(기록이 없으면 지금 팀).
      home: d ? { ...home, ovr: d.home.ovr } : home,
      away: d ? { ...away, ovr: d.away.ovr } : away,
      homeGoals: m.homeGoals ?? 0,
      awayGoals: m.awayGoals ?? 0,
      ...(d?.home.xg !== undefined && d.away.xg !== undefined
        ? { homeXg: d.home.xg, awayXg: d.away.xg }
        : {}),
    };
  };

  const items: LeagueNewsItem[] = [];
  if (upset) {
    const m = newsMatch(upset);
    const w = winnerSide(upset)!;
    const gap = w === 'home' ? m.away.ovr - m.home.ovr : m.home.ovr - m.away.ovr;
    items.push({ kind: 'upset', match: m, gap: Math.max(gap, gapOf(upset)) });
  }
  const leaderKey = leagues.length ? keyOf(Math.min(...leagues.map((l) => l.tier)), 1) : null;
  const leaderNow = leaderKey
    ? [...(post.get(leaderKey)?.values() ?? [])].find((s) => s.rank === 1)
    : undefined;
  if (leaderKey && leaderNow) {
    const before = [...(pre.get(leaderKey)?.values() ?? [])].find((s) => s.rank === 1);
    const [tier, league] = leaderKey.split(':').map(Number) as [number, number];
    items.push({
      kind: 'leader',
      tier,
      league,
      team: team(leaderNow.teamId),
      points: leaderNow.pts,
      changed: round > 1 && before?.teamId !== leaderNow.teamId,
    });
  }
  if (derby) {
    const [h, a] = ranksOf(derby);
    items.push({ kind: 'derby', match: newsMatch(derby), homeRank: h!.rank, awayRank: a!.rank });
  }
  if (goalfest) items.push({ kind: 'goalfest', match: newsMatch(goalfest) });
  // 연승: 지금 이어지는 가장 긴 연승(같으면 높은 부).
  const playedDesc = matches
    .filter((m) => m.round <= round && m.playedAt)
    .sort((a, b) => b.round - a.round);
  const streak = best(
    entries
      .map((e) => ({ e, n: winStreak(e.teamId!, playedDesc) }))
      .filter((x) => x.n >= NEWS_STREAK_MIN),
    (a, b) => a.n > b.n || (a.n === b.n && a.e.tier! < b.e.tier!),
  );
  if (streak)
    items.push({
      kind: 'streak',
      tier: streak.e.tier!,
      league: streak.e.leagueNo!,
      team: team(streak.e.teamId!),
      n: streak.n,
    });
  if (top) items.push({ kind: 'teamOfRound', match: newsMatch(top), side: winnerSide(top)! });

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
