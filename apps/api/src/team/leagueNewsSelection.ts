import { leagueTable, type LeagueEntryRow, type LeagueMatchRow } from './league.js';

/** 이변으로 싣는 최소 OVR 차. */
export const NEWS_UPSET_GAP = 3;
/** 골 잔치로 싣는 최소 골 수(두 팀 합). */
export const NEWS_GOALFEST_GOALS = 5;
/** 더비: 라운드 전 순위가 붙어 있고 승점 차가 이 안. */
export const NEWS_DERBY_POINTS = 3;
/** 극장골: 한 골 차 경기의 결승골이 이 분 뒤. */
export const NEWS_LATE_MINUTE = 85;
/** 시즌 첫 승 기사: 그 전에 이만큼 이기지 못했다. */
export const NEWS_FIRST_WIN_AFTER = 3;
/** 연승 기사로 싣는 최소 연승. */
export const NEWS_STREAK_MIN = 3;

type Standing = ReturnType<typeof leagueTable>[number];

const keyOf = (tier: number, league: number) => `${tier}:${league}`;

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

const best = <T>(list: readonly T[], better: (a: T, b: T) => boolean) =>
  list.reduce<T | null>((b, x) => (b === null || better(x, b) ? x : b), null);
const goals = (m: LeagueMatchRow) => (m.homeGoals ?? 0) + (m.awayGoals ?? 0);
const margin = (m: LeagueMatchRow) => Math.abs((m.homeGoals ?? 0) - (m.awayGoals ?? 0));
const winnerSide = (m: LeagueMatchRow): 'home' | 'away' | null =>
  (m.homeGoals ?? 0) > (m.awayGoals ?? 0)
    ? 'home'
    : (m.homeGoals ?? 0) < (m.awayGoals ?? 0)
      ? 'away'
      : null;
export type LeagueNewsGoal = {
  id: string;
  minute: number;
  side: 'home' | 'away';
  careerId: string | null;
};
type Tables = Map<string, Map<string, Standing>>;
type OvrOf = (id: string) => number;

function selectScoreStories(
  games: readonly LeagueMatchRow[],
  round: number,
  pre: Tables,
  ovrOf: OvrOf,
) {
  const used = new Set<string>();

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

  return { used, upset, goalfest, derby, gapOf, ranksOf };
}

function selectGoalStories(
  games: readonly LeagueMatchRow[],
  goalRows: LeagueNewsGoal[],
  used: Set<string>,
) {
  const goalsOf = new Map<string, typeof goalRows>();
  for (const g of goalRows) goalsOf.set(g.id, [...(goalsOf.get(g.id) ?? []), g]);
  for (const list of goalsOf.values()) list.sort((a, b) => a.minute - b.minute);
  const byId = new Map(games.map((m) => [m.id, m]));
  // 역전승: 이긴 쪽이 가장 크게 뒤졌던 골 수.
  const trailedOf = (m: LeagueMatchRow) => {
    const w = winnerSide(m);
    if (!w) return 0;
    let h = 0;
    let a = 0;
    let worst = 0;
    for (const g of goalsOf.get(m.id) ?? []) {
      if (g.side === 'home') h++;
      else a++;
      worst = Math.max(worst, w === 'home' ? a - h : h - a);
    }
    return worst;
  };
  const comeback = best(
    games.filter((m) => !used.has(m.id) && trailedOf(m) >= 1),
    (a, b) => trailedOf(a) > trailedOf(b) || (trailedOf(a) === trailedOf(b) && a.tier < b.tier),
  );
  if (comeback) used.add(comeback.id);
  // 극장골: 한 골 차 경기에서 이긴 쪽이 마지막으로 앞서 나간 골이 늦게.
  const deciderOf = (m: LeagueMatchRow) => {
    const w = winnerSide(m);
    if (!w || margin(m) !== 1) return null;
    let h = 0;
    let a = 0;
    let d: (typeof goalRows)[number] | null = null;
    for (const g of goalsOf.get(m.id) ?? []) {
      const tied = h === a;
      if (g.side === 'home') h++;
      else a++;
      if (tied && g.side === w) d = g;
    }
    return d && d.minute >= NEWS_LATE_MINUTE ? d : null;
  };
  const late = best(
    games.filter((m) => !used.has(m.id) && deciderOf(m)),
    (a, b) =>
      deciderOf(a)!.minute > deciderOf(b)!.minute ||
      (deciderOf(a)!.minute === deciderOf(b)!.minute && a.tier < b.tier),
  );
  if (late) used.add(late.id);
  // 해트트릭: 한 경기 3골 이상 넣은 선수(유스 빼고, 많은 골 · 높은 부 순).
  const tricks = [...goalsOf.entries()].flatMap(([id, list]) => {
    const m = byId.get(id);
    if (!m) return [];
    const by = new Map<string, { n: number; side: 'home' | 'away' }>();
    for (const g of list)
      if (g.careerId) by.set(g.careerId, { n: (by.get(g.careerId)?.n ?? 0) + 1, side: g.side });
    return [...by.entries()]
      .filter(([, x]) => x.n >= 3)
      .map(([careerId, x]) => ({ m, careerId, ...x }));
  });
  const trick = best(tricks, (a, b) => a.n > b.n || (a.n === b.n && a.m.tier < b.m.tier));
  return { comeback, late, trick, trailedOf, deciderOf };
}

