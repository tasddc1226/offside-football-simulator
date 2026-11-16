import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  ACHIEVEMENT_EUROPEAN_LEAGUES,
  type GameCenterAchievement,
  type GameCenterProgress,
} from '@offside/contracts/game-center';
import { NATIONAL_WINS } from '@offside/contracts/nations';
import type { Db } from '../client.js';
import { careers, careerSeasons } from '../schema.js';
import { isPublicRetired, retiredLiteral } from './careers.js';

/** One indexed owner scan across seasons. No player details, R2 reads or per-career queries. */
export async function gameCenterProgress(db: Db, profileId: string): Promise<GameCenterProgress> {
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

  const achievements: GameCenterAchievement[] = [];
  const legendScore = row?.legendScore ?? null;
  // Short careers can earn milestones, just like existing club achievements, but cannot rank in HOF.
  if (row?.retired) achievements.push('first_retirement');
  if (row?.europe) achievements.push('first_europe');
  if (row?.national) achievements.push('first_national_title');
  if (row?.ballon) achievements.push('first_ballon');
  return { profileId, legendScore, achievements };
}
