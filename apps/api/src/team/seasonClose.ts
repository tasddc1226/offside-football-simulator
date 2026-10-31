import { grantPioneerTitles } from '../db/repos/ownerTitles.js';
// T-11-128 시즌 결산. 시즌이 끝나면(프리시즌은 첫 시즌 개막, 시즌은 마감) 5분 cron이 한 단계씩 굳힌다 — 한 번 실행의
// D1 하위 요청 한도(1,000) 안에 들게 단계를 나눈다. 굳힌 결산·휘장은 다시 세지 않는다(계산식이 바뀌어도 그대로).
//
// records: 구단주마다 선수·결번·명예의 벽·최초 기록·팀 성적을 마감 시각 기준으로 적는다.
// stats:   결산 화면용 기록 묶음을 구단주 범위별로 채우고 커서를 저장한다.
// ach:     업적 점수는 마감 뒤에 점수가 바뀐 구단주만 마감 시각 기준으로 다시 센다(한 번에 ACH_CHUNK명).
// ranks:   팀 레이팅 · 업적 · 명예의 전당 순위를 매긴다.
// honors:  순위와 보유 기록으로 휘장을 준다.
// division: T-11-375 시즌 마감 디비전 휘장 · 리롤권(보상 시작 시즌부터, 휘장과 리롤권을 한 batch로).
import { HONOR_BANDS, type RankedHonorKind } from '@offside/contracts';
import {
  CARD_ELITE_PEAK,
  CARD_GOLD_PEAK,
  CARD_ICON_SCORE,
  CARD_LEGEND_SCORE,
  CARD_SILVER_PEAK,
} from '@offside/contracts/card-tier';
import { HOF_MIN_RETIRE_AGE } from '@offside/contracts/hof-rules';
import {
  openTeamSeasons,
  teamSeasonClosed,
  teamSeasonEndsAt,
} from '@offside/contracts/service-seasons';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { setMeta } from '../db/repos/firsts.js';
import { appMeta, ownerAchievements, ownerSeasonRecords, profiles } from '../db/schema.js';
import { achievementScore } from './achievements.js';
import { computeOwnerAchievements } from './ownerAchievements.js';
import { logErrorText } from '../logError.js';
import { resolveBalance } from '@offside/contracts/balance';
import { divisionRerolls, TEAM_DIVISION_REWARD_MIN } from '@offside/contracts/team-division';
import { getActiveBalance } from '../db/repos/balance.js';

import { CUP_PLAN_DEFAULTS } from '@offside/contracts/cup';

/** T-11-375 디비전 보상을 받는 선발 은퇴 선수 수(컵 참가 자격과 같다). */
export const DIVISION_REWARD_FILLED = CUP_PLAN_DEFAULTS.minFilled;

/** 업적 다시 세기 한 번에 몇 명(구단주마다 D1을 7번쯤 부른다). */
const ACH_CHUNK = 40;
const STATS_CHUNK = 200;

export type CloseStep = 'records' | 'stats' | 'ach' | 'ranks' | 'honors' | 'division' | 'done';
export type CloseState = {
  step: CloseStep;
  cutoff: string;
  statsAfter?: string;
  /** 순위에 오른 수(ranks 단계에서 센다). */
  ranked?: { team: number; ach: number; hof: number };
  closedAt?: string;
};

export const closeMetaKey = (season: number) => `season-close:${season}`;

const parseState = (value: string): CloseState | null => {
  try {
    return JSON.parse(value) as CloseState;
  } catch {
    return null;
  }
};

export async function closeStateOf(db: Db, season: number): Promise<CloseState | null> {
  const [row] = await db
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, closeMetaKey(season)));
  return row ? parseState(row.value) : null;
}

/** D1 batch에는 원시 쓰기 문을 넣을 수 없어 차례로 돈다. */
async function runEach(db: Db, statements: SQL[]) {
  for (const statement of statements) await db.run(statement);
}

const saveState = (db: Db, season: number, state: CloseState) =>
  setMeta(db, closeMetaKey(season), JSON.stringify(state));

