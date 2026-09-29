import {
  ClubAchievementsResponseSchema,
  OwnerTeamResponseSchema,
  PlayTeamMatchBodySchema,
  PlayTeamMatchResponseSchema,
  PutOwnerTeamBodySchema,
  PutOwnerTeamResponseSchema,
  TeamMatchesResponseSchema,
  TeamOpponentsResponseSchema,
  type OwnerTeam,
  type TeamMatch,
  type TeamOpponent,
} from '@offside/contracts';
import { isAcceptablePublicName, isReservedNickname } from '@offside/contracts/content-filter';
import {
  TEAM_MATCHES_PER_DAY,
  TEAM_REPEAT_WINDOW_DAYS,
  matchScore,
  ratingChange,
  type FormationId,
} from '@offside/contracts/owner-team';
import { detailPosInSeason } from '@offside/contracts/positions';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { NO_STORE, nowIso, ok, readBody, teamNotFound, teamSeasonParam } from './shared.js';
import { newId } from '../db/ids.js';
import { kstDays } from '../db/repos/admin.js';
import { runBatch } from '../db/repos/batch.js';
import {
  careersByIds,
  challengedSince,
  countMatchesSince,
  eligibleMap,
  listEligibleCareers,
  listMyTeams,
  listOpponentCandidates,
  listRecentMatches,
  liveTeam,
  meetingsSince,
  myTeamIn,
  peakOf,
  publicNamesOf,
  recordMatchStatements,
  seasonCareersOf,
  slotIdsOf,
  toLineupCareer,
  type MatchDetail,
  type OwnerTeamRow,
  type TeamMatchRow,
} from '../db/repos/ownerTeams.js';
import { getProfile, type ProfileRecord } from '../db/repos/profiles.js';
import { ownerTeams } from '../db/schema.js';
import { purgeEdge } from '../edgeCache.js';
import { STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { clubAchievements } from '../team/achievements.js';
import {
  buildLineup,
  filledCount,
  lineupOvr,
  simulateMatch,
  type LineupSlot,
  type PlayerRef,
} from '../team/sim.js';
import { linesOf, recordOf, seasonOptions, slotsOf } from '../team/view.js';

// T-10-092 구단주 팀(시즌마다 한 팀). 구글 로그인한 구단주만 쓴다 — 사람마다 다른 응답이라 엣지 캐시하지 않는다.
/** 상대 목록에 보여 줄 팀 수. */
const OPPONENTS_SHOWN = 5;

const teamRequired = () =>
  new AppError({
    code: 'VALIDATION_FAILED',
    status: 409,
    message: '먼저 이번 시즌 팀을 만들어 주세요.',
    details: { reason: 'TEAM_REQUIRED' },
  });

/** 구글 로그인한(삭제되지 않은) 프로필만 구단주다. 익명 프로필은 403 GOOGLE_LOGIN_REQUIRED — 웹이 로그인 안내를 띄운다. */
async function requireOwner(c: Context<AppEnv>): Promise<ProfileRecord> {
  const profile = await getProfile(getDb(c), getSessionOrThrow(c).profileId);
  if (!profile || !profile.googleSub || profile.deletedAt) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: '구글로 로그인한 구단주만 팀을 만들 수 있어요.',
      details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
    });
  }
  return profile;
}

/** 지금 고치고 겨루는 팀 시즌. 시즌 사이 휴식기면 409 SEASON_CLOSED. */
function currentSeasonOrThrow(now: string): number {
  const season = teamSeasonAt(now);
  if (season === null) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      status: 409,
      message: '지금은 시즌 사이 휴식기예요. 다음 시즌이 열리면 새 팀을 꾸릴 수 있어요.',
      details: { reason: 'SEASON_CLOSED' },
    });
  }
  return season;
}

const seasonQuery = (c: Context<AppEnv>, now: string) =>
  teamSeasonParam(c.req.query('season'), now);

