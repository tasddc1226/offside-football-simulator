import { AdminLeagueDelaySchema, AdminLeagueSchema } from '@offside/contracts';
import { leaguePhase, type LeagueDef } from '@offside/contracts/league';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import { cupKo } from '../cupText.js';
import { purgeEdge } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import type { Db } from '../db/client.js';
import { leagueSeasons } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { leagueStateOf, playedRounds } from '../team/league.js';
import { currentLeague } from '../team/leagueSchedule.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-418b 오프사이드 리그 운영 도구: 지금 리그 상태 보기, 배치 전 일정 미루기(2차 배포가 늦거나 문제가 생겼을 때의
// 안전판). 미룬 일정은 league_seasons 행으로 남아 기본 일정(planLeague)보다 먼저 쓰인다. 라운드 수는 줄이지 않는다.

const shift = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * 86_400_000).toISOString();

async function adminView(db: Db, league: LeagueDef, now: string) {
  const d1 = db.$client;
  const [[state], [row], counts, overdue] = await Promise.all([
    leagueStateOf(db, league.season),
    db
      .select({ season: leagueSeasons.season })
      .from(leagueSeasons)
      .where(eq(leagueSeasons.season, league.season)),
    d1
      .prepare(
        `SELECT SUM(status <> 'withdrawn') AS entries, SUM(status IN ('active', 'forfeited') AND tier IS NOT NULL) AS placed,
           SUM(status = 'dropped') AS dropped, SUM(status = 'forfeited') AS forfeited
         FROM league_entries WHERE season = ?`,
      )
      .bind(league.season)
      .first<Record<'entries' | 'placed' | 'dropped' | 'forfeited', number | null>>(),
    d1
      .prepare(
        'SELECT COUNT(*) AS n FROM league_matches WHERE season = ? AND played_at IS NULL AND at <= ?',
      )
      .bind(league.season, now)
      .first<{ n: number }>(),
  ]);
  return {
    league: {
      season: league.season,
      startsAt: league.startsAt,
      opensAt: league.opensAt,
      closesAt: league.closesAt,
      drawAt: league.drawAt,
      rounds: [...league.rounds],
      minFilled: league.minFilled,
    },
    phase: leaguePhase(league, now),
    delayed: !!row,
    counts: {
      entries: counts?.entries ?? 0,
      placed: counts?.placed ?? 0,
      dropped: counts?.dropped ?? 0,
      forfeited: counts?.forfeited ?? 0,
    },
    drawnAt: state?.drawnAt ?? null,
    doneAt: state?.doneAt ?? null,
    playedRounds: state ? await playedRounds(db, league.season) : 0,
    overdue: overdue?.n ?? 0,
  };
}

export function registerAdminLeagueRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/admin/leagues/current', async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const now = nowIso();
    const league = await currentLeague(db, now);
    if (!league) throw notFoundError(cupKo('notFound'), 'LEAGUE_NOT_FOUND');
    return ok(c, AdminLeagueSchema, await adminView(db, league, now), 200, NO_STORE);
  });

  // 배치 전에만: 접수 마감 · 배치 · 모든 라운드를 days일 뒤로. 여러 번 미루면 쌓인다.
  app.post('/v1/admin/leagues/current/delay', async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const { days } = readBody(c, AdminLeagueDelaySchema);
    const now = nowIso();
    const league = await currentLeague(db, now);
    if (!league) throw notFoundError(cupKo('notFound'), 'LEAGUE_NOT_FOUND');
    const [state] = await leagueStateOf(db, league.season);
    if (state || now >= league.drawAt)
      throw conflictError(cupKo('leagueDrawn'), 'LEAGUE_ALREADY_DRAWN');
    const values = {
      startsAt: league.startsAt,
      opensAt: league.opensAt,
      closesAt: shift(league.closesAt, days),
      drawAt: shift(league.drawAt, days),
      roundsJson: JSON.stringify(league.rounds.map((r) => shift(r, days))),
      minFilled: league.minFilled,
      updatedAt: now,
    };
    await db
      .insert(leagueSeasons)
      .values({ season: league.season, ...values, createdAt: now })
      .onConflictDoUpdate({ target: leagueSeasons.season, set: values });
    // 공개 일정(엣지 30초)도 바로 새 일정을 보게 한다.
    purgeEdge(c, [EDGE.leagueCurrent]);
    const next = await currentLeague(db, now);
    return ok(c, AdminLeagueSchema, await adminView(db, next!, now), 200, NO_STORE);
  });
}