/** 로그인 수단이 있는 삭제되지 않은 구단주(profiles 별칭 p). 라이브 랭킹의 accountLinkedSql · rankedIn과 같은 기준으로 맞춘다. */
const LINKED_SQL = '(p.google_sub is not null or p.apple_sub is not null) and p.deleted_at is null';
const LINKED = sql.raw(LINKED_SQL);

async function closeRecords(db: Db, season: number, cutoff: string, now: string) {
  // 선수 기록은 마감 전에 은퇴한 선수만 센다(결번·명예의 벽은 소급 지급이 늦어도 은퇴 시각으로 판단). 최초 기록은 세운 시각.
  // 구단주마다 상관 하위 질의를 돌면 운영 규모(커리어 5만)에서 D1 CPU 한도를 넘는다 — 묶음 집계 한 번씩으로 채운다.
  const retiredBy = sql`c.status = 'retired' and c.legend_score is not null and c.retired_at <= ${cutoff}`;
  const seasonCareers = sql`coalesce(c.service_season, 0) = ${season} and c.hidden = 0`;
  await runEach(db, [
    sql`
      insert or ignore into owner_season_records (
        profile_id, season, players, retired, retired_numbers, wall_of_honor, firsts,
        team_id, team_name, team_rating, wins, draws, losses, goals_for, best_streak, created_at
      )
      select o.profile_id, ${season}, coalesce(k.players, 0), coalesce(k.retired, 0), 0, coalesce(k.wall, 0), 0,
        t.id, t.name, t.rating, coalesce(t.wins, 0), coalesce(t.draws, 0), coalesce(t.losses, 0),
        coalesce(t.goals_for, 0), coalesce(t.best_streak, 0), ${now}
      from (
        select profile_id from careers c where ${seasonCareers}
        union
        select profile_id from owner_teams where season = ${season} and created_at < ${cutoff}
      ) o
      join profiles p on p.id = o.profile_id and p.deleted_at is null
      left join (
        select c.profile_id, count(*) as players, sum(${retiredBy}) as retired,
          sum(${retiredBy} and c.wall_of_honor_json is not null) as wall
        from careers c where ${seasonCareers} group by c.profile_id
      ) k on k.profile_id = o.profile_id
      left join owner_teams t on t.profile_id = o.profile_id and t.season = ${season} and t.created_at < ${cutoff}`,
    sql`
      update owner_season_records set best_career_id = x.id, best_score = x.legend_score
      from (
        select c.profile_id, c.id, c.legend_score,
          row_number() over (partition by c.profile_id order by c.legend_score desc, c.retired_at, c.id) as rk
        from careers c where ${seasonCareers} and ${retiredBy}
      ) x
      where x.rk = 1 and x.profile_id = owner_season_records.profile_id and owner_season_records.season = ${season}`,
    sql`
      update owner_season_records set retired_numbers = x.n
      from (
        select c.profile_id, count(*) as n from retired_numbers r join careers c on c.id = r.career_id
        where r.season = ${season} and c.retired_at <= ${cutoff} group by c.profile_id
      ) x
      where x.profile_id = owner_season_records.profile_id and owner_season_records.season = ${season}`,
    sql`
      update owner_season_records set firsts = x.n
      from (
        select c.profile_id, count(*) as n from server_firsts f join careers c on c.id = f.career_id
        where f.season = ${season} and f.achieved_at <= ${cutoff} group by c.profile_id
      ) x
      where x.profile_id = owner_season_records.profile_id and owner_season_records.season = ${season}`,
  ]);
  // 마감 전에 닿은 업적 점수는 그대로 옮긴다(reached_at은 점수가 바뀔 때만 움직인다). 업적 행이 없으면 점수도 없다.
  await runEach(db, [
    sql`
      update owner_season_records set ach_score = a.score, ach_done = a.done, ach_at = a.reached_at, ach_checked = 1
      from owner_achievements a
      where a.profile_id = owner_season_records.profile_id and a.season = ${season}
        and owner_season_records.season = ${season} and a.reached_at <= ${cutoff}`,
    sql`
      update owner_season_records set ach_checked = 1
      where season = ${season} and ach_checked = 0 and not exists (
        select 1 from owner_achievements a where a.profile_id = owner_season_records.profile_id and a.season = ${season})`,
  ]);
}

