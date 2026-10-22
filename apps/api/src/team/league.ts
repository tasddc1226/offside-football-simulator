import { CUP_LOCK_MIN } from '@offside/contracts/cup';
import {
  LEAGUE_FILL_PROMOTE_SCOUTS,
  LEAGUE_FORFEIT_GOALS,
  LEAGUE_FORFEIT_LIMIT,
  LEAGUE_ROUNDS,
  leagueFixtures,
  leagueNextTier,
  leagueOutcome,
  leaguePyramid,
  leagueReward,
  leagueSeedOrder,
  type LeagueDef,
  type LeagueOutcome,
} from '@offside/contracts/league';
import { leagueTitleIdOf, TITLE_STAGES } from '@offside/contracts/owner-title';
import { and, asc, eq, getTableColumns, inArray, isNull, lte } from 'drizzle-orm';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import {
  careers,
  leagueEntries,
  leagueMatches,
  leagueState,
  ownerTeams,
  profiles,
} from '../db/schema.js';
import { leagueHomeAdvOf } from '../db/repos/balance.js';
import { grantItemStatement } from '../db/repos/itemShop.js';
import { eventNotificationStatements } from '../push/events.js';
import { drawGroups, groupStandings, rngFrom } from './cupRules.js';
import { currentLeague } from './leagueSchedule.js';
import type { OwnerTeamRow } from '../db/repos/ownerTeams.js';
import { lineupsOf, matchDetailOf } from './match.js';
import { filledCount, simulateMatch } from './sim.js';

// T-11-418b 오프사이드 리그 진행(5분 cron). 컵(team/cup.ts)처럼 한 번에 한 단계만 하고 끝낸다 — 실패하면 다음 cron이
// 같은 단계를 다시 한다. 배치: league_state 기본키가 두 번 배치하지 않게 막는다. 경기: played_at IS NULL. 알림:
// league_entries.notified_round(-2 배치 안내 보냄 · -1 배치 결과 보낼 차례 · 0 보냄 · n n라운드 결과 보냄)와 source_key.

export type LeagueEntryRow = typeof leagueEntries.$inferSelect;
/** 목록용 경기 행. 득점 기록(detail_json)은 경기 상세에서만 따로 읽는다. */
export type LeagueMatchRow = Omit<typeof leagueMatches.$inferSelect, 'detailJson'>;
export type LeagueStateRow = typeof leagueState.$inferSelect;
export type LeagueTier = { tier: number; leagues: number; teams: number };

/** 배치 안내(자격이 모자란 신청에 한 번)는 배치 하루 전부터. */
export const LEAGUE_REMIND_MS = 24 * 3600_000;
/**
 * cron 한 번에 치르는 리그 경기 수. 경기마다 명단 쿼리 2번이라 컵 예산(32경기)과 합쳐도 D1 호출당 쿼리 상한(1000) 안에
 * 든다. 300팀(150경기) 라운드는 cron 4번(20분)에 나눠 치른다. 팀을 한 번에 읽으므로 바인드 변수 상한(100)도 넘지 않는다.
 */
export const LEAGUE_MATCHES_PER_TICK = 40;
/** cron 한 번에 보내는 알림 수(알림 하나에 문장 2~3개). */
export const LEAGUE_NOTICES_PER_TICK = 100;
/** json_each 한 문장에 넣는 행 수(바인드 값 하나의 크기를 작게). */
const JSON_CHUNK = 300;