/** 팀·감독 이름 검사(욕설·운영자 사칭). */
function checkName(value: string, what: string) {
  if (isReservedNickname(value)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: `'운영자'처럼 운영진으로 보이는 ${what}은 쓸 수 없어요.`,
      details: { reason: 'RESERVED_NAME' },
    });
  }
  if (!isAcceptablePublicName(value)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: `쓸 수 없는 ${what}이에요.`,
      details: { reason: 'BLOCKED_WORD' },
    });
  }
}

/** 오늘(한국 시각 자정부터)의 시작 UTC ISO. */
const kstTodayStart = (now: string) => kstDays(new Date(now), 1).startIso;
/** 재대결 감쇠를 세는 기간의 시작(오늘 포함 TEAM_REPEAT_WINDOW_DAYS일, 한국 시각 자정 기준). */
const repeatWindowStart = (now: string) => kstDays(new Date(now), TEAM_REPEAT_WINDOW_DAYS).startIso;

function toOwnerTeam(row: OwnerTeamRow, lineup: LineupSlot[]): OwnerTeam {
  return {
    id: row.id,
    season: row.season,
    name: row.name,
    manager: row.manager,
    formation: row.formation as FormationId,
    slots: slotsOf(lineup),
    ovr: lineupOvr(lineup),
    lines: linesOf(lineup),
    rating: row.rating,
    record: recordOf(row),
    likes: row.likes,
    views: row.views,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type MatchHead = Pick<TeamMatchRow, 'id' | 'homeTeamId' | 'homeGoals' | 'awayGoals' | 'createdAt'>;

function toMatch(
  row: MatchHead,
  d: MatchDetail,
  myTeamId: string,
  names: ReadonlyMap<string, string>,
): TeamMatch {
  const label = (p: PlayerRef) => (p.careerId ? (names.get(p.careerId) ?? p.anon) : p.anon);
  const mine = row.homeTeamId === myTeamId ? 'home' : 'away';
  return {
    id: row.id,
    home: { ...d.home, goals: row.homeGoals, ratingChange: d.home.ratingChange ?? null },
    away: { ...d.away, goals: row.awayGoals, ratingChange: d.away.ratingChange ?? null },
    events: d.events.map((e) => ({
      minute: e.minute,
      side: e.side,
      scorer: label(e.scorer),
      assist: e.assist ? label(e.assist) : null,
      scorerId: e.side === mine ? e.scorer.careerId : null,
      assistId: e.side === mine ? (e.assist?.careerId ?? null) : null,
    })),
    mine,
    createdAt: row.createdAt,
  };
}

const careerIdsIn = (details: readonly MatchDetail[]) => [
  ...new Set(
    details.flatMap((d) =>
      d.events.flatMap((e) =>
        [e.scorer.careerId, e.assist?.careerId].filter((x): x is string => !!x),
      ),
    ),
  ),
];

export function registerOwnerTeamRoutes(app: Hono<AppEnv>): void {
  // 내 팀(보고 있는 시즌) + 그 시즌에 넣을 수 있는 은퇴 선수 + 오늘 남은 경기 수. 화면을 열 때 한 번 부른다(웹 메모 1분).
  app.get('/v1/owner-team', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const season = seasonQuery(c, now);
    const [teams, players, [played]] = await db.batch([
      listMyTeams(db, me.id),
      listEligibleCareers(db, me.id, season),
      countMatchesSince(db, me.id, kstTodayStart(now)),
    ]);
    const team = teams.find((t) => t.season === season) ?? null;
    const picks = players.map((p) => {
      const profile = peakOf(p.peakProfile);
      return { p, profile, career: toLineupCareer(p, profile) };
    });
    const eligible = new Map(picks.map(({ career }) => [career.id, career]));
    // 은퇴 선수가 목록 상한보다 많으면 선발에 든 선수가 목록 밖에 있을 수 있다 — 그 선수만 따로 읽는다.
    const missing = (team ? slotIdsOf(team) : []).filter(
      (id): id is string => !!id && !eligible.has(id),
    );
    if (missing.length) {
      for (const [id, career] of eligibleMap(await careersByIds(db, missing), me.id, season))
        eligible.set(id, career);
    }
    return ok(
      c,
      OwnerTeamResponseSchema,
      {
        season,
        current: teamSeasonAt(now),
        seasons: seasonOptions(now),
        team: team
          ? toOwnerTeam(team, buildLineup(team.formation as FormationId, slotIdsOf(team), eligible))
          : null,
        players: picks.map(({ p, profile, career }) => ({
          careerId: p.id,
          pos: p.pos,
          dpos: career.dpos,
          peak: career.peak,
          roles: career.roles,
          attrs: profile?.attrs ?? null,
          number: p.number,
          publicName: p.publicName,
          legendScore: p.legendScore,
        })),
        lastManager: teams.findLast((t) => t.manager)?.manager ?? null,
        matchesLeft: Math.max(0, TEAM_MATCHES_PER_DAY - Number(played?.n ?? 0)),
        matchesPerDay: TEAM_MATCHES_PER_DAY,
      },
      200,
      NO_STORE,
    );
  });

  // 지금 시즌 팀 만들기·고치기(전체 교체라 자연 멱등). 시즌마다 한 팀 — (구단주, 시즌) 유니크로 있으면 고친다.
  app.put('/v1/owner-team', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, PutOwnerTeamBodySchema);
    const now = nowIso();
    const season = currentSeasonOrThrow(now);
    checkName(input.name, '팀 이름');
    checkName(input.manager, '감독 이름');
    const ids = input.slots.filter((x): x is string => x !== null);
    if (new Set(ids).size !== ids.length) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '한 선수는 한 자리에만 넣을 수 있어요.',
        details: { reason: 'DUPLICATE_PLAYER' },
      });
    }
    const eligible = eligibleMap(await careersByIds(db, ids), me.id, season);
    if (ids.some((id) => !eligible.has(id))) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '이번 시즌에 뛰고 은퇴한 내 선수만 팀에 넣을 수 있어요.',
        details: { reason: 'PLAYER_NOT_ELIGIBLE' },
      });
    }
    const lineup = buildLineup(input.formation, input.slots, eligible);
    const values = {
      name: input.name,
      manager: input.manager,
      formation: input.formation,
      slotsJson: JSON.stringify(input.slots),
      filled: filledCount(lineup),
      ovr: lineupOvr(lineup),
      updatedAt: now,
    };
    const [row] = await db
      .insert(ownerTeams)
      .values({ id: newId('tem'), profileId: me.id, season, createdAt: now, ...values })
      .onConflictDoUpdate({ target: [ownerTeams.profileId, ownerTeams.season], set: values })
      .returning();
    purgeEdge(c, STALE.teamSaved(season));
    return ok(c, PutOwnerTeamResponseSchema, { team: toOwnerTeam(row!, lineup) });
  });

  // 경기 상대 후보: 같은 시즌에서 내 팀 OVR에 가까운 다른 구단주의 팀 몇 개를 섞어서.
  app.get('/v1/owner-team/opponents', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const season = currentSeasonOrThrow(now);
    const [mine] = await myTeamIn(db, me.id, season);
    if (!mine) throw teamRequired();
    const candidates = await listOpponentCandidates(
      db,
      me.id,
      season,
      mine.ovr,
      kstTodayStart(now),
    );
    // 가까운 팀 중에서 무작위로(매번 같은 상대만 나오지 않게).
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }
    const items: TeamOpponent[] = candidates
      .slice(0, OPPONENTS_SHOWN)
      .sort((a, b) => b.ovr - a.ovr)
      .map((team) => ({
        teamId: team.id,
        name: team.name,
        owner: team.manager,
        formation: team.formation as FormationId,
        ovr: team.ovr,
        rating: team.rating,
        record: recordOf(team),
      }));
    return ok(c, TeamOpponentsResponseSchema, { items }, 200, NO_STORE);
  });

  // 경기 한 판(같은 시즌 팀끼리). 서버가 두 팀 선발을 읽어 시뮬레이션하고 결과·전적·레이팅을 남긴다. 재시도가 경기를 두 번
  // 치르지 않게 멱등 키를 쓴다.
  app.post('/v1/owner-team/matches', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, PlayTeamMatchBodySchema);
    const now = nowIso();
    const season = currentSeasonOrThrow(now);
    const [[mine], challenged, [opp]] = await db.batch([
      myTeamIn(db, me.id, season),
      challengedSince(db, me.id, kstTodayStart(now)),
      liveTeam(db, input.opponentTeamId),
    ]);
    if (!mine) throw teamRequired();
    const usedToday = challenged.length;
    if (usedToday >= TEAM_MATCHES_PER_DAY) {
      throw new AppError({
        code: 'RATE_LIMITED',
        message: `오늘 경기는 모두 치렀어요(하루 ${TEAM_MATCHES_PER_DAY}경기). 한국 시각 자정에 다시 열려요.`,
        details: { reason: 'TEAM_MATCH_DAILY_LIMIT' },
      });
    }
    if (!opp || opp.team.profileId === me.id || opp.team.season !== season) throw teamNotFound();
    // T-10-095 같은 상대에게는 하루 한 번만 건다(받은 경기는 세지 않는다 — 받은 쪽은 되갚을 수 있다).
    if (challenged.some((m) => m.teamId === opp.team.id)) {
      throw new AppError({
        code: 'RATE_LIMITED',
        message: '이 팀과는 오늘 이미 겨뤘어요. 한국 시각 자정에 다시 도전할 수 있어요.',
        details: { reason: 'TEAM_OPPONENT_DAILY_LIMIT' },
      });
    }

    const mySlots = slotIdsOf(mine);
    const oppSlots = slotIdsOf(opp.team);
    const [rows, [met]] = await Promise.all([
      careersByIds(db, [
        ...new Set([...mySlots, ...oppSlots].filter((x): x is string => x !== null)),
      ]),
      meetingsSince(db, mine.id, opp.team.id, repeatWindowStart(now)),
    ]);
    const home = buildLineup(
      mine.formation as FormationId,
      mySlots,
      eligibleMap(rows, me.id, season),
    );
    const away = buildLineup(
      opp.team.formation as FormationId,
      oppSlots,
      eligibleMap(rows, opp.team.profileId, season),
    );
    if (filledCount(home) === 0) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        status: 409,
        message: '은퇴 선수를 한 명 이상 넣어야 경기할 수 있어요.',
        details: { reason: 'TEAM_EMPTY' },
      });
    }
    if (filledCount(away) === 0) throw teamNotFound();

    const id = newId('mat');
    const result = simulateMatch(id, home, away);
    const score = matchScore(result.homeGoals, result.awayGoals);
    // 최근 TEAM_REPEAT_WINDOW_DAYS일 안에 이미 만난 횟수만큼 변화가 줄고, 받은 쪽은 절반만 움직인다.
    const delta = ratingChange(mine.rating, opp.team.rating, score, Number(met?.n ?? 0));
    const homeSide = {
      teamId: mine.id,
      filled: filledCount(home),
      ovr: lineupOvr(home),
      goals: result.homeGoals,
      rating: delta.home,
    };
    const awaySide = {
      teamId: opp.team.id,
      filled: filledCount(away),
      ovr: lineupOvr(away),
      goals: result.awayGoals,
      rating: delta.away,
    };
    const detail: MatchDetail = {
      home: {
        teamId: mine.id,
        name: mine.name,
        owner: mine.manager,
        formation: mine.formation as FormationId,
        ovr: homeSide.ovr,
        ratingChange: delta.home,
      },
      away: {
        teamId: opp.team.id,
        name: opp.team.name,
        owner: opp.team.manager,
        formation: opp.team.formation as FormationId,
        ovr: awaySide.ovr,
        ratingChange: delta.away,
      },
      events: result.events.map((e) => ({
        minute: e.minute,
        side: e.side,
        scorer: e.scorer,
        assist: e.assist,
      })),
    };
    await runBatch(db, [
      ...recordMatchStatements(db, {
        id,
        profileId: me.id,
        home: homeSide,
        away: awaySide,
        detail,
        now,
      }),
    ]);
    const names = new Map<string, string>();
    for (const s of [...home, ...away])
      if (s.careerId && s.publicName) names.set(s.careerId, s.publicName);
    const head: MatchHead = {
      id,
      homeTeamId: mine.id,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      createdAt: now,
    };
    return ok(
      c,
      PlayTeamMatchResponseSchema,
      {
        match: toMatch(head, detail, mine.id, names),
        record: {
          w: mine.wins + (score === 1 ? 1 : 0),
          d: mine.draws + (score === 0.5 ? 1 : 0),
          l: mine.losses + (score === 0 ? 1 : 0),
        },
        rating: mine.rating + delta.home,
        matchesLeft: Math.max(0, TEAM_MATCHES_PER_DAY - usedToday - 1),
      },
      201,
    );
  });

  // 구단 시즌 업적(클럽하우스). season 없으면 지금 시즌, 0이면 프리시즌. 팀 업적은 그 시즌 팀으로 판정한다(지난 시즌에 팀이
  // 없었으면 보이지 않는다).
  app.get('/v1/owner-team/achievements', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const season = seasonQuery(c, now);
    const [careersIn, [team]] = await Promise.all([
      seasonCareersOf(db, me.id, season),
      myTeamIn(db, me.id, season),
    ]);
    // 그 시즌 팀에 넣을 수 있는 선수 = 이 시즌 은퇴 선수라 선발도 careersIn에서 만든다.
    const byId = new Map(careersIn.map((r) => [r.id, r]));
    const slots = team
      ? buildLineup(
          team.formation as FormationId,
          slotIdsOf(team),
          new Map(careersIn.map((r) => [r.id, r.lineup])),
        ).map((s) => {
          const r = s.careerId ? byId.get(s.careerId) : undefined;
          return {
            careerId: s.careerId,
            fit: s.fit,
            lastClubId: r?.lastClubId ?? null,
            caps: r?.caps ?? 0,
            retiredNumber: r?.retiredNumber ?? false,
          };
        })
      : null;
    return ok(
      c,
      ClubAchievementsResponseSchema,
      {
        season,
        seasons: seasonOptions(now),
        players: careersIn.length,
        groups: clubAchievements({
          careers: careersIn,
          team: slots ?? (season === teamSeasonAt(now) ? [] : null),
          teamWins: team?.wins ?? 0,
          detail: detailPosInSeason(season),
        }),
      },
      200,
      NO_STORE,
    );
  });

  // 그 시즌 내 팀의 최근 경기(건 경기 + 받은 경기). 선수 이름은 지금 공개 이름으로 붙인다.
  app.get('/v1/owner-team/matches', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const season = seasonQuery(c, nowIso());
    const [team] = await myTeamIn(db, me.id, season);
    const rows = team ? await listRecentMatches(db, me.id, team.id) : [];
    const details = rows.map((r) => JSON.parse(r.detailJson) as MatchDetail);
    const names = await publicNamesOf(db, careerIdsIn(details));
    return ok(
      c,
      TeamMatchesResponseSchema,
      { items: team ? rows.map((r, i) => toMatch(r, details[i]!, team.id, names)) : [] },
      200,
      NO_STORE,
    );
  });
}