/** 구단주 범위마다 결산 통계를 계산한다. 커서는 성공한 묶음 뒤에만 저장한다. */
async function closeStats(
  db: Db,
  season: number,
  cutoff: string,
  after: string,
  chunk: number,
): Promise<string | null> {
  const rows = await db.all<{ profile_id: string }>(sql`select profile_id from owner_season_records
    where season = ${season} and profile_id > ${after} order by profile_id limit ${chunk}`);
  if (!rows.length) return null;
  const last = rows[rows.length - 1]!.profile_id;
  const retiredBy = sql`c.status = 'retired' and c.legend_score is not null and c.retired_at <= ${cutoff}`;
  const seasonCareers = sql`coalesce(c.service_season, 0) = ${season} and c.hidden = 0`;
  // 카드 등급(card-tier.ts의 cardTier와 같은 기준).
  const ICON = sql`c.legend_score >= ${CARD_ICON_SCORE}`;
  const LEGEND = sql`c.legend_score >= ${CARD_LEGEND_SCORE} and c.legend_score < ${CARD_ICON_SCORE}`;
  const NOT_LEGEND = sql`c.legend_score < ${CARD_LEGEND_SCORE}`;
  const PEAK = sql`coalesce(c.peak, 0)`;
  await db.run(sql`
      update owner_season_records set stats_json = json_object(
        'stats', json_object('apps', x.apps, 'goals', x.goals, 'assists', x.assists, 'trophies', x.trophies,
          'caps', x.caps, 'ballon', x.ballon,
          'tiers', json_object('icon', x.t_icon, 'legend', x.t_legend, 'elite', x.t_elite, 'gold', x.t_gold,
            'silver', x.t_silver, 'bronze', x.t_bronze)),
        'scorer', json_object('id', x.scorer_id, 'goals', x.scorer_goals),
        'team', json_object('goalsAgainst', x.goals_against, 'bestMargin', x.best_margin))
      from (
        select r.profile_id,
          coalesce(k.apps, 0) as apps, coalesce(k.goals, 0) as goals, coalesce(k.assists, 0) as assists,
          coalesce(k.trophies, 0) as trophies, coalesce(k.caps, 0) as caps, coalesce(k.ballon, 0) as ballon,
          coalesce(k.t_icon, 0) as t_icon, coalesce(k.t_legend, 0) as t_legend, coalesce(k.t_elite, 0) as t_elite,
          coalesce(k.t_gold, 0) as t_gold, coalesce(k.t_silver, 0) as t_silver, coalesce(k.t_bronze, 0) as t_bronze,
          s.id as scorer_id, s.goals as scorer_goals, t.goals_against, t.best_margin
        from owner_season_records r
        left join (
          select c.profile_id, sum(coalesce(c.apps, 0)) as apps, sum(coalesce(c.goals, 0)) as goals,
            sum(coalesce(c.assists, 0)) as assists, sum(coalesce(c.trophies, 0)) as trophies,
            sum(coalesce(c.caps, 0)) as caps, sum(coalesce(c.ballon, 0)) as ballon,
            sum(${ICON}) as t_icon, sum(${LEGEND}) as t_legend,
            sum(${NOT_LEGEND} and ${PEAK} >= ${CARD_ELITE_PEAK}) as t_elite,
            sum(${NOT_LEGEND} and ${PEAK} >= ${CARD_GOLD_PEAK} and ${PEAK} < ${CARD_ELITE_PEAK}) as t_gold,
            sum(${NOT_LEGEND} and ${PEAK} >= ${CARD_SILVER_PEAK} and ${PEAK} < ${CARD_GOLD_PEAK}) as t_silver,
            sum(${NOT_LEGEND} and ${PEAK} < ${CARD_SILVER_PEAK}) as t_bronze
          from careers c where ${seasonCareers} and ${retiredBy} and c.profile_id > ${after} and c.profile_id <= ${last} group by c.profile_id
        ) k on k.profile_id = r.profile_id
        left join (
          select c.profile_id, c.id, c.goals,
            row_number() over (partition by c.profile_id order by c.goals desc, c.legend_score desc, c.id) as rk
          from careers c where ${seasonCareers} and ${retiredBy} and c.profile_id > ${after} and c.profile_id <= ${last} and c.goals > 0
        ) s on s.profile_id = r.profile_id and s.rk = 1
        left join owner_teams t on t.id = r.team_id
        where r.season = ${season} and r.profile_id > ${after} and r.profile_id <= ${last}
      ) x
      where x.profile_id = owner_season_records.profile_id and owner_season_records.season = ${season} and owner_season_records.profile_id > ${after} and owner_season_records.profile_id <= ${last}`);
  return last;
}

