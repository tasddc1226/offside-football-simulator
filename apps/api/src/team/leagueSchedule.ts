import {
  leagueSeasonAt,
  planLeague,
  planLeagueCycle,
  leagueFinalAt,
  leagueNextCycleStartsAt,
  LEAGUE_AFTERGLOW_MS,
  LEAGUE_INDEPENDENT_FROM,
  LEAGUE_LEGACY_SEASON,
  LEAGUE_ROUNDS,
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
  // T-11-828 운영자가 미뤄 굳힌 시즌 2 행도 28라운드에서 끝낸다(planLeague와 같은 상한).
  rounds: (JSON.parse(row.roundsJson) as string[]).slice(
    0,
    row.teamSeason === null && row.season === LEAGUE_LEGACY_SEASON ? LEAGUE_ROUNDS : undefined,
  ),
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
    const startsAt = leagueNextCycleStartsAt(current, state.doneAt);
    const next = planLeagueCycle(current.season + 1, startsAt, current.teamSeason!);
    next.teamSeason = displaySeasonAt(next.drawAt);
    return next;
  }
  const season = leagueSeasonAt(now);
  if (!season) return undefined;
  // Legacy season 2 keeps its service-bound schedule and any operator delay, capped at 28 rounds (T-11-828).
  if (season.id < LEAGUE_INDEPENDENT_FROM) {
    const row = latest?.season === season.id ? latest : undefined;
    return row ? fromRow(row) : planLeague(season.id, season.startsAt, season.endsAt);
  }
  // The first independent edition follows season 2 like any other edition, or waits for season 3 if that opens first.
  const anchor = SERVICE_SEASONS.find((s) => s.id === LEAGUE_INDEPENDENT_FROM) ?? season;
  const [pendingLegacy] = await db
    .select()
    .from(leagueState)
    .where(eq(leagueState.season, LEAGUE_LEGACY_SEASON))
    .limit(1);
  const old = SERVICE_SEASONS.find((s) => s.id === LEAGUE_LEGACY_SEASON);
  const legacy =
    pendingLegacy && old
      ? latest?.season === old.id
        ? fromRow(latest)
        : planLeague(old.id, old.startsAt, old.endsAt)
      : undefined;
  if (legacy && !pendingLegacy!.doneAt) return legacy;
  // T-11-828 시즌 2 리그가 서비스 시즌보다 먼저 끝나면 제3기는 개막을 기다리지 않고 다른 회차처럼 이틀 뒤 잇는다.
  // 그때 서비스 시즌 팀(시즌 2)으로 배치하고, 시즌 3 개막 준비 기간(5일)은 쓰지 않는다.
  const chainedAt = legacy ? leagueNextCycleStartsAt(legacy, pendingLegacy!.doneAt) : null;
  let first: LeagueDef;
  if (chainedAt && chainedAt < anchor.startsAt) {
    first = planLeagueCycle(LEAGUE_INDEPENDENT_FROM, chainedAt, LEAGUE_LEGACY_SEASON);
    first.teamSeason = displaySeasonAt(first.drawAt);
  } else first = planLeagueCycle(LEAGUE_INDEPENDENT_FROM, anchor.startsAt, anchor.id, true);
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