const MATCH_COLS = Object.fromEntries(
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

/** 끝난 라운드 수: 모든 경기를 치른 앞쪽 라운드 수. 경기가 없으면 0. */
export async function playedRounds(db: Db, season: number) {
  const row = await db.$client
    .prepare(
      `SELECT MIN(CASE WHEN played_at IS NULL THEN round END) AS open, COUNT(*) AS n
       FROM league_matches WHERE season = ?`,
    )
    .bind(season)
    .first<{ open: number | null; n: number }>();
  if (!row?.n) return 0;
  return row.open === null ? LEAGUE_ROUNDS : row.open - 1;
}

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
          id: careers.id,
          publicName: careers.publicName,
          pos: careers.pos,
          number: careers.shirtNumber,
        })
        .from(careers)
        .where(
          inArray(
            careers.id,
            top.map((r) => r.careerId),
          ),
        )
    ).map((c) => [c.id, c]),
  );
  return top.flatMap((r) => {
    const c = who.get(r.careerId);
    // 지워진 커리어는 빼고 싣는다.
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
       WHERE m.season = ? AND m.tier = ? AND m.league_no = ? AND m.round = ? AND m.detail_json IS NOT NULL`,
    )
    .bind(season, tier, leagueNo, LEAGUE_ROUNDS)
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
       WHERE e.season = ? AND e.profile_id = ? AND e.status = 'active' AND e.team_id IS NOT NULL
         AND m.played_at IS NULL AND m.at <= ? LIMIT 1`,
    )
    // 컵과 같은 잠금(lockAt(at) <= now ⇔ at <= now + 잠금 시간).
    .bind(season, profileId, new Date(Date.parse(now) + CUP_LOCK_MIN * 60_000).toISOString())
    .first<{ hit: number }>();
  return !!row;
}

const notify = (
  d1: D1Database,
  profileId: string,
  sourceKey: string,
  title: string,
  body: string,
  now: string,
  push = true,
) =>
  eventNotificationStatements(
    d1,
    {
      profileId,
      sourceKey,
      now,
      content: { kind: 'team', title, body, target: { type: 'screen', screen: 'home' } },
    },
    // 원본 중복은 source_key가 막는다.
    { sql: '1' },
    { push },
  );

/** KST 'HH:MM'. */
const kstHm = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(11, 16);

