import {
  leagueSeasonAt,
  planLeague,
  planLeagueCycle,
  leagueFinalAt,
  LEAGUE_AFTERGLOW_MS,
  LEAGUE_INDEPENDENT_FROM,
  type LeagueDef,
} from '@offside/contracts/league';
import { displaySeasonAt, SERVICE_SEASONS } from '@offside/contracts/service-seasons';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { leagueSeasons, leagueState } from '../db/schema.js';

const fromRow = (row: typeof leagueSeasons.$inferSelect): LeagueDef => ({
  season: row.season,
  ...(row.teamSeason === null ? {} : { teamSeason: row.teamSeason }),
  startsAt: row.startsAt,
  opensAt: row.opensAt,
  closesAt: row.closesAt,
  drawAt: row.drawAt,
  rounds: JSON.parse(row.roundsJson) as string[],
  minFilled: row.minFilled,
});

/** Read only. Competition IDs and card seasons diverge from league season 3 onward. */
export async function currentLeague(db: Db, now: string): Promise<LeagueDef | undefined> {
  // The PK supplies the latest edition without scanning match or entry rows.
  const [latest] = await db
    .select()
    .from(leagueSeasons)
    .orderBy(desc(leagueSeasons.season))
    .limit(1);
  if (latest?.teamSeason !== null && latest?.teamSeason !== undefined) {
    const current = fromRow(latest);
    const [state] = await db
      .select({ doneAt: leagueState.doneAt })
      .from(leagueState)
      .where(eq(leagueState.season, latest.season))
      .limit(1);
    // Never hide a delayed settlement or skip its notifications when cron catches up.
    if (!state?.doneAt) return current;
    // A draw with no tiers settles at once; count its result day from that settlement, not the planned final.
    const endedAt = Math.min(Date.parse(leagueFinalAt(current)), Date.parse(state.doneAt));
    if (Date.parse(now) < endedAt + LEAGUE_AFTERGLOW_MS) return current;
    const lastDay = Math.min(Date.parse(current.rounds.at(-1)!), Date.parse(state.doneAt));
    const startsAt = new Date(lastDay + 2 * 86_400_000).toISOString();
    const next = planLeagueCycle(current.season + 1, startsAt, current.teamSeason!);
    next.teamSeason = displaySeasonAt(next.drawAt);
    return next;
  }
  const season = leagueSeasonAt(now);
  if (!season) return undefined;
  // Legacy season 2 keeps its service-bound schedule and any operator delay.
  if (season.id < LEAGUE_INDEPENDENT_FROM) {
    const row = latest?.season === season.id ? latest : undefined;
    return row ? fromRow(row) : planLeague(season.id, season.startsAt, season.endsAt);
  }
  // Only the first independent edition uses the service opening/team preparation window.
  const anchor = SERVICE_SEASONS.find((s) => s.id === LEAGUE_INDEPENDENT_FROM) ?? season;
  const [pendingLegacy] = await db
    .select()
    .from(leagueState)
    .where(eq(leagueState.season, LEAGUE_INDEPENDENT_FROM - 1))
    .limit(1);
  if (pendingLegacy && !pendingLegacy.doneAt) {
    const old = SERVICE_SEASONS.find((s) => s.id === LEAGUE_INDEPENDENT_FROM - 1)!;
    return latest?.season === old.id
      ? fromRow(latest)
      : planLeague(old.id, old.startsAt, old.endsAt);
  }
  const first = planLeagueCycle(LEAGUE_INDEPENDENT_FROM, anchor.startsAt, anchor.id, true);
  return latest?.season === first.season ? fromRow(latest) : first;
}

/** Cron/admin write only: pin the selected card season and full schedule before the draw. */
export async function saveLeagueCycle(db: Db, league: LeagueDef, now: string) {
  if (league.teamSeason === undefined) return;
  const [stored] = await db
    .select({ season: leagueSeasons.season })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.season, league.season))
    .limit(1);
  if (stored) return;
  await db
    .insert(leagueSeasons)
    .values({
      season: league.season,
      teamSeason: league.teamSeason,
      startsAt: league.startsAt,
      opensAt: league.opensAt,
      closesAt: league.closesAt,
      drawAt: league.drawAt,
      roundsJson: JSON.stringify(league.rounds),
      minFilled: league.minFilled,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}