function selectSeasonStories(
  matches: readonly LeagueMatchRow[],
  games: readonly LeagueMatchRow[],
  entries: readonly LeagueEntryRow[],
  round: number,
  used: Set<string>,
  ovrOf: OvrOf,
) {
  // 시즌 첫 승: 그 전에 NEWS_FIRST_WIN_AFTER경기 넘게 이기지 못한 팀이 이겼다.
  const winsBefore = (teamId: string) =>
    matches.filter(
      (x) =>
        x.round < round &&
        x.playedAt &&
        ((x.homeTeamId === teamId &&
          (x.forfeit === 2 || (!x.forfeit && (x.homeGoals ?? 0) > (x.awayGoals ?? 0)))) ||
          (x.awayTeamId === teamId &&
            (x.forfeit === 1 || (!x.forfeit && (x.awayGoals ?? 0) > (x.homeGoals ?? 0))))),
    ).length;
  const playedBefore = (teamId: string) =>
    matches.filter(
      (x) => x.round < round && x.playedAt && (x.homeTeamId === teamId || x.awayTeamId === teamId),
    ).length;
  const firstWinOf = (m: LeagueMatchRow) => {
    const w = winnerSide(m);
    if (!w) return 0;
    const id = w === 'home' ? m.homeTeamId : m.awayTeamId;
    const n = playedBefore(id);
    return n >= NEWS_FIRST_WIN_AFTER && winsBefore(id) === 0 ? n : 0;
  };
  const firstWin = best(
    games.filter((m) => !used.has(m.id) && firstWinOf(m) > 0),
    (a, b) => firstWinOf(a) > firstWinOf(b) || (firstWinOf(a) === firstWinOf(b) && a.tier < b.tier),
  );
  if (firstWin) used.add(firstWin.id);
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
  return { firstWin, firstWinOf, top, streak };
}

/** Select references before loading people or full match JSON. Array order is the editorial tie-break. */
export function planLeagueNews(
  entries: readonly LeagueEntryRow[],
  matches: readonly LeagueMatchRow[],
  seed: string,
  round: number,
  goalRows: LeagueNewsGoal[],
  ovrOf: OvrOf,
) {
  const leagues = [
    ...new Map(
      entries.map((e) => [keyOf(e.tier!, e.leagueNo!), { tier: e.tier!, league: e.leagueNo! }]),
    ).values(),
  ];
  const pre = tablesUpTo(entries, matches, seed, leagues, round - 1);
  const post = tablesUpTo(entries, matches, seed, leagues, round);
  const next = pickBig(matches, round + 1, post);
  const games = matches.filter((m) => m.round === round && m.playedAt && !m.forfeit);
  const { used, upset, goalfest, derby, gapOf, ranksOf } = selectScoreStories(
    games,
    round,
    pre,
    ovrOf,
  );
  const { comeback, late, trick, trailedOf, deciderOf } = selectGoalStories(games, goalRows, used);
  const { firstWin, firstWinOf, top, streak } = selectSeasonStories(
    matches,
    games,
    entries,
    round,
    used,
    ovrOf,
  );
  const leaderKey = leagues.length ? keyOf(Math.min(...leagues.map((l) => l.tier)), 1) : null;
  const leaderNow = leaderKey
    ? [...(post.get(leaderKey)?.values() ?? [])].find((s) => s.rank === 1)
    : undefined;
  let leader = null as {
    tier: number;
    league: number;
    teamId: string;
    points: number;
    changed: boolean;
  } | null;
  if (leaderKey && leaderNow) {
    const before = [...(pre.get(leaderKey)?.values() ?? [])].find((s) => s.rank === 1);
    const [tier, league] = leaderKey.split(':').map(Number) as [number, number];
    leader = {
      tier,
      league,
      teamId: leaderNow.teamId,
      points: leaderNow.pts,
      changed: round > 1 && before?.teamId !== leaderNow.teamId,
    };
  }
  const lastBigPick = pickBig(matches, round, pre);
  const picked = [
    upset,
    goalfest,
    derby,
    top,
    comeback,
    late,
    trick?.m,
    firstWin,
    lastBigPick?.m,
  ].filter((m): m is LeagueMatchRow => !!m);

  const playerIds = [trick?.careerId, late ? deciderOf(late)?.careerId : null].filter(
    (x): x is string => !!x,
  );
  return {
    next,
    lastBigPick,
    picked,
    playerIds,
    leader,
    goalfest,
    upset: upset ? { match: upset, gap: gapOf(upset) } : null,
    derby: derby
      ? { match: derby, homeRank: ranksOf(derby)[0]!.rank, awayRank: ranksOf(derby)[1]!.rank }
      : null,
    comeback: comeback
      ? { match: comeback, side: winnerSide(comeback)!, trailed: trailedOf(comeback) }
      : null,
    late: late
      ? {
          match: late,
          side: winnerSide(late)!,
          minute: deciderOf(late)!.minute,
          careerId: deciderOf(late)!.careerId,
        }
      : null,
    trick,
    firstWin: firstWin
      ? { match: firstWin, side: winnerSide(firstWin)!, before: firstWinOf(firstWin) }
      : null,
    streak: streak
      ? { tier: streak.e.tier!, league: streak.e.leagueNo!, teamId: streak.e.teamId!, n: streak.n }
      : null,
    top: top ? { match: top, side: winnerSide(top)! } : null,
  };
}
export type LeagueNewsPlan = ReturnType<typeof planLeagueNews>;