function chunks<T>(xs: readonly T[], n = JSON_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

// ───────── 단계별 쓰기 ─────────

/**
 * 배치 하루 전: 아직 그 시즌 팀 선발이 자격 수에 못 미치는 신청에 한 번 알린다(notified_round 0 → -2). 한 cron에
 * LEAGUE_NOTICES_PER_TICK명씩.
 */
export async function remindLeague(db: Db, league: LeagueDef, now: string) {
  const d1 = db.$client;
  const { results } = await d1
    .prepare(
      `SELECT e.profile_id AS profileId, COALESCE(t.filled, 0) AS filled
       FROM league_entries e LEFT JOIN owner_teams t ON t.profile_id = e.profile_id AND t.season = e.season
       WHERE e.season = ? AND e.status = 'active' AND e.notified_round = 0 AND COALESCE(t.filled, 0) < ?
       LIMIT ?`,
    )
    .bind(league.season, league.minFilled, LEAGUE_NOTICES_PER_TICK)
    .all<{ profileId: string; filled: number }>();
  if (!results.length) return 0;
  const stmts: D1PreparedStatement[] = [];
  for (const r of results)
    stmts.push(
      d1
        .prepare(
          `UPDATE league_entries SET notified_round = -2, updated_at = ? WHERE season = ? AND profile_id = ? AND notified_round = 0`,
        )
        .bind(now, league.season, r.profileId),
      ...notify(
        d1,
        r.profileId,
        `league:${league.season}:remind`,
        cupKo('leagueRemindTitle'),
        cupKo('leagueRemindBody', { season: league.season, n: league.minFilled, filled: r.filled }),
        now,
      ),
    );
  await d1.batch(stmts);
  return results.length;
}

/** T-11-418e 같은 구단주의 지난 시즌 리그 결산(결과가 있는 것만). */
async function previousResults(db: Db, season: number) {
  const rows = await db
    .select({
      profileId: leagueEntries.profileId,
      tier: leagueEntries.tier,
      rank: leagueEntries.finalRank,
      outcome: leagueEntries.outcome,
    })
    .from(leagueEntries)
    .where(eq(leagueEntries.season, season - 1));
  return new Map(
    rows.flatMap((r) =>
      r.tier !== null && r.rank !== null && r.outcome
        ? [
            [
              r.profileId,
              { tier: r.tier, rank: r.rank, outcome: r.outcome as LeagueOutcome },
            ] as const,
          ]
        : [],
    ),
  );
}

/**
 * 배치: 그 시즌 팀 선발이 자격 수 이상인 신청을 부에 나누고(1부 1리그 · 2부 2리그 …), 부 안에서는 컵 조 추첨처럼 OVR
 * 포트로 리그를 고른다. 리그마다 14라운드 경기를 한 번에 만든다. 지난 시즌 결산이 있으면(T-11-418e) 승격 · 잔류 · 강등대로,
 * 새 팀은 OVR로 3부까지(leagueSeedOrder), 없으면(첫 시즌) OVR 순으로 나눈다. 빈자리를 채우며 위 부로 올라간 팀은 프리미엄
 * 스카우트권을 받는다. 자격이 모자라거나 리그를 꾸리고 남은 신청은 dropped. 알림은 다음 cron들이 나눠 보낸다.
 */
export async function drawLeague(db: Db, league: LeagueDef, now: string) {
  const d1 = db.$client;
  const rows = await db
    .select({ entry: leagueEntries, team: ownerTeams })
    .from(leagueEntries)
    .innerJoin(profiles, eq(profiles.id, leagueEntries.profileId))
    .leftJoin(
      ownerTeams,
      and(eq(ownerTeams.profileId, leagueEntries.profileId), eq(ownerTeams.season, league.season)),
    )
    .where(and(eq(leagueEntries.season, league.season), eq(leagueEntries.status, 'active')));
  const seed = crypto.randomUUID();
  const lot = rngFrom(`${seed}:order`);
  const prev = await previousResults(db, league.season);
  const byOvr = rows
    .filter((r) => r.team && r.team.filled >= league.minFilled)
    .map((r) => ({
      ...r,
      team: r.team!,
      lot: lot(),
      id: r.team!.id,
      ovr: r.team!.ovr,
      prev: prev.get(r.entry.profileId) ?? null,
    }))
    .sort((a, b) => b.team.ovr - a.team.ovr || a.lot - b.lot);
  const ok = byOvr.some((r) => r.prev) ? leagueSeedOrder(byOvr) : byOvr;
  const pyramid = leaguePyramid(ok.length);
  const used = ok.length - pyramid.dropped;
  const place = new Map<string, { tier: number; leagueNo: number }>();
  let at = 0;
  for (const t of pyramid.tiers) {
    const slice = ok.slice(at, at + t.teams);
    at += t.teams;
    const grp = drawGroups(
      slice.map((r) => ({ teamId: r.team.id, ovr: r.team.ovr })),
      t.leagues,
      `${seed}:${t.tier}`,
    );
    for (const r of slice) place.set(r.team.id, { tier: t.tier, leagueNo: grp.get(r.team.id)! });
  }
  // 배치 안 된 신청: 자격이 모자람(팀 기록 없음) · 리그를 꾸리고 남음(팀 기록 있음).
  const left = new Set(ok.slice(used).map((r) => r.entry.profileId));
  const updates = rows.map((r) => {
    const p = r.team ? place.get(r.team.id) : undefined;
    const keep = p || left.has(r.entry.profileId);
    return {
      p: r.entry.profileId,
      s: p ? 'active' : 'dropped',
      t: keep ? r.team!.id : null,
      n: keep ? r.team!.name : null,
      m: keep ? r.team!.manager : null,
      o: keep ? r.team!.ovr : null,
      tier: p?.tier ?? null,
      no: p?.leagueNo ?? null,
    };
  });
  const matches: unknown[][] = [];
  for (const t of pyramid.tiers)
    for (let no = 1; no <= t.leagues; no++) {
      // 리그 안 순서는 OVR 높은 순(같으면 팀 id) — 일정이 입력 순서에 기대지 않게.
      const members = ok
        .filter(
          (r) => place.get(r.team.id)?.tier === t.tier && place.get(r.team.id)?.leagueNo === no,
        )
        .sort((a, b) => b.team.ovr - a.team.ovr || a.team.id.localeCompare(b.team.id))
        .map((r) => r.team.id);
      leagueFixtures(members).forEach((pairs, r) =>
        pairs.forEach(([home, away], slot) =>
          matches.push([newId('lgm'), t.tier, no, r + 1, slot, home, away, league.rounds[r]!]),
        ),
      );
    }
  const stmts: D1PreparedStatement[] = [
    d1
      .prepare(
        `INSERT INTO league_state (season, seed, tiers_json, drawn_at, done_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(league.season, seed, JSON.stringify(pyramid.tiers), now, null),
  ];
  for (const part of chunks(updates))
    stmts.push(
      d1
        .prepare(
          `UPDATE league_entries SET status = j.s, team_id = j.t, name = j.n, manager = j.m, ovr = j.o, tier = j.tier,
             league_no = j.no, notified_round = -1, updated_at = ?
           FROM (SELECT value ->> 'p' AS p, value ->> 's' AS s, value ->> 't' AS t, value ->> 'n' AS n,
                   value ->> 'm' AS m, value ->> 'o' AS o, value ->> 'tier' AS tier, value ->> 'no' AS no
                 FROM json_each(?)) AS j
           WHERE league_entries.season = ? AND league_entries.profile_id = j.p AND league_entries.status = 'active'`,
        )
        .bind(now, JSON.stringify(part), league.season),
    );
  // 빈자리 승격: 지난 결과로 갈 부(1위는 한 부 위, 나머지는 그 부)보다 위에 배치됐다. 배치 묶음이 한 번만 커밋되므로(league_state
  // 기본 키) 따로 막을 줄이 필요 없다.
  for (const r of ok) {
    const p = place.get(r.team.id);
    const target = r.prev && (r.prev.outcome === 'promoted' ? r.prev.tier - 1 : r.prev.tier);
    if (!p || !target || r.prev!.outcome === 'forfeited' || p.tier >= target) continue;
    stmts.push(
      grantItemStatement(d1, r.entry.profileId, 'scout', LEAGUE_FILL_PROMOTE_SCOUTS, now, {
        sql: '1',
      }),
      ...notify(
        d1,
        r.entry.profileId,
        `league:${league.season}:fill`,
        cupKo('leagueFillTitle'),
        cupKo('leagueFillBody', {
          season: league.season,
          tier: p.tier,
          s: LEAGUE_FILL_PROMOTE_SCOUTS,
        }),
        now,
        false,
      ),
    );
  }
  for (const part of chunks(matches))
    stmts.push(
      d1
        .prepare(
          `INSERT OR IGNORE INTO league_matches (id, season, tier, league_no, round, slot, home_team_id, away_team_id, at)
           SELECT value ->> 0, ?, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6, value ->> 7
           FROM json_each(?)`,
        )
        .bind(league.season, JSON.stringify(part)),
    );
  await d1.batch(stmts);
  return { placed: used, dropped: rows.length - used, leagues: pyramid.tiers.length };
}

/**
 * 시각이 된 경기를 치른다(라운드 · 부 · 리그 순). 홈 이점이 있다(중립 경기 아님). 팀이 없거나(지워짐 · 다른 시즌) 선발이
 * 비었거나 기권 처리된 쪽은 0:3 기권패이고, 기권이 LEAGUE_FORFEIT_LIMIT번 쌓이면 남은 경기는 모두 기권패로 친다.
 */
export async function playLeagueMatches(
  db: Db,
  league: LeagueDef,
  entries: readonly LeagueEntryRow[],
  now: string,
  budget = LEAGUE_MATCHES_PER_TICK,
) {
  const d1 = db.$client;
  const due = await db
    .select(MATCH_COLS)
    .from(leagueMatches)
    .where(
      and(
        eq(leagueMatches.season, league.season),
        isNull(leagueMatches.playedAt),
        lte(leagueMatches.at, now),
      ),
    )
    .orderBy(
      asc(leagueMatches.round),
      asc(leagueMatches.tier),
      asc(leagueMatches.leagueNo),
      asc(leagueMatches.slot),
    )
    .limit(budget);
  if (!due.length) return 0;
  const ids = [...new Set(due.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
  const teams = new Map(
    (
      await db
        .select({ team: ownerTeams })
        .from(ownerTeams)
        .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
        .where(inArray(ownerTeams.id, ids))
    ).map((r) => [r.team.id, r.team]),
  );
  const byTeam = new Map(entries.filter(inLeague).map((e) => [e.teamId!, e]));
  const homeAdv = await leagueHomeAdvOf(db);
  // 이번 cron에서 늘어난 기권(같은 팀이 한 번에 여러 경기를 치르는 따라잡기 때).
  const forfeits = new Map<string, number>();
  const stmts: D1PreparedStatement[] = [];
  for (const m of due) {
    const side = (id: string) => {
      const e = byTeam.get(id);
      const t = teams.get(id);
      const fine =
        e?.status === 'active' &&
        (forfeits.get(id) ?? e.forfeits) < LEAGUE_FORFEIT_LIMIT &&
        t &&
        t.season === league.season &&
        t.profileId === e.profileId;
      return fine ? t : undefined;
    };
    const homeTeam = side(m.homeTeamId);
    const awayTeam = side(m.awayTeamId);
    // 자격은 경기 때 실제 선발로 다시 본다(저장해 둔 filled는 카드가 팔려도 바로 줄지 않는다). 팔린 자리는 유스가 채운다.
    const both =
      homeTeam && awayTeam ? await lineupsOf(db, league.season, homeTeam, awayTeam) : null;
    const alone = async (t: OwnerTeamRow | undefined) =>
      t && !both ? (await lineupsOf(db, league.season, t, t)).home : null;
    const homeLineup = both?.home ?? (await alone(homeTeam));
    const awayLineup = both?.away ?? (await alone(awayTeam));
    const ready = (l: typeof homeLineup) => !!l && filledCount(l) >= league.minFilled;
    const home = ready(homeLineup) ? homeTeam : undefined;
    const away = ready(awayLineup) ? awayTeam : undefined;
    let hg = 0;
    let ag = 0;
    let forfeit = 0;
    let detail: string | null = null;
    if (home && away && both) {
      const result = simulateMatch(m.id, both.home, both.away, league.season, {
        neutral: false,
        coaches: both.coaches,
        homeAdv,
      });
      hg = result.homeGoals;
      ag = result.awayGoals;
      detail = JSON.stringify(matchDetailOf(home, away, both, result));
    } else {
      forfeit = (home ? 0 : 1) | (away ? 0 : 2);
      if (forfeit === 1) ag = LEAGUE_FORFEIT_GOALS;
      if (forfeit === 2) hg = LEAGUE_FORFEIT_GOALS;
    }
    stmts.push(
      d1
        .prepare(
          `UPDATE league_matches SET played_at = ?, home_goals = ?, away_goals = ?, forfeit = ?, detail_json = ?
           WHERE id = ? AND played_at IS NULL`,
        )
        .bind(now, hg, ag, forfeit, detail, m.id),
    );
    for (const [bit, id] of [
      [1, m.homeTeamId],
      [2, m.awayTeamId],
    ] as const) {
      const e = byTeam.get(id);
      if (!(forfeit & bit) || e?.status !== 'active') continue;
      const n = (forfeits.get(id) ?? e.forfeits) + 1;
      forfeits.set(id, n);
      stmts.push(
        d1
          .prepare(
            `UPDATE league_entries SET forfeits = ?,
               status = CASE WHEN ? >= ? THEN 'forfeited' ELSE status END, updated_at = ?
             WHERE season = ? AND profile_id = ? AND status = 'active'`,
          )
          .bind(n, n, LEAGUE_FORFEIT_LIMIT, now, league.season, e.profileId),
      );
      if (n === LEAGUE_FORFEIT_LIMIT)
        stmts.push(
          ...notify(
            d1,
            e.profileId,
            `league:${league.season}:forfeited`,
            cupKo('leagueForfeitedTitle'),
            cupKo('leagueForfeitedBody', { n }),
            now,
          ),
        );
    }
  }
  await d1.batch(stmts);
  return due.length;
}

/**
 * T-11-418e 결산: 14라운드를 다 치르면 리그마다 최종 순위 · 결과(우승 · 승격 · 잔류 · 강등 · 기권 퇴출)를 저장하고 보상
 * (leagueReward)을 준다. rewarded_at이 비어 있는 줄만 바꾸고 아이템은 그 줄이 바뀌었을 때만 더한다(cron이 겹쳐도 한 번).
 * 1부 우승은 리그 챔피언 칭호를 얻고, 구단주가 칭호를 직접 고르지 않았으면 대표 칭호가 된다. 알림은 다음 단계(notifyLeague
 * 마지막 라운드)가 보상을 담아 보낸다. cron 한 번에 LEAGUE_NOTICES_PER_TICK명씩.
 */
export async function settleLeague(
  db: Db,
  league: LeagueDef,
  state: LeagueStateRow,
  entries: readonly LeagueEntryRow[],
  now: string,
) {
  const pending = entries
    .filter((e) => inLeague(e) && !e.rewardedAt)
    .slice(0, LEAGUE_NOTICES_PER_TICK);
  if (!pending.length) return 0;
  const d1 = db.$client;
  const bottomTier = tiersOf(state).at(-1)?.tier ?? 1;
  const all = await db
    .select(MATCH_COLS)
    .from(leagueMatches)
    .where(eq(leagueMatches.season, league.season));
  const tables = new Map<string, ReturnType<typeof leagueTable>>();
  const stmts: D1PreparedStatement[] = [];
  for (const e of pending) {
    const k = `${e.tier}:${e.leagueNo}`;
    let table = tables.get(k);
    if (!table)
      tables.set(
        k,
        (table = leagueTable(
          entries,
          all.filter((m) => m.tier === e.tier && m.leagueNo === e.leagueNo),
          state.seed,
          e.tier!,
          e.leagueNo!,
        )),
      );
    const rank = table.find((x) => x.teamId === e.teamId)?.rank ?? table.length;
    const outcome = leagueOutcome(e.tier!, rank, bottomTier, e.status === 'forfeited');
    const { rerolls, scouts, boosts } = leagueReward(e.tier!, rank, e.forfeits, outcome);
    const granted = {
      sql: 'EXISTS (SELECT 1 FROM league_entries WHERE season = ? AND profile_id = ? AND rewarded_at = ?)',
      params: [league.season, e.profileId, now],
    };
    stmts.push(
      d1
        .prepare(
          `UPDATE league_entries SET final_rank = ?, outcome = ?, rewarded_at = ?, updated_at = ?
           WHERE season = ? AND profile_id = ? AND rewarded_at IS NULL`,
        )
        .bind(rank, outcome, now, now, league.season, e.profileId),
      ...(rerolls > 0
        ? [grantItemStatement(d1, e.profileId, 'reroll', rerolls, now, granted)]
        : []),
      ...(scouts > 0 ? [grantItemStatement(d1, e.profileId, 'scout', scouts, now, granted)] : []),
      ...(boosts > 0 ? [grantItemStatement(d1, e.profileId, 'boost', boosts, now, granted)] : []),
      // 컵 우승 칭호(autoTitle)와 같은 규칙: 직접 고르지 않았고 지금 칭호가 없거나 컵 성적 칭호면 바꾼다.
      ...(outcome === 'champion'
        ? [
            d1
              .prepare(
                `UPDATE profiles SET title = ? WHERE id = ? AND title_pinned = 0
                 AND (title IS NULL OR ${TITLE_STAGES.map(() => 'title LIKE ?').join(' OR ')})`,
              )
              .bind(
                leagueTitleIdOf(league.season),
                e.profileId,
                ...TITLE_STAGES.map((t) => `%-${t}`),
              ),
          ]
        : []),
    );
  }
  await d1.batch(stmts);
  return pending.length;
}

/** 마지막 라운드 알림 본문: 최종 순위 · 받은 보상 · 다음 시즌 부. */
function endBody(e: LeagueEntryRow, rank: number) {
  const where = { tier: e.tier!, league: e.leagueNo!, rank };
  const outcome = e.outcome as LeagueOutcome | null;
  if (!outcome) return cupKo('leagueEndBody', where);
  if (outcome === 'forfeited') return cupKo('leagueEndBodyForfeited', where);
  const { rerolls: n, scouts: s, boosts: b } = leagueReward(e.tier!, rank, e.forfeits, outcome);
  if (outcome === 'champion') return cupKo('leagueEndBodyChampion', { season: e.season, n, s, b });
  const next = leagueNextTier(e.tier!, outcome)!;
  return s > 0
    ? cupKo('leagueEndBodyAll', { ...where, n, s, b, next })
    : n > 0
      ? cupKo('leagueEndBodyReroll', { ...where, n, next })
      : cupKo('leagueEndBodyNext', { ...where, next });
}

/**
 * 알림 차례인 신청에 알린다: 배치 결과(-1 → 0), 끝난 라운드 결과(→ 그 라운드). 늦었으면 가장 최근 라운드만 알린다.
 * 마지막 라운드는 최종 순위 알림. 기권 처리된 팀은 알림함에만 남긴다.
 */
export async function notifyLeague(
  db: Db,
  league: LeagueDef,
  state: LeagueStateRow,
  entries: readonly LeagueEntryRow[],
  played: number,
  now: string,
) {
  const d1 = db.$client;
  const pending = entries
    .filter(
      (e) =>
        (e.status === 'dropped' && e.notifiedRound < 0) ||
        (inLeague(e) && e.notifiedRound < played),
    )
    .slice(0, LEAGUE_NOTICES_PER_TICK);
  if (!pending.length) return 0;
  const cancelled = !tiersOf(state).length;
  const roundOf = new Map<string, LeagueMatchRow[]>();
  const tables = new Map<string, ReturnType<typeof leagueTable>>();
  const needRounds = played > 0 && pending.some((e) => inLeague(e) && e.notifiedRound >= 0);
  const all = needRounds
    ? await db.select(MATCH_COLS).from(leagueMatches).where(eq(leagueMatches.season, league.season))
    : [];
  for (const m of all) {
    const k = `${m.tier}:${m.leagueNo}`;
    roundOf.set(k, [...(roundOf.get(k) ?? []), m]);
  }
  const tableOf = (tier: number, no: number) => {
    const k = `${tier}:${no}`;
    let t = tables.get(k);
    if (!t) tables.set(k, (t = leagueTable(entries, roundOf.get(k) ?? [], state.seed, tier, no)));
    return t;
  };
  const nameOf = new Map(entries.map((e) => [e.teamId, e.name]));
  const leftOver = entries.filter((x) => x.status === 'dropped' && x.teamId).length;
  const season = league.season;
  const stmts: D1PreparedStatement[] = [];
  for (const e of pending) {
    let target = 0;
    let title: string;
    let body: string;
    let key: string;
    if (e.status === 'dropped') {
      key = `league:${season}:dropped`;
      title = cancelled
        ? cupKo('leagueCancelledTitle', { season })
        : cupKo('leagueDroppedTitle', { season });
      body = cancelled
        ? cupKo('cancelledBody')
        : e.teamId
          ? cupKo('leagueLeftBody', { n: leftOver })
          : cupKo('leagueDroppedBody', { season, n: league.minFilled });
    } else if (e.notifiedRound < 0 || played === 0) {
      key = `league:${season}:placed`;
      title = cupKo('leaguePlacedTitle', { season });
      body = cupKo('leaguePlacedBody', {
        team: e.name ?? '-',
        tier: e.tier!,
        league: e.leagueNo!,
        time: kstHm(league.rounds[0]!),
      });
    } else {
      target = played;
      const table = tableOf(e.tier!, e.leagueNo!);
      const rank = table.find((s) => s.teamId === e.teamId)?.rank ?? table.length;
      if (played === LEAGUE_ROUNDS) {
        key = `league:${season}:end`;
        // 결산(settleLeague)이 저장한 순위 · 결과를 쓴다. 결산 전 줄이면(옛 데이터) 순위표 순위만.
        const final = e.finalRank ?? rank;
        title =
          final === 1
            ? cupKo('leagueChampionTitle', { season, tier: e.tier!, league: e.leagueNo! })
            : cupKo('leagueEndTitle', { season });
        body = endBody(e, final);
      } else {
        key = `league:${season}:r${played}`;
        const m = (roundOf.get(`${e.tier}:${e.leagueNo}`) ?? []).find(
          (x) => x.round === played && (x.homeTeamId === e.teamId || x.awayTeamId === e.teamId),
        );
        if (!m) {
          // 7팀 리그의 쉬는 라운드.
          title = cupKo('leagueRoundTitle', { round: played, result: cupKo('leagueRest') });
          body = cupKo('leagueRestBody', { rank });
        } else {
          const home = m.homeTeamId === e.teamId;
          const mine = home ? m.homeGoals! : m.awayGoals!;
          const theirs = home ? m.awayGoals! : m.homeGoals!;
          const lost = m.forfeit === 3 || mine < theirs;
          const result = cupKo(lost ? 'loss' : mine > theirs ? 'win' : 'draw');
          title = cupKo('leagueRoundTitle', { round: played, result });
          const score = `${nameOf.get(m.homeTeamId) ?? '-'} ${m.homeGoals ?? 0} : ${m.awayGoals ?? 0} ${nameOf.get(m.awayTeamId) ?? '-'}`;
          // T-11-430 내가 기권한 경기면 쌓인 기권 수와 남은 횟수를 알린다(3번째는 기권 퇴출 알림이 따로 간다).
          const forfeited = !!(m.forfeit & (home ? 1 : 2));
          body =
            forfeited && e.status === 'active' && e.forfeits < LEAGUE_FORFEIT_LIMIT
              ? cupKo('leagueRoundForfeitBody', {
                  score,
                  n: e.forfeits,
                  limit: LEAGUE_FORFEIT_LIMIT,
                  left: LEAGUE_FORFEIT_LIMIT - e.forfeits,
                })
              : cupKo('leagueRoundBody', { score, rank });
        }
      }
    }
    stmts.push(
      d1
        .prepare(
          `UPDATE league_entries SET notified_round = ?, updated_at = ? WHERE season = ? AND profile_id = ? AND notified_round < ?`,
        )
        .bind(target, now, season, e.profileId, target),
      ...notify(d1, e.profileId, key, title, body, now, e.status !== 'forfeited'),
    );
  }
  await d1.batch(stmts);
  return pending.length;
}

/** cron 한 번: 배치 안내 → 배치 → 시각이 된 경기 → 결산(마지막 라운드 뒤) → 알림 → 끝. 한 단계만 하고 끝낸다. */
export async function runLeague(db: Db, now: string, given?: LeagueDef) {
  const league = given ?? (await currentLeague(db, now));
  if (!league) return null;
  if (now < league.drawAt) {
    if (Date.parse(now) < Date.parse(league.drawAt) - LEAGUE_REMIND_MS) return null;
    const n = await remindLeague(db, league, now);
    return n ? { season: league.season, step: 'remind', n } : null;
  }
  const [state] = await leagueStateOf(db, league.season);
  if (!state)
    return { season: league.season, step: 'draw', ...(await drawLeague(db, league, now)) };
  if (state.doneAt) return null;
  const entries = await leagueEntriesOf(db, league.season);
  const n = await playLeagueMatches(db, league, entries, now);
  if (n) return { season: league.season, step: 'play', n };
  const played = await playedRounds(db, league.season);
  if (played === LEAGUE_ROUNDS) {
    const settled = await settleLeague(db, league, state, entries, now);
    if (settled) return { season: league.season, step: 'settle', n: settled };
  }
  const sent = await notifyLeague(db, league, state, entries, played, now);
  if (sent) return { season: league.season, step: 'notify', n: sent, played };
  if (played === LEAGUE_ROUNDS || !tiersOf(state).length) {
    await markDone(db, league.season, now);
    return { season: league.season, step: 'done' };
  }
  return null;
}

const markDone = (db: Db, season: number, now: string) =>
  db
    .update(leagueState)
    .set({ doneAt: now })
    .where(and(eq(leagueState.season, season), isNull(leagueState.doneAt)))
    .run();

/** T-11-418e 리그 1부 우승 시즌(칭호). league_entries_profile_idx로 그 구단주 줄만 읽는다. */
export async function leagueChampionSeasons(db: Db, profileId: string) {
  const rows = await db
    .select({ season: leagueEntries.season })
    .from(leagueEntries)
    .where(and(eq(leagueEntries.profileId, profileId), eq(leagueEntries.outcome, 'champion')));
  return rows.map((r) => r.season);
}
