// League queries and table projection. This layer does not import cron lifecycle or news generation.
import { CUP_LOCK_MIN } from '@offside/contracts/cup';
import { LEAGUE_FORFEIT_GOALS } from '@offside/contracts/league';
import { and, asc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { cards, careers, leagueEntries, leagueMatches, leagueState } from '../db/schema.js';
import { cardPublicName } from '../db/cardName.js';
import { groupStandings } from './cupRules.js';

export type LeagueEntryRow = typeof leagueEntries.$inferSelect;
/** 목록용 경기 행. 득점 기록(detail_json)은 경기 상세에서만 따로 읽는다. */
export type LeagueMatchRow = Omit<typeof leagueMatches.$inferSelect, 'detailJson'>;
export type LeagueStateRow = typeof leagueState.$inferSelect;
export type LeagueTier = { tier: number; leagues: number; teams: number };

export const MATCH_COLS = Object.fromEntries(
  Object.entries(getTableColumns(leagueMatches)).filter(([k]) => k !== 'detailJson'),
) as Omit<ReturnType<typeof getTableColumns<typeof leagueMatches>>, 'detailJson'>;

export const leagueStateOf = (db: Db, season: number) =>
  db.select().from(leagueState).where(eq(leagueState.season, season)).limit(1);

export const leagueEntriesOf = (db: Db, season: number) =>
  db.select().from(leagueEntries).where(eq(leagueEntries.season, season));

/** 리그 하나의 경기(순위표 · 일정). */
export const leagueMatchesOf = (db: Db, season: number, tier: number, leagueNo: number) =>
  db
    .select(MATCH_COLS)
    .from(leagueMatches)
    .where(
      and(
        eq(leagueMatches.season, season),
        eq(leagueMatches.tier, tier),
        eq(leagueMatches.leagueNo, leagueNo),
      ),
    )
    .orderBy(asc(leagueMatches.round), asc(leagueMatches.slot));

export const tiersOf = (state: LeagueStateRow): LeagueTier[] =>
  JSON.parse(state.tiersJson) as LeagueTier[];

/** 리그에서 뛰는 신청(배치됨 · 기권 처리). */
export const inLeague = (e: LeagueEntryRow) =>
  (e.status === 'active' || e.status === 'forfeited') && e.tier !== null && e.teamId !== null;

/** 끝난 라운드 수(모든 경기를 치른 앞쪽 라운드 수)와 일정에 남은 마지막 라운드. 경기가 없으면 둘 다 0. */
export async function leagueProgress(db: Db, season: number) {
  const row = await db.$client
    .prepare(
      `SELECT MIN(CASE WHEN played_at IS NULL THEN round END) AS open, MAX(round) AS last, COUNT(*) AS n
       FROM league_matches WHERE season = ?`,
    )
    .bind(season)
    .first<{ open: number | null; last: number | null; n: number }>();
  if (!row?.n) return { played: 0, last: 0 };
  const last = row.last ?? 0;
  return { played: row.open === null ? last : row.open - 1, last };
}

/** 끝난 라운드 수. */
export const playedRounds = async (db: Db, season: number) =>
  (await leagueProgress(db, season)).played;

/**
 * 리그 순위표. 컵 조 순위와 같은 규칙(승점 → 득실 → 다득점 → 두 팀만 같으면 승자승 → 추첨 시드). 기권 경기는 나오지 못한
 * 쪽이 0:3 패, 둘 다 못 나왔으면 둘 다 0:3 패다.
 */
export function leagueTable(
  entries: readonly LeagueEntryRow[],
  matches: readonly LeagueMatchRow[],
  seed: string,
  tier: number,
  leagueNo: number,
) {
  const members = entries.filter((e) => inLeague(e) && e.tier === tier && e.leagueNo === leagueNo);
  const played = matches
    .filter((m) => m.tier === tier && m.leagueNo === leagueNo && m.playedAt)
    .map((m) =>
      m.forfeit === 3
        ? // 둘 다 기권: 서로 3골씩 내준 것으로(득점 없이 패).
          {
            home: m.homeTeamId,
            away: m.awayTeamId,
            homeGoals: LEAGUE_FORFEIT_GOALS,
            awayGoals: LEAGUE_FORFEIT_GOALS,
            bothLost: true,
          }
        : {
            home: m.homeTeamId,
            away: m.awayTeamId,
            homeGoals: m.homeGoals ?? 0,
            awayGoals: m.awayGoals ?? 0,
          },
    );
  const forfeits = new Map(members.map((e) => [e.teamId!, e.forfeits]));
  return groupStandings(
    members.map((e) => e.teamId!),
    played,
    `${seed}:${tier}:${leagueNo}`,
  ).map((s) => ({ ...s, forfeits: forfeits.get(s.teamId) ?? 0 }));
}

/** 득점 순위에 싣는 줄 수 상한(같은 골 수는 같이 싣되 이만큼까지). */
export const LEAGUE_SCORERS_MAX = 5;
/** 득점 순위에 싣는 순위(3위까지, 같은 골 수는 함께). */
const LEAGUE_SCORERS_TOP = 3;

/**
 * T-11-418d 리그 하나의 득점 순위(유스 선수 빼고). 경기 기록(detail_json)의 골을 SQL에서 세어 작은 결과만 읽는다. 3위와 골
 * 수가 같은 선수까지 싣고, LEAGUE_SCORERS_MAX줄에서 자른다. 이름은 공개 이름(비공개면 null) · 포지션 · 등번호.
 */
export async function leagueScorers(db: Db, season: number, tier: number, leagueNo: number) {
  const { results } = await db.$client
    .prepare(
      `SELECT json_extract(e.value, '$.scorer.careerId') AS careerId,
         CASE json_extract(e.value, '$.side') WHEN 'home' THEN m.home_team_id ELSE m.away_team_id END AS teamId,
         COUNT(*) AS goals
       FROM league_matches m, json_each(m.detail_json, '$.events') e
       WHERE m.season = ? AND m.tier = ? AND m.league_no = ? AND m.detail_json IS NOT NULL
         AND json_extract(e.value, '$.scorer.careerId') IS NOT NULL
       GROUP BY careerId, teamId ORDER BY goals DESC, careerId LIMIT ?`,
    )
    .bind(season, tier, leagueNo, LEAGUE_SCORERS_MAX + 1)
    .all<{ careerId: string; teamId: string; goals: number }>();
  const cut = results[LEAGUE_SCORERS_TOP - 1]?.goals ?? 0;
  const top = results.filter((r) => r.goals >= cut).slice(0, LEAGUE_SCORERS_MAX);
  if (!top.length) return [];
  const who = new Map(
    (
      await db
        .select({
          id: cards.careerId,
          publicName: cardPublicName,
          pos: cards.pos,
          number: sql<number | null>`coalesce(${careers.shirtNumber}, ${cards.number})`,
        })
        .from(cards)
        .leftJoin(careers, eq(careers.id, cards.careerId))
        .where(
          inArray(
            cards.careerId,
            top.map((r) => r.careerId),
          ),
        )
    ).map((c) => [c.id, c]),
  );
  return top.flatMap((r) => {
    const c = who.get(r.careerId);
    // 지워진 카드는 빼고 싣는다.
    return c
      ? [{ name: c.publicName, pos: c.pos, number: c.number, teamId: r.teamId, goals: r.goals }]
      : [];
  });
}

/** T-11-418d 마지막 라운드 동시 중계용 골 시각(경기 id별, 분 순). 기권 경기는 기록이 없어 빠진다. */
export async function leagueFinalGoals(db: Db, season: number, tier: number, leagueNo: number) {
  const { results } = await db.$client
    .prepare(
      `SELECT m.id AS id, json_extract(e.value, '$.minute') AS minute, json_extract(e.value, '$.side') AS side
       FROM league_matches m, json_each(m.detail_json, '$.events') e
       WHERE m.season = ?1 AND m.tier = ?2 AND m.league_no = ?3 AND m.detail_json IS NOT NULL
         AND m.round = (SELECT MAX(round) FROM league_matches WHERE season = ?1 AND tier = ?2 AND league_no = ?3)`,
    )
    .bind(season, tier, leagueNo)
    .all<{ id: string; minute: number; side: 'home' | 'away' }>();
  const out = new Map<string, { minute: number; side: 'home' | 'away' }[]>();
  for (const r of results)
    out.set(r.id, [...(out.get(r.id) ?? []), { minute: r.minute, side: r.side }]);
  for (const g of out.values()) g.sort((a, b) => a.minute - b.minute);
  return out;
}

/** 명단이 잠겨 있는가: 아직 안 끝난 내 리그 경기 중 잠금 시각(경기 1시간 전)이 지난 것이 있다. */
export async function leagueLineupLocked(db: Db, profileId: string, season: number, now: string) {
  const row = await db.$client
    .prepare(
      `SELECT 1 AS hit FROM league_entries e JOIN league_matches m
         ON m.season = e.season AND (m.home_team_id = e.team_id OR m.away_team_id = e.team_id)
       JOIN owner_teams t ON t.id = e.team_id
       WHERE t.season = ? AND e.profile_id = ? AND e.status = 'active' AND e.team_id IS NOT NULL
         AND m.played_at IS NULL AND m.at <= ? LIMIT 1`,
    )
    // 컵과 같은 잠금(lockAt(at) <= now ⇔ at <= now + 잠금 시간).
    .bind(season, profileId, new Date(Date.parse(now) + CUP_LOCK_MIN * 60_000).toISOString())
    .first<{ hit: number }>();
  return !!row;
}
