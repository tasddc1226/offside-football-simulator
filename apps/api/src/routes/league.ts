import {
  LeagueMatchResponseSchema,
  LeagueMeResponseSchema,
  LeagueResponseSchema,
  LeagueTableResponseSchema,
  type LeagueDef,
  type LeagueMeResponse,
  type LeagueResponse,
} from '@offside/contracts';
import {
  LEAGUE_FROM_SEASON,
  LEAGUE_LATE_MAX_LEAGUES,
  leagueNextLate,
  leagueNextTier,
  leaguePhase,
  leagueReward,
  type LeagueOutcome,
} from '@offside/contracts/league';
import { displaySeasonAt } from '@offside/contracts/service-seasons';
import { and, count, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { Context, Hono } from 'hono';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import {
  logoOf,
  myTeamIn,
  publicNamesOf,
  teamLogosByIds,
  type MatchDetail,
} from '../db/repos/ownerTeams.js';
import { leagueEntries, leagueMatches, ownerTeams } from '../db/schema.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import {
  inLeague,
  leagueFinalGoals,
  leagueMatchesOf,
  leagueScorers,
  leagueStateOf,
  leagueTable,
  playedRounds,
  tiersOf,
  type LeagueEntryRow,
} from '../team/league.js';
import { currentLeague } from '../team/leagueSchedule.js';
import { lineupsOf, toMatch } from '../team/match.js';
import { reqLang } from '../lang.js';
import { filledCount } from '../team/sim.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok } from './shared.js';

// T-11-418 오프사이드 리그: 일정 · 접수(사전 신청 포함 · 취소 · 준비 상태). T-11-418b 배치 결과 · 순위표 · 경기 상세.
// 오류 문구는 컵과 같은 문장이라 컵 서버 문구(cupKo)를 그대로 쓴다 — 영어 · 일본어도 컵 표로 옮겨진다.

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=30';
/** 배치 뒤 부 · 리그 번호의 상한(캐시 키가 무한히 늘지 않게, 배치 결과로 다시 검사한다). */
const MAX_TIER = 12;

const intParam = (v: string | undefined, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
};

/** 내 배치 결과(배치 전 · 신청 없음은 null). 리그에 들어갔으면 지금 순위. */
async function placementOf(
  db: Db,
  season: number,
  mine: LeagueEntryRow | undefined,
): Promise<LeagueMeResponse['placement']> {
  if (!mine || (mine.status === 'active' && mine.tier === null)) return null;
  // T-11-430 배치가 팀 기록을 남긴 dropped는 자격은 갖췄지만 리그를 꾸리고 남은 신청이다(drawLeague).
  if (mine.status === 'dropped')
    return {
      status: 'dropped',
      tier: null,
      league: null,
      teamId: null,
      rank: null,
      reason: mine.teamId ? 'capacity' : 'short',
    };
  if (!inLeague(mine)) return null;
  // T-11-418e 결산이 끝났으면 저장한 최종 순위 · 결과로(순위표를 다시 세지 않는다).
  if (mine.outcome && mine.finalRank !== null) {
    const outcome = mine.outcome as LeagueOutcome;
    return {
      status: mine.status === 'forfeited' ? 'forfeited' : 'placed',
      tier: mine.tier,
      league: mine.leagueNo,
      teamId: mine.teamId,
      rank: mine.finalRank,
      forfeits: mine.forfeits,
      final: {
        rank: mine.finalRank,
        outcome,
        ...leagueReward(mine.tier!, mine.finalRank, mine.forfeits, outcome),
        nextTier: leagueNextTier(mine.tier!, outcome),
      },
    };
  }
  const [[state], entries, matches] = await Promise.all([
    leagueStateOf(db, season),
    db
      .select()
      .from(leagueEntries)
      .where(
        and(
          eq(leagueEntries.season, season),
          eq(leagueEntries.tier, mine.tier!),
          eq(leagueEntries.leagueNo, mine.leagueNo!),
        ),
      ),
    leagueMatchesOf(db, season, mine.tier!, mine.leagueNo!),
  ]);
  const rank = state
    ? (leagueTable(entries, matches, state.seed, mine.tier!, mine.leagueNo!).find(
        (s) => s.teamId === mine.teamId,
      )?.rank ?? null)
    : null;
  return {
    status: mine.status === 'forfeited' ? 'forfeited' : 'placed',
    tier: mine.tier,
    league: mine.leagueNo,
    teamId: mine.teamId,
    rank,
    forfeits: mine.forfeits,
  };
}

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
  const filled = filledCount(
    (await lineupsOf(db, league.season, team, team, { coaches: false })).home,
  );
  return { teamId: team.id, filled, ovr: team.ovr };
}

