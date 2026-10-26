import { leagueSeasonAt, planLeague, type LeagueDef } from '@offside/contracts/league';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { leagueSeasons } from '../db/schema.js';

// T-11-418 리그 일정. 시즌 개막으로 기본 일정(planLeague)을 만들고, 운영 도구로 미룬 시즌은 league_seasons 행을 쓴다.
// 행은 시즌마다 하나라 요청마다 읽는다(기본 키 조회 한 번).

/** now에 보여 줄 리그 일정. 리그를 여는 시즌이 아직 일정에 없으면 undefined. */
export async function currentLeague(db: Db, now: string): Promise<LeagueDef | undefined> {
  const season = leagueSeasonAt(now);
  if (!season) return undefined;
  const [row] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.season, season.id))
    .limit(1);
  if (!row) return planLeague(season.id, season.startsAt);
  return {
    season: row.season,
    startsAt: row.startsAt,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    drawAt: row.drawAt,
    rounds: JSON.parse(row.roundsJson) as string[],
    minFilled: row.minFilled,
  };
}