/** 마감 뒤에 점수가 바뀐 구단주를 마감 시각 기준으로 다시 센다. 다 셌으면 true. */
async function closeAchievements(db: Db, season: number, cutoff: string): Promise<boolean> {
  // 업적 계산에는 닉네임만 있으면 된다(닉네임 업적) — 프로필 전체를 검증하며 읽지 않는다.
  const rows = await db
    .select({ id: profiles.id, nickname: profiles.nickname, score: ownerAchievements.score })
    .from(ownerSeasonRecords)
    .innerJoin(profiles, eq(profiles.id, ownerSeasonRecords.profileId))
    .leftJoin(
      ownerAchievements,
      and(
        eq(ownerAchievements.profileId, ownerSeasonRecords.profileId),
        eq(ownerAchievements.season, season),
      ),
    )
    .where(and(eq(ownerSeasonRecords.season, season), eq(ownerSeasonRecords.achChecked, 0)))
    .limit(ACH_CHUNK);
  const writes = [];
  for (const owner of rows) {
    let score: { score: number; done: number } | null;
    try {
      score = achievementScore(
        (await computeOwnerAchievements(db, owner, season, cutoff, cutoff)).groups,
      );
    } catch (e) {
      // 한 구단주가 실패해도 결산은 끝까지 간다 — 그 구단주는 지금 점수로 둔다(로그로 남긴다).
      console.error(
        JSON.stringify({
          level: 'error',
          job: 'season-close',
          owner: owner.id,
          error: logErrorText(e, 300),
        }),
      );
      score = owner.score === null ? null : { score: owner.score, done: 0 };
    }
    writes.push(
      db
        .update(ownerSeasonRecords)
        .set({
          achScore: score?.score ?? null,
          achDone: score?.done ?? null,
          // 마감 전에 그 점수에 닿은 시각은 알 수 없다 — 마감 시각으로 두어 같은 점수면 먼저 닿은 구단주가 앞선다.
          achAt: score ? cutoff : null,
          achChecked: 1,
        })
        .where(
          and(eq(ownerSeasonRecords.profileId, owner.id), eq(ownerSeasonRecords.season, season)),
        ),
    );
  }
  // 쓰기는 한 번에 묶어 하위 요청을 아낀다(5분 cron의 알림 작업과 한도를 나눠 쓴다).
  const [first, ...rest] = writes;
  if (first) await db.batch([first, ...rest]);
  return rows.length < ACH_CHUNK;
}

/** 그 시즌 명예의 전당에 드는 선수(listHof · isPublicRetired와 같은 기준, careers 별칭 c). */
const hofCareers = (season: number, cutoff: string) => sql`
  coalesce(c.service_season, 0) = ${season} and c.status = 'retired' and c.legend_score is not null
  and c.retire_age >= ${HOF_MIN_RETIRE_AGE} and c.hidden = 0 and c.retired_at <= ${cutoff}`;

