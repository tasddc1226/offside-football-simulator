import {
  LeagueMeResponseSchema,
  LeagueResponseSchema,
  type LeagueDef,
  type LeagueResponse,
} from '@offside/contracts';
import { leaguePhase } from '@offside/contracts/league';
import { and, count, eq, ne } from 'drizzle-orm';
import type { Context, Hono } from 'hono';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import { myTeamIn } from '../db/repos/ownerTeams.js';
import { leagueEntries } from '../db/schema.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { currentLeague } from '../team/leagueSchedule.js';
import { lineupsOf } from '../team/match.js';
import { filledCount } from '../team/sim.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok } from './shared.js';

// T-11-418 오프사이드 리그 1차: 일정 · 접수(사전 신청 포함 · 취소 · 준비 상태). 배치 · 경기 · 순위표는 다음 배포에서 더한다.
// 오류 문구는 컵과 같은 문장이라 컵 서버 문구(cupKo)를 그대로 쓴다 — 영어 · 일본어도 컵 표로 옮겨진다.

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=30';

const leagueOf = async (c: Context<AppEnv>, now: string) => {
  const league = await currentLeague(getDb(c), now);
  if (!league) throw notFoundError(cupKo('notFound'), 'LEAGUE_NOT_FOUND');
  return league;
};

const toInfo = (l: LeagueDef): LeagueResponse['league'] => ({
  season: l.season,
  startsAt: l.startsAt,
  opensAt: l.opensAt,
  closesAt: l.closesAt,
  drawAt: l.drawAt,
  rounds: [...l.rounds],
  minFilled: l.minFilled,
});

/** 지금 그 시즌 내 팀과 선발 실카드 수(팀이 없으면 null). 배치 때 같은 기준으로 자격을 본다(2차). */
async function teamNow(db: Db, league: LeagueDef, profileId: string) {
  const [team] = await myTeamIn(db, profileId, league.season);
  if (!team) return null;
  const filled = filledCount((await lineupsOf(db, league.season, team, team)).home);
  return { teamId: team.id, filled, ovr: team.ovr };
}

const mineOf = (db: Db, season: number, profileId: string) =>
  db
    .select()
    .from(leagueEntries)
    .where(
      and(
        eq(leagueEntries.season, season),
        eq(leagueEntries.profileId, profileId),
        ne(leagueEntries.status, 'withdrawn'),
      ),
    )
    .limit(1);

export function registerLeagueRoutes(app: Hono<AppEnv>): void {
  // 리그 한눈에: 일정 · 단계 · 신청 수. 누구나 본다(엣지 30초).
  app.get('/v1/leagues/current', async (c) => {
    const data = await edgeCached(c, EDGE.leagueCurrent, 30, async () => {
      const now = nowIso();
      const league = await leagueOf(c, now);
      const [row] = await getDb(c)
        .select({ n: count() })
        .from(leagueEntries)
        .where(and(eq(leagueEntries.season, league.season), ne(leagueEntries.status, 'withdrawn')));
      return { league: toInfo(league), phase: leaguePhase(league, now), entries: row?.n ?? 0 };
    });
    return ok(c, LeagueResponseSchema, data, 200, PUBLIC_CACHE);
  });

  // 내 신청 · 준비 상태(그 시즌 팀의 선발 실카드 수).
  app.get('/v1/leagues/current/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const league = await leagueOf(c, now);
    const [[mine], team] = await Promise.all([
      mineOf(db, league.season, me.id),
      teamNow(db, league, me.id),
    ]);
    return ok(
      c,
      LeagueMeResponseSchema,
      {
        entry: mine ? { createdAt: mine.createdAt } : null,
        canEnter: !mine && leaguePhase(league, now) === 'open',
        team,
      },
      200,
      NO_STORE,
    );
  });

  // 신청(접수 기간만, 정원 없음). 참가 의사만 남긴다 — 개막 전 사전 신청은 그 시즌 팀이 아직 없어서 팀은 배치 때 본다.
  // 이미 신청했으면 그대로 돌려준다(자연 멱등). 취소했던 신청은 되살린다.
  app.post('/v1/leagues/current/entries', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const league = await leagueOf(c, now);
    if (leaguePhase(league, now) !== 'open') throw conflictError(cupKo('closed'), 'LEAGUE_CLOSED');
    await db
      .insert(leagueEntries)
      .values({
        season: league.season,
        profileId: me.id,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [leagueEntries.season, leagueEntries.profileId],
        set: { status: 'active', createdAt: now, updatedAt: now },
        // 이미 신청 중이면 신청 시각을 그대로 둔다.
        setWhere: eq(leagueEntries.status, 'withdrawn'),
      });
    return c.body(null, 204);
  });

  // 신청 취소(접수 기간만).
  app.delete('/v1/leagues/current/entries/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const league = await leagueOf(c, now);
    if (leaguePhase(league, now) !== 'open')
      throw conflictError(cupKo('withdrawClosed'), 'LEAGUE_CLOSED');
    await db
      .update(leagueEntries)
      .set({ status: 'withdrawn', updatedAt: now })
      .where(and(eq(leagueEntries.season, league.season), eq(leagueEntries.profileId, me.id)));
    return c.body(null, 204);
  });
}