/**
 * T-11-430 그 시즌 팀이 아직 없을 때(사전 신청 기간) 지금 시즌 내 팀의 선발 실카드 수. 자격 안내의 참고값이라 그 시즌
 * 팀이 있으면 묻지 않는다.
 */
async function lastTeamOf(db: Db, league: LeagueDef, profileId: string, now: string) {
  const season = displaySeasonAt(now);
  if (season >= league.season) return null;
  const [team] = await myTeamIn(db, profileId, season);
  if (!team) return null;
  const filled = filledCount((await lineupsOf(db, season, team, team, { coaches: false })).home);
  return { season, filled };
}

/**
 * T-11-444 지난 시즌 내 결산(이번 시즌 배치 전에만 묻는다). 결산이 끝난 신청 행만(기본 키 한 줄 조회), 없으면 undefined라
 * 응답에서 빠진다.
 */
async function lastFinalOf(db: Db, league: LeagueDef, profileId: string, now: string) {
  const season = league.season - 1;
  if (now >= league.drawAt || season < LEAGUE_FROM_SEASON) return undefined;
  const [row] = await mineOf(db, season, profileId);
  if (!row?.outcome || row.finalRank === null || row.tier === null || row.leagueNo === null)
    return undefined;
  const outcome = row.outcome as LeagueOutcome;
  return {
    season,
    tier: row.tier,
    league: row.leagueNo,
    rank: row.finalRank,
    outcome,
    nextTier: leagueNextTier(row.tier, outcome),
  };
}

/**
 * T-11-564 늦은 참가를 받는 다음 배치(첫 배치를 마쳤고 리그가 열렸으며 남은 늦은 배치가 있을 때만). 첫 배치 전 · 리그가 열리지
 * 않은 시즌 · 남은 배치 없음은 null.
 */
async function lateOf(db: Db, league: LeagueDef, now: string) {
  const slot = leagueNextLate(league, now);
  if (!slot) return null;
  const [state] = await leagueStateOf(db, league.season);
  return state && !state.doneAt && tiersOf(state).length ? slot : null;
}