async function closeRanks(db: Db, season: number, cutoff: string) {
  // 팀 랭킹은 라이브 랭킹(listTeamRanking)과 같은 순서, 명예의 전당은 레전드 점수 · 먼저 은퇴한 순(listHof).
  await runEach(db, [
    sql`
      update owner_season_records set team_rank = x.rk
      from (
        select t.profile_id, row_number() over (order by t.rating desc, t.ovr desc, t.created_at, t.id) as rk
        from owner_teams t join profiles p on p.id = t.profile_id
        where t.season = ${season} and t.filled > 0 and t.created_at < ${cutoff} and ${LINKED}
      ) x
      where x.profile_id = owner_season_records.profile_id and owner_season_records.season = ${season}`,
    sql`
      update owner_season_records set ach_rank = x.rk
      from (
        select r.profile_id, row_number() over (order by r.ach_score desc, r.ach_at, r.profile_id) as rk
        from owner_season_records r join profiles p on p.id = r.profile_id
        where r.season = ${season} and r.ach_score > 0 and ${LINKED}
      ) x
      where x.profile_id = owner_season_records.profile_id and owner_season_records.season = ${season}`,
    sql`
      update owner_season_records set hof_rank = x.rk
      from (
        select profile_id, min(rk) as rk from (
          select c.profile_id, row_number() over (order by c.legend_score desc, c.retired_at, c.id) as rk
          from careers c where ${hofCareers(season, cutoff)}
        ) group by profile_id
      ) x
      where x.profile_id = owner_season_records.profile_id and owner_season_records.season = ${season}`,
  ]);
  const [counts] = await db.all<{ team: number; ach: number; hof: number }>(sql`
    select
      (select count(*) from owner_season_records where season = ${season} and team_rank is not null) as team,
      (select count(*) from owner_season_records where season = ${season} and ach_rank is not null) as ach,
      (select count(*) from careers c where ${hofCareers(season, cutoff)}) as hof`);
  return {
    team: Number(counts?.team ?? 0),
    ach: Number(counts?.ach ?? 0),
    hof: Number(counts?.hof ?? 0),
  };
}

/** 순위 → 단계(1 · 10 · …) CASE 식. 마지막 단계 밖은 where에서 거른다. */
const bandSql = (kind: RankedHonorKind, col: string) =>
  sql.raw(`case ${HONOR_BANDS[kind].map((b) => `when ${col} <= ${b} then ${b}`).join(' ')} end`);
const lastBand = (kind: RankedHonorKind) => HONOR_BANDS[kind][HONOR_BANDS[kind].length - 1]!;

async function closeHonors(db: Db, season: number, now: string) {
  const ranked = (kind: RankedHonorKind, col: string) => sql`
      insert or ignore into owner_honors (profile_id, season, kind, band, rank, value, granted_at)
      select profile_id, season, ${kind}, ${bandSql(kind, col)}, ${sql.raw(col)}, null, ${now}
      from owner_season_records where season = ${season} and ${sql.raw(col)} <= ${lastBand(kind)}`;
  const held = (kind: string, col: string) => sql`
      insert or ignore into owner_honors (profile_id, season, kind, band, rank, value, granted_at)
      select profile_id, season, ${kind}, null, null, ${sql.raw(col)}, ${now}
      from owner_season_records where season = ${season} and ${sql.raw(col)} > 0`;
  await runEach(db, [
    held('pioneer', 'retired'),
    ranked('achievements', 'ach_rank'),
    ranked('team', 'team_rank'),
    ranked('hof', 'hof_rank'),
    held('retired-number', 'retired_numbers'),
    held('wall-of-honor', 'wall_of_honor'),
    held('first', 'firsts'),
  ]);
}

/**
 * T-11-375 시즌 마감 디비전 보상. 자격: 로그인 수단이 있는 구단주, 마감 전에 만든 팀, 선발 은퇴 선수 8명 이상, 그 시즌 랭크
 * 경기(건 경기 + 받은 경기) teamDivMinMatches판 이상, 디비전 프로 II 이상. 휘장(owner_honors 기본 키가 시즌 · 종류라 한 번만)을
 * 넣고 같은 batch에서 이번에 넣은 휘장에만 리롤권을 더한다 — 다시 돌아도 휘장이 이미 있어 두 번 주지 않는다.
 */
