import type { LeagueNewsItem, LeagueNewsResponse, LeagueNewsTeam } from '@offside/contracts';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import { logoOf, type MatchDetail } from '../db/repos/ownerTeams.js';
import { cardPublicName } from '../db/cardName.js';
import { cards, careers, leagueEntries, leagueMatches, ownerTeams } from '../db/schema.js';
import { inLeague, leagueEntriesOf, leagueStateOf } from './league.js';

// T-11-652 오프사이드 데일리(라운드 신문). 끝난 라운드 하나의 기사 재료를 고른다: 이변 · 골 잔치 · 더비 · 역전승 · 극장골 ·
// 해트트릭 · 시즌 첫 승 · 이 라운드의 팀 · 1부 선두 · 연승, 그리고 이 라운드 빅매치 결과와 다음 라운드 빅매치. 끝난 라운드는 바뀌지 않아 라우트가 엣지에 오래 둔다.
// 문장은 화면이 만든다(app-core leagueNews) — 서버는 언어와 상관없는 숫자 · 이름만 보낸다.

import { planLeagueNews, type LeagueNewsGoal } from './leagueNewsSelection.js';
import { projectLeagueNews } from './leagueNewsProjection.js';
export {
  NEWS_UPSET_GAP,
  NEWS_GOALFEST_GOALS,
  NEWS_DERBY_POINTS,
  NEWS_LATE_MINUTE,
  NEWS_FIRST_WIN_AFTER,
  NEWS_STREAK_MIN,
} from './leagueNewsSelection.js';
type TeamRow = { id: string; name: string; manager: string; ovr: number; logoJson: string | null };

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

  // 골 기록(분 · 넣은 쪽 · 득점자)은 SQL에서 이 라운드 경기의 골만 꺼낸다(경기 기록 전체를 읽지 않는다).
  const { results: goalRows } =
    round === 0
      ? { results: [] as LeagueNewsGoal[] }
      : await db.$client
          .prepare(
            `SELECT m.id AS id, json_extract(e.value, '$.minute') AS minute, json_extract(e.value, '$.side') AS side,
         json_extract(e.value, '$.scorer.careerId') AS careerId
       FROM league_matches m, json_each(m.detail_json, '$.events') e
       WHERE m.season = ? AND m.round = ? AND m.detail_json IS NOT NULL AND m.forfeit = 0`,
          )
          .bind(season, round)
          .all<LeagueNewsGoal>();
  const plan = planLeagueNews(
    entries,
    matches,
    state.seed,
    round,
    goalRows,
    (id) => live.get(id)?.ovr ?? byTeam.get(id)?.ovr ?? 0,
  );
  // 기사에 실을 선수(해트트릭 · 극장골)의 공개 이름 · 포지션 · 등번호.
  const { playerIds, picked } = plan;
  const people = new Map(
    playerIds.length
      ? (
          await db
            .select({
              id: cards.careerId,
              name: cardPublicName,
              pos: cards.pos,
              number: sql<number | null>`coalesce(${careers.shirtNumber}, ${cards.number})`,
            })
            .from(cards)
            .leftJoin(careers, eq(careers.id, cards.careerId))
            .where(inArray(cards.careerId, playerIds))
        ).map((c) => [c.id, c] as const)
      : [],
  );
  // Only the selected matches need full detail JSON.
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
  return projectLeagueNews(season, round, plan, team, people, details);
}

/** 푸시 1면으로 고르는 순서(앞일수록 먼저). 선두 기사는 거의 매번 있어 맨 뒤다. */
const PUSH_ORDER: LeagueNewsItem['kind'][] = [
  'upset',
  'comeback',
  'lateWinner',
  'hattrick',
  'derby',
  'goalfest',
  'firstWin',
  'streak',
  'teamOfRound',
  'leader',
];

/** 기사 하나의 주인공 팀(이긴 팀 · 선두 · 연승 팀 · 무승부면 홈). */
function heroOf(item: LeagueNewsItem): LeagueNewsTeam {
  if (item.kind === 'leader' || item.kind === 'streak') return item.team;
  const m = item.match;
  if ('side' in item) return item.side === 'home' ? m.home : m.away;
  return m.homeGoals >= m.awayGoals ? m.home : m.away;
}
const teamsOf = (item: LeagueNewsItem) =>
  item.kind === 'leader' || item.kind === 'streak'
    ? [item.team.teamId]
    : [item.match.home.teamId, item.match.away.teamId];

/** 한 줄 헤드라인(한국어, 알림함에 저장되고 요청 언어로 옮겨진다). */
export function newsHeadKo(item: LeagueNewsItem): string {
  const team = heroOf(item).name;
  switch (item.kind) {
    case 'upset':
      return cupKo('dailyUpset', { team, gap: item.gap });
    case 'comeback':
      return cupKo('dailyComeback', { team, n: item.trailed });
    case 'lateWinner':
      return cupKo('dailyLate', { team, n: item.minute });
    case 'hattrick':
      return cupKo('dailyHattrick', { team });
    case 'derby':
      return cupKo(
        item.match.homeGoals === item.match.awayGoals ? 'dailyDerbyDraw' : 'dailyDerby',
        {
          team,
        },
      );
    case 'goalfest':
      return cupKo('dailyGoalfest', { team, n: item.match.homeGoals + item.match.awayGoals });
    case 'firstWin':
      return cupKo('dailyFirstWin', { team, n: item.before + 1 });
    case 'streak':
      return cupKo('dailyStreak', { team, n: item.n });
    case 'teamOfRound':
      return cupKo('dailyRout', {
        team,
        n: Math.abs(item.match.homeGoals - item.match.awayGoals),
      });
    case 'leader':
      return cupKo(item.changed ? 'dailyLeaderNew' : 'dailyLeaderKeep', { team, n: item.tier });
  }
}

/**
 * 라운드 결과 알림에 붙일 신문 1면. 내 팀이 실린 기사가 있으면 그 기사(mine), 없으면 순서대로 첫 기사. 기사가 없으면 null.
 */
const byPushOrder = (news: LeagueNewsResponse) =>
  [...news.items].sort((a, b) => PUSH_ORDER.indexOf(a.kind) - PUSH_ORDER.indexOf(b.kind));

/** 신문 1면 기사(푸시 순서의 첫 기사). T-11-658 AI 기자가 이 기사를 다시 쓴다. */
export const frontItem = (news: LeagueNewsResponse): LeagueNewsItem | undefined =>
  byPushOrder(news)[0];

export function pushHeadline(news: LeagueNewsResponse, teamId: string | null) {
  const sorted = byPushOrder(news);
  const mine = teamId ? sorted.find((x) => teamsOf(x).includes(teamId)) : undefined;
  const item = mine ?? sorted[0];
  return item ? { mine: !!mine, head: newsHeadKo(item) } : null;
}
