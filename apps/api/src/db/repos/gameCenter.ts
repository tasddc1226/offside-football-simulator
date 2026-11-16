import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  ACHIEVEMENT_EUROPEAN_LEAGUES,
  GAME_CENTER_WEEKLY_START,
  GAME_CENTER_WEEK_MS,
  PLAY_GAMES_WEEKLY_START,
  type GameServicesProgress,
  type GameCenterAchievement,
  type GameCenterExpandedProgress,
  type GameCenterProgress,
} from '@offside/contracts/game-center';
import { NATIONAL_WINS } from '@offside/contracts/nations';
import type { Db } from '../client.js';
import { careers, careerSeasons } from '../schema.js';
import { isPublicRetired, retiredLiteral } from './careers.js';

/** One indexed owner scan across seasons. No player details, R2 reads or per-career queries. */
async function loadProgress(
  db: Db,
  profileId: string,
  now: string,
  weeklyStart = GAME_CENTER_WEEKLY_START,
) {
  const anchor = Date.parse(weeklyStart);
  const time = Date.parse(now);
  const start =
    anchor + Math.max(0, Math.floor((time - anchor) / GAME_CENTER_WEEK_MS)) * GAME_CENTER_WEEK_MS;
  const week = {
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + GAME_CENTER_WEEK_MS).toISOString(),
  };
  const nationalNames = sql.join(
    NATIONAL_WINS.map((name) => sql`${name}`),
    sql`, `,
  );
  const [row] = await db
    .select({
      legendScore: sql<
        number | null
      >`max(case when ${isPublicRetired} then ${careers.legendScore} end)`,
      retired: sql<number>`coalesce(max(1), 0)`,
      europe: sql<number>`coalesce(max(${inArray(careerSeasons.league, ACHIEVEMENT_EUROPEAN_LEAGUES)}), 0)`,
      national: sql<number>`coalesce(max(exists (
        select 1 from json_each(case when json_valid(${careerSeasons.honorsJson})
          then ${careerSeasons.honorsJson} else '[]' end) as honor
        where honor.value in (${nationalNames})
      )), 0)`,
      ballon: sql<number>`coalesce(max(${careers.ballon} > 0), 0)`,
      goals: sql<number | null>`max(case when ${isPublicRetired} then ${careers.goals} end)`,
      assists: sql<number | null>`max(case when ${isPublicRetired} then ${careers.assists} end)`,
      weekly: sql<number | null>`max(case when ${isPublicRetired}
        and ${now} >= ${weeklyStart}
        and ${careers.retiredAt} >= ${week.startsAt} and ${careers.retiredAt} < ${week.endsAt}
        then ${careers.legendScore} end)`,
      maxGoals: sql<number>`coalesce(max(${careers.goals}), 0)`,
      maxAssists: sql<number>`coalesce(max(${careers.assists}), 0)`,
      maxTrophies: sql<number>`coalesce(max(${careers.trophies}), 0)`,
      maxBallon: sql<number>`coalesce(max(${careers.ballon}), 0)`,
      retirements: sql<number>`count(distinct case when ${isPublicRetired} then ${careers.id} end)`,
      retireAge: sql<number>`coalesce(max(${careers.retireAge}), 0)`,
    })
    // Public HOF predicates otherwise tempt SQLite into a global score-index scan.
    .from(sql`${careers} INDEXED BY careers_profile_status_legend_idx`)
    .leftJoin(careerSeasons, eq(careerSeasons.careerId, careers.id))
    .where(
      and(
        eq(careers.profileId, profileId),
        retiredLiteral,
        eq(careers.hidden, 0),
        gte(careers.legendScore, 0),
      ),
    );

  return { row, week };
}

function firstAchievements(row: Awaited<ReturnType<typeof loadProgress>>['row']) {
  const achievements: GameCenterAchievement[] = [];
  // Short careers can earn milestones, just like existing club achievements, but cannot rank in HOF.
  if (row?.retired) achievements.push('first_retirement');
  if (row?.europe) achievements.push('first_europe');
  if (row?.national) achievements.push('first_national_title');
  if (row?.ballon) achievements.push('first_ballon');
  return achievements;
}

/** Build 30 has a strict four-achievement schema. Preserve it after the catalog grows. */
export async function gameCenterProgress(db: Db, profileId: string): Promise<GameCenterProgress> {
  const { row } = await loadProgress(db, profileId, new Date().toISOString());
  return { profileId, legendScore: row?.legendScore ?? null, achievements: firstAchievements(row) };
}

export async function gameCenterExpandedProgress(
  db: Db,
  profileId: string,
  now: string,
): Promise<GameCenterExpandedProgress> {
  const { row, week } = await loadProgress(db, profileId, now);
  return expandedProgress(row, week, profileId);
}

function expandedProgress(
  row: Awaited<ReturnType<typeof loadProgress>>['row'],
  week: GameCenterExpandedProgress['week'],
  profileId: string,
): GameCenterExpandedProgress {
  const achievements: GameCenterExpandedProgress['achievements'] = firstAchievements(row);
  if ((row?.maxGoals ?? 0) >= 100) achievements.push('career_goals_100');
  if ((row?.maxGoals ?? 0) >= 300) achievements.push('career_goals_300');
  if ((row?.maxAssists ?? 0) >= 100) achievements.push('career_assists_100');
  if ((row?.maxAssists ?? 0) >= 200) achievements.push('career_assists_200');
  if ((row?.maxTrophies ?? 0) >= 10) achievements.push('career_trophies_10');
  if ((row?.maxBallon ?? 0) >= 3) achievements.push('career_ballon_3');
  if ((row?.retirements ?? 0) >= 5) achievements.push('retirements_5');
  if ((row?.retireAge ?? 0) >= 40) achievements.push('veteran_40');
  return {
    profileId,
    scores: {
      legend: row?.legendScore ?? null,
      career_goals: row?.goals ?? null,
      career_assists: row?.assists ?? null,
      weekly_legend: row?.weekly ?? null,
    },
    week,
    achievements,
  };
}

/** Same indexed snapshot for both providers; their native weekly reset boundaries differ. */
export async function gameServicesProgress(
  db: Db,
  profileId: string,
  now: string,
  provider: 'game-center' | 'play-games',
): Promise<GameServicesProgress> {
  const { row, week } = await loadProgress(
    db,
    profileId,
    now,
    provider === 'play-games' ? PLAY_GAMES_WEEKLY_START : GAME_CENTER_WEEKLY_START,
  );
  const data = expandedProgress(row, week, profileId);
  const achievements: GameServicesProgress['achievements'] = [...data.achievements];
  if ((row?.maxGoals ?? 0) >= 750) achievements.push('career_goals_750');
  if ((row?.maxGoals ?? 0) >= 1000) achievements.push('career_goals_1000');
  if ((row?.maxAssists ?? 0) >= 500) achievements.push('career_assists_500');
  if ((row?.maxTrophies ?? 0) >= 50) achievements.push('career_trophies_50');
  if ((row?.maxBallon ?? 0) >= 10) achievements.push('career_ballon_10');
  if ((row?.retirements ?? 0) >= 50) achievements.push('retirements_50');
  return { ...data, achievements };
}