export async function closeDivisions(db: Db, season: number, cutoff: string, now: string) {
  const b = resolveBalance((await getActiveBalance(db))?.values);
  if (season < b.teamDivRewardFrom) return 0;
  const rerolls = [3, 4, 5, 6, 7].map((d) => divisionRerolls(d, b));
  const d1 = db.$client;
  const [honors] = await d1.batch([
    d1
      .prepare(
        `INSERT OR IGNORE INTO owner_honors (profile_id, season, kind, band, rank, value, granted_at)
         SELECT t.profile_id, t.season, 'division', NULL, NULL, t.division, ?1
         FROM owner_teams t JOIN profiles p ON p.id = t.profile_id
         WHERE t.season = ?2 AND t.division >= ?3 AND t.filled >= ?4
           AND t.wins + t.draws + t.losses >= ?5 AND t.created_at < ?6 AND ${LINKED_SQL}`,
      )
      .bind(
        now,
        season,
        TEAM_DIVISION_REWARD_MIN,
        DIVISION_REWARD_FILLED,
        b.teamDivMinMatches,
        cutoff,
      ),
    d1
      .prepare(
        `INSERT INTO owner_items (profile_id, item, qty, updated_at)
         SELECT profile_id, 'reroll', q, ?1 FROM (
           SELECT h.profile_id, CASE h.value WHEN 3 THEN ?2 WHEN 4 THEN ?3 WHEN 5 THEN ?4 WHEN 6 THEN ?5 ELSE ?6 END AS q
           FROM owner_honors h WHERE h.season = ?7 AND h.kind = 'division' AND h.granted_at = ?1
         ) WHERE q > 0
         ON CONFLICT (profile_id, item) DO UPDATE SET qty = qty + excluded.qty, updated_at = excluded.updated_at`,
      )
      .bind(now, ...rerolls, season),
  ]);
  return honors?.meta.changes ?? 0;
}

/** 끝났는데 아직 굳히지 않은 가장 오래된 시즌의 다음 단계를 하나 돈다. 할 일이 없으면 null. */
export async function runSeasonClose(db: Db, now: string, statsChunk = STATS_CHUNK) {
  const closed = openTeamSeasons(now).filter((s) => teamSeasonClosed(s, now));
  if (closed.length === 0) return null;
  // 끝난 시즌의 상태를 한 번에 읽는다 — 다 굳힌 뒤에는 5분마다 이 읽기 하나로 끝난다.
  const metas = await db
    .select({ key: appMeta.key, value: appMeta.value })
    .from(appMeta)
    .where(inArray(appMeta.key, closed.map(closeMetaKey)));
  const states = new Map(metas.map((m) => [m.key, parseState(m.value)]));
  for (const season of closed) {
    const cutoff = teamSeasonEndsAt(season);
    if (!cutoff) continue;
    const state = states.get(closeMetaKey(season)) ?? { step: 'records' as const, cutoff };
    if (state.step === 'done') continue;
    const before = state.step;
    if (state.step === 'records') {
      await closeRecords(db, season, cutoff, now);
      state.step = 'stats';
    } else if (state.step === 'stats') {
      const last = await closeStats(db, season, cutoff, state.statsAfter ?? '', statsChunk);
      if (last === null) {
        delete state.statsAfter;
        state.step = 'ach';
      } else state.statsAfter = last;
    } else if (state.step === 'ach') {
      if (await closeAchievements(db, season, cutoff)) state.step = 'ranks';
    } else if (state.step === 'ranks') {
      state.ranked = await closeRanks(db, season, cutoff);
      state.step = 'honors';
    } else if (state.step === 'honors') {
      await closeHonors(db, season, now);
      await grantPioneerTitles(db, now);
      state.step = 'division';
    } else {
      await closeDivisions(db, season, cutoff, now);
      state.step = 'done';
      state.closedAt = now;
    }
    await saveState(db, season, state);
    return { season, step: before, next: state.step };
  }
  return null;
}