/** 늦은 참가로 신청할 수 있는 내 신청 상태: 신청 없음 · 취소함 · 배치에서 빠짐. */
const lateCanEnter = (mine: LeagueEntryRow | undefined) => !mine || mine.status === 'dropped';
/** 늦은 참가 신청이 다음 배치를 기다리는 중(아직 리그에 들지 않음). */
const lateWaiting = (mine: LeagueEntryRow | undefined) =>
  mine?.status === 'active' && mine.tier === null;

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
      const db = getDb(c);
      const [state] = await leagueStateOf(db, league.season);
      const base = { league: toInfo(league), phase: leaguePhase(league, now) };
      if (state) {
        const tiers = tiersOf(state);
        return {
          ...base,
          entries: tiers.reduce((a, t) => a + t.teams, 0),
          tiers,
          playedRounds: await playedRounds(db, league.season),
        };
      }
      const [row] = await db
        .select({ n: count() })
        .from(leagueEntries)
        .where(and(eq(leagueEntries.season, league.season), ne(leagueEntries.status, 'withdrawn')));
      return { ...base, entries: row?.n ?? 0 };
    });
    return ok(c, LeagueResponseSchema, data, 200, PUBLIC_CACHE);
  });

  // 내 신청 · 준비 상태(그 시즌 팀의 선발 실카드 수).
  app.get('/v1/leagues/current/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const league = await leagueOf(c, now);
    const [[mine], team, lastFinal, late] = await Promise.all([
      mineOf(db, league.season, me.id),
      teamNow(db, league, me.id),
      lastFinalOf(db, league, me.id, now),
      lateOf(db, league, now),
    ]);
    return ok(
      c,
      LeagueMeResponseSchema,
      {
        entry: mine ? { createdAt: mine.createdAt } : null,
        canEnter: late ? lateCanEnter(mine) : !mine && leaguePhase(league, now) === 'open',
        lateDrawAt: late && (lateCanEnter(mine) || lateWaiting(mine)) ? late.at : null,
        team,
        lastTeam: team || now >= league.closesAt ? null : await lastTeamOf(db, league, me.id, now),
        placement: now < league.drawAt ? null : await placementOf(db, league.season, mine),
        ...(lastFinal ? { lastFinal } : {}),
      },
      200,
      NO_STORE,
    );
  });

  // 신청(접수 기간만, 정원 없음). 참가 의사만 남긴다 — 개막 전 사전 신청은 그 시즌 팀이 아직 없어서 팀은 배치 때 본다.
  // 이미 신청했으면 그대로 돌려준다(자연 멱등). 취소했던 신청은 되살린다. T-11-564 리그가 시작한 뒤에는 늦은 참가로 받아
  // 다음 늦은 배치를 기다리게 한다(배치에서 빠졌던 신청도 다시 받는다).
  app.post('/v1/leagues/current/entries', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const league = await leagueOf(c, now);
    if (leaguePhase(league, now) !== 'open') {
      if (!(await lateOf(db, league, now))) throw conflictError(cupKo('closed'), 'LEAGUE_CLOSED');
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
          set: {
            status: 'active',
            teamId: null,
            name: null,
            manager: null,
            ovr: null,
            tier: null,
            leagueNo: null,
            notifiedRound: 0,
            createdAt: now,
            updatedAt: now,
          },
          // 리그에서 뛰는 중이거나 이미 기다리는 신청은 그대로 둔다.
          setWhere: inArray(leagueEntries.status, ['withdrawn', 'dropped']),
        });
      return c.body(null, 204);
    }
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
    if (leaguePhase(league, now) !== 'open') {
      // T-11-564 늦은 참가는 다음 배치에 들기 전(배치 시간 전)까지만 취소할 수 있다.
      const late = await lateOf(db, league, now);
      if (!late || now >= late.at) throw conflictError(cupKo('withdrawClosed'), 'LEAGUE_CLOSED');
      await db
        .update(leagueEntries)
        .set({ status: 'withdrawn', updatedAt: now })
        .where(
          and(
            eq(leagueEntries.season, league.season),
            eq(leagueEntries.profileId, me.id),
            eq(leagueEntries.status, 'active'),
            isNull(leagueEntries.tier),
          ),
        );
      return c.body(null, 204);
    }
    await db
      .update(leagueEntries)
      .set({ status: 'withdrawn', updatedAt: now })
      .where(and(eq(leagueEntries.season, league.season), eq(leagueEntries.profileId, me.id)));
    return c.body(null, 204);
  });

  // T-11-418b 리그 하나: 팀 · 순위표 · 14라운드 경기. 누구나 본다(엣지 60초). 팀 이름 · 감독 · 로고는 지금 팀 기준(없어졌으면
  // 배치 때 값).
  app.get('/v1/leagues/:season/tables/:tier/:league', async (c) => {
    const season = intParam(c.req.param('season'), 999);
    const tier = intParam(c.req.param('tier'), MAX_TIER);
    // T-11-564 늦은 참가 리그가 맨 아래 부에 더해질 수 있다.
    const no = tier
      ? intParam(c.req.param('league'), 2 ** (tier - 1) + LEAGUE_LATE_MAX_LEAGUES)
      : null;
    if (!season || !tier || !no) throw notFoundError(cupKo('notFound'), 'LEAGUE_NOT_FOUND');
    const data = await edgeCached(c, EDGE.leagueTable(season, tier, no), 60, async () => {
      const db = getDb(c);
      const [[state], entries, matches] = await Promise.all([
        leagueStateOf(db, season),
        db
          .select()
          .from(leagueEntries)
          .where(
            and(
              eq(leagueEntries.season, season),
              eq(leagueEntries.tier, tier),
              eq(leagueEntries.leagueNo, no),
            ),
          ),
        leagueMatchesOf(db, season, tier, no),
      ]);
      const members = entries.filter(inLeague);
      if (!state || !members.length) throw notFoundError(cupKo('notFound'), 'LEAGUE_NOT_FOUND');
      // T-11-418d 득점 순위는 골이 하나라도 있어야, 마지막 라운드 골 시각은 그 라운드를 치른 뒤에만 읽는다.
      const anyPlayed = matches.some((m) => m.playedAt && !m.forfeit);
      // T-11-540 마지막 라운드는 시즌 길이에 따라 달라 일정에 남은 가장 큰 라운드로 본다.
      const finalRound = Math.max(0, ...matches.map((m) => m.round));
      const finalPlayed = matches.some((m) => m.round === finalRound && m.playedAt);
      const [scorers, finalGoals] = await Promise.all([
        anyPlayed ? leagueScorers(db, season, tier, no) : [],
        finalPlayed ? leagueFinalGoals(db, season, tier, no) : new Map<string, never[]>(),
      ]);
      const live = new Map(
        (
          await db
            .select({
              id: ownerTeams.id,
              name: ownerTeams.name,
              manager: ownerTeams.manager,
              ovr: ownerTeams.ovr,
              logoJson: ownerTeams.logoJson,
            })
            .from(ownerTeams)
            .where(
              inArray(
                ownerTeams.id,
                members.map((e) => e.teamId!),
              ),
            )
        ).map((t) => [t.id, t]),
      );
      return {
        season,
        tier,
        league: no,
        teams: members.map((e) => {
          const t = live.get(e.teamId!);
          return {
            teamId: e.teamId!,
            name: t?.name ?? e.name ?? '-',
            owner: t?.manager ?? e.manager ?? '-',
            logo: t ? logoOf(t) : null,
            ovr: t?.ovr ?? e.ovr ?? 0,
          };
        }),
        standings: leagueTable(entries, matches, state.seed, tier, no),
        matches: matches.map((m) => ({
          id: m.id,
          round: m.round,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          at: m.at,
          played: !!m.playedAt,
          homeGoals: m.playedAt ? m.homeGoals : null,
          awayGoals: m.playedAt ? m.awayGoals : null,
          forfeit: m.forfeit !== 0,
          ...(m.round === finalRound && m.playedAt && !m.forfeit
            ? { goals: finalGoals.get(m.id) ?? [] }
            : {}),
        })),
        scorers,
      };
    });
    return ok(c, LeagueTableResponseSchema, data, 200, 'public, max-age=0, s-maxage=60');
  });

  // T-11-418b 리그 경기 상세(득점 기록). 누구나 본다. 선수 이름은 공개 이름 · 익명.
  app.get('/v1/leagues/:season/matches/:matchId', async (c) => {
    const db = getDb(c);
    const season = intParam(c.req.param('season'), 999);
    const [m] = season
      ? await db
          .select()
          .from(leagueMatches)
          .where(
            and(eq(leagueMatches.season, season), eq(leagueMatches.id, c.req.param('matchId'))),
          )
          .limit(1)
      : [];
    if (!m || !m.playedAt || !m.detailJson)
      throw notFoundError(cupKo('matchNotFound'), 'LEAGUE_MATCH_NOT_FOUND');
    const d = JSON.parse(m.detailJson) as MatchDetail;
    const ids = d.events
      .flatMap((e) => [e.scorer.careerId, e.assist?.careerId])
      .filter((x): x is string => !!x);
    const [names, logos] = await Promise.all([
      publicNamesOf(db, [...new Set(ids)]),
      teamLogosByIds(db, [d.home.teamId, d.away.teamId]),
    ]);
    const match = toMatch(
      {
        id: m.id,
        homeTeamId: d.home.teamId,
        homeGoals: m.homeGoals ?? 0,
        awayGoals: m.awayGoals ?? 0,
        createdAt: m.playedAt,
      },
      d,
      d.home.teamId,
      names,
      logos,
      reqLang(c),
    );
    // 공개 화면이라 '내 쪽' 선수 id를 보내지 않는다.
    match.events = match.events.map((e) => ({ ...e, scorerId: null, assistId: null }));
    return ok(
      c,
      LeagueMatchResponseSchema,
      {
        match,
        league: { tier: m.tier, league: m.leagueNo, round: m.round, forfeit: m.forfeit !== 0 },
      },
      200,
      PUBLIC_CACHE,
    );
  });
}
