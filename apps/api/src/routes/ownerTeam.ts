import { checkCupLineup } from './cup.js';
import {
  ClubAchievementsResponseSchema,
  ClubAchievementNotificationsSchema,
  OwnerTeamResponseSchema,
  PlayTeamMatchBodySchema,
  PlayTeamMatchResponseSchema,
  TeamMomentBodySchema,
  TeamMomentResponseSchema,
  PutOwnerTeamBodySchema,
  PutOwnerTeamResponseSchema,
  PutTeamCoachBodySchema,
  PutTeamCoachResponseSchema,
  PutTeamPresetsBodySchema,
  PutTeamPresetsResponseSchema,
  TEAM_MATCHES_FIRST_PAGE,
  TEAM_MATCHES_PAGE,
  TEAM_STATS_MATCHES_MAX,
  TeamMatchCursorSchema,
  TeamMatchesResponseSchema,
  TeamOpponentsResponseSchema,
  TeamStatsResponseSchema,
  type OwnerTeam,
  type TeamOpponent,
} from '@offside/contracts';
import { isAcceptablePublicName, isReservedNickname } from '@offside/contracts/content-filter';
import {
  TEAM_MATCHES_PER_DAY,
  TEAM_REPEAT_WINDOW_DAYS,
  TEAM_WILDCARD_MAX,
  WILDCARD_FULL_TEXT,
  isWildcardSeason,
  matchScore,
  ratingChange,
  shapeOf,
  type FormationId,
} from '@offside/contracts/owner-team';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import {
  NO_STORE,
  nowIso,
  ok,
  readBody,
  notFoundError,
  teamNotFound,
  teamSeasonParam,
  conflictError,
  rateLimited,
} from './shared.js';
import { newId } from '../db/ids.js';
import { kstDays } from '../time.js';
import { commitNotifiedEvent } from '../push/events.js';
import {
  careersByIds,
  challengedSince,
  countMatchesSince,
  eligibleMap,
  foundersOf,
  friendlyTeamOf,
  type FriendlyLineup,
  listEligibleCareers,
  listMyTeams,
  listOpponentCandidates,
  listMatchesPage,
  listStatsMatches,
  NO_KIND_TOTALS,
  otherKindTotals,
  liveTeam,
  meetingsSince,
  myTeamIn,
  peakOf,
  recordMatchStatements,
  slotIdsOf,
  layoutOf,
  logoOf,
  presetsOf,
  setTeamPresets,
  teamPlayerCard,
  toLineupCareer,
  type OwnerTeamRow,
} from '../db/repos/ownerTeams.js';
import { achievementRankOf } from '../db/repos/ownerAchievements.js';
import { teamCoachOf } from '../db/repos/managers.js';
import { getProfile, hasAccount, type ProfileRecord } from '../db/repos/profiles.js';
import { ownerTeams } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { edgeCached, purgeEdge, waitUntil } from '../edgeCache.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { refreshAfterChange, refreshOwnerAchievements } from '../team/ownerAchievements.js';
import {
  buildLineup,
  filledCount,
  lineupOvr,
  simulateMatch,
  type LineupSlot,
} from '../team/sim.js';
import { lineupsOf, matchDetailOf, matchNotice, matchViews, playedMatch } from '../team/match.js';
import { teamStatsView } from '../team/stats.js';
import { liveDone, liveResult, resolveMoment, startLiveMatch } from '../team/moments.js';
import {
  finalizeLive,
  liveMomentView,
  livePayload,
  liveStartResponse,
  momentGoals,
  refreshBoth,
  type Finalized,
  type LivePayload,
} from '../team/liveMatch.js';
import { insertLive, liveById, openLiveSince, saveLiveState } from '../db/repos/teamLive.js';
import type { Db } from '../db/client.js';
import { linesOf, recordOf, seasonOptions, slotsOf } from '../team/view.js';
import { localizeAchievements } from '../team/achievementsText.js';
import { reqLang, type Lang } from '../lang.js';

// T-10-092 구단주 팀(시즌마다 한 팀). 구글 로그인한 구단주만 쓴다 — 사람마다 다른 응답이라 엣지 캐시하지 않는다.
/** 상대 목록에 보여 줄 팀 수. */
const OPPONENTS_SHOWN = 5;
/** T-11-262 업적 랭킹 인원 엣지 캐시 TTL(초). */
const ACH_RANKED_TTL = 300;

const liveNotFound = () => notFoundError('진행 중인 경기를 찾지 못했어요.', 'TEAM_LIVE_NOT_FOUND');

/** T-11-387 마감한 장면 경기의 뒷일: 두 팀 통계 캐시 · 두 구단주 점수. */
function afterLiveFinal(c: Context<AppEnv>, f: Finalized) {
  purgeEdge(c, STALE.teamMatchPlayed(f.homeTeamId, f.awayTeamId));
  waitUntil(c, refreshBoth(getDb(c), f));
}

/** 떠난 장면 경기를 자동 선택으로 마감한다. */
async function finishOpenLive(db: Db, ids: string[], now: string, lang: Lang) {
  for (const id of ids) {
    const row = await liveById(db, id);
    if (!row || row.doneAt) continue;
    const f = await finalizeLive(db, row, now, lang);
    if (f?.fresh) await refreshBoth(db, f);
  }
}

const teamRequired = () => conflictError('먼저 이번 시즌 팀을 만들어 주세요.', 'TEAM_REQUIRED');
const coachNotEligible = () =>
  conflictError('감독 커리어를 끝낸 감독만 감독 칸에 넣을 수 있어요.', 'COACH_NOT_ELIGIBLE');

/** 구글 로그인한(삭제되지 않은) 프로필만 구단주다. 익명 프로필은 403 GOOGLE_LOGIN_REQUIRED — 웹이 로그인 안내를 띄운다. */
export async function requireOwner(c: Context<AppEnv>): Promise<ProfileRecord> {
  const profile = await getProfile(getDb(c), getSessionOrThrow(c).profileId);
  if (!profile || !hasAccount(profile) || profile.deletedAt) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: '로그인하면 팀을 만들 수 있어요.',
      details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
    });
  }
  return profile;
}

const PAST_SEASON_TEXT = '지난 시즌 팀은 고칠 수 없어요.';

/** 지금 시즌 팀만 고친다(프리시즌 팀은 친선전용으로). */
function checkEditableSeason(season: number, current: number | null) {
  if (season !== current && season !== 0) throw conflictError(PAST_SEASON_TEXT, 'SEASON_CLOSED');
}

/** 지금 고치고 겨루는 팀 시즌. 시즌 사이 휴식기면 409 SEASON_CLOSED. */
export function currentSeasonOrThrow(now: string): number {
  const season = teamSeasonAt(now);
  if (season === null) {
    throw conflictError(
      '지금은 시즌 사이 휴식기예요. 다음 시즌이 열리면 새 팀을 꾸릴 수 있어요.',
      'SEASON_CLOSED',
    );
  }
  return season;
}

const seasonQuery = (c: Context<AppEnv>, now: string) =>
  teamSeasonParam(c.req.query('season'), now);

/** 팀·감독 이름 검사(욕설·운영자 사칭). */
function checkName(value: string, what: string) {
  // '로고 글자'처럼 받침이 없는 이름도 오므로 문장은 조사 없이 잇는다(errorText의 번역 패턴과 같이 바꾼다).
  if (isReservedNickname(value)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: `${what}에 '운영자'처럼 운영진으로 보이는 말은 쓸 수 없어요.`,
      details: { reason: 'RESERVED_NAME' },
    });
  }
  if (!isAcceptablePublicName(value)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: `${what}에 쓸 수 없는 말이 들어 있어요.`,
      details: { reason: 'BLOCKED_WORD' },
    });
  }
}

/** 오늘(한국 시각 자정부터)의 시작 UTC ISO. */
/** 한국 시각 오늘 0시(UTC ISO). 하루 경기·영입 상한의 기준. */
export const kstTodayStart = (now: string) => kstDays(new Date(now), 1).startIso;
/** 재대결 감쇠를 세는 기간의 시작(오늘 포함 TEAM_REPEAT_WINDOW_DAYS일, 한국 시각 자정 기준). */
const repeatWindowStart = (now: string) => kstDays(new Date(now), TEAM_REPEAT_WINDOW_DAYS).startIso;

/** T-11-310 감독 칸에 든 내 감독(끝낸 감독만, 없으면 null). */
const coachOf = teamCoachOf;

function toOwnerTeam(
  row: OwnerTeamRow,
  lineup: LineupSlot[],
  players: ReadonlyMap<string, { nation?: string | null }>,
  lang: Lang,
  coach: OwnerTeam['coach'] = null,
): OwnerTeam {
  return {
    id: row.id,
    season: row.season,
    name: row.name,
    manager: row.manager,
    formation: row.formation as FormationId,
    slots: slotsOf(lineup, players, lang),
    layout: layoutOf(row),
    logo: logoOf(row),
    ovr: lineupOvr(lineup),
    lines: linesOf(lineup, row.season),
    rating: row.rating,
    record: recordOf(row),
    likes: row.likes,
    views: row.views,
    presets: presetsOf(row),
    coach,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function registerOwnerTeamRoutes(app: Hono<AppEnv>): void {
  // 내 팀(보고 있는 시즌) + 그 시즌에 넣을 수 있는 은퇴 선수 + 오늘 남은 경기 수. 화면을 열 때 한 번 부른다(웹 메모 1분).
  app.get('/v1/owner-team', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const season = seasonQuery(c, now);
    const [teams, players, [played], founder] = await db.batch([
      listMyTeams(db, me.id),
      listEligibleCareers(db, me.id, season),
      countMatchesSince(db, me.id, kstTodayStart(now)),
      foundersOf(db, [me.id]),
    ]);
    // T-11-113 개막 뒤의 프리시즌 팀은 친선전용 편성을 보이고 고친다(지금 가진 선수만).
    const editableSeason = season === teamSeasonAt(now) || season === 0;
    const found = teams.find((t) => t.season === season);
    const team = found ? friendlyTeamOf(found) : null;
    const picks = players.map((p) => {
      const profile = peakOf(p.peakProfile);
      const career = toLineupCareer(p, profile);
      return { p, career, card: teamPlayerCard(p, profile, career) };
    });
    const eligible = new Map(picks.map(({ career }) => [career.id, career]));
    // 은퇴 선수가 목록 상한보다 많으면 선발에 든 선수가 목록 밖에 있을 수 있다 — 그 선수만 따로 읽는다.
    const missing = (team ? slotIdsOf(team) : []).filter(
      (id): id is string => !!id && !eligible.has(id),
    );
    if (missing.length) {
      for (const [id, career] of eligibleMap(
        await careersByIds(db, missing),
        me.id,
        season,
        editableSeason,
      ))
        eligible.set(id, career);
    }
    const coach = team ? await coachOf(db, team) : null;
    return ok(
      c,
      OwnerTeamResponseSchema,
      {
        season,
        current: teamSeasonAt(now),
        seasons: seasonOptions(now, reqLang(c)),
        team: team
          ? toOwnerTeam(
              team,
              buildLineup(team.formation as FormationId, slotIdsOf(team), eligible, layoutOf(team)),
              eligible,
              reqLang(c),
              coach,
            )
          : null,
        players: picks.map(({ p, card }) => ({
          ...card,
          cardValue: p.cardValue,
          raised: !!p.raised,
          locked: p.locked,
          listing: p.listingId ? { id: p.listingId, price: p.listPrice! } : null,
        })),
        lastManager: teams.findLast((t) => t.manager)?.manager ?? null,
        matchesLeft: Math.max(0, TEAM_MATCHES_PER_DAY - Number(played?.n ?? 0)),
        matchesPerDay: TEAM_MATCHES_PER_DAY,
        founder: founder.length > 0,
        // 컵 성적은 최근 대회부터 온다 — 첫 우승이 가장 최근 우승.
        ownerTitle: me.title,
      },
      200,
      NO_STORE,
    );
  });

  // 지금 시즌 팀 만들기·고치기(전체 교체라 자연 멱등). 시즌마다 한 팀 — (구단주, 시즌) 유니크로 있으면 고친다.
  // T-11-113 개막 뒤 season 0은 프리시즌 팀의 친선전용 편성(friendly_json)만 고친다. 지금 가진 프리시즌 선수만 넣고,
  // 최종 기록 칸(랭킹·팀 프로필·업적이 읽는다)은 그대로 둔다. 팀이 없었으면 빈 최종 기록(filled 0 — 랭킹 밖)으로 만든다.
  app.put('/v1/owner-team', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, PutOwnerTeamBodySchema);
    const now = nowIso();
    const current = teamSeasonAt(now);
    const season = input.season ?? currentSeasonOrThrow(now);
    checkEditableSeason(season, current);
    const friendly = season !== current;
    checkName(input.name, '팀 이름');
    checkName(input.manager, '감독 이름');
    if (input.logo?.text) checkName(input.logo.text, '로고 글자');
    const ids = input.slots.filter((x): x is string => x !== null);
    if (new Set(ids).size !== ids.length) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '한 선수는 한 자리에만 넣을 수 있어요.',
        details: { reason: 'DUPLICATE_PLAYER' },
      });
    }
    const eligible = eligibleMap(await careersByIds(db, ids), me.id, season, true);
    if (ids.some((id) => !eligible.has(id))) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message:
          season === current
            ? '지금 가진 내 선수만 팀에 넣을 수 있어요.'
            : '지금 가진 프리시즌 선수만 프리시즌 팀에 넣을 수 있어요.',
        details: { reason: 'PLAYER_NOT_ELIGIBLE' },
      });
    }
    // T-11-114 지난 시즌 선수(와일드카드)는 선발에 정해진 수까지만.
    if (
      ids.filter((id) => isWildcardSeason(eligible.get(id)?.season, season)).length >
      TEAM_WILDCARD_MAX
    ) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: WILDCARD_FULL_TEXT,
        details: { reason: 'WILDCARD_LIMIT' },
      });
    }
    // 이전 클라이언트가 좌표를 보내지 않으면 기존 자유 편성을 보존한다.
    // 포메이션을 바꾼 요청만 새 기본 배치로 돌아간다.
    const [stored] =
      friendly || input.layout === undefined || input.coach === undefined
        ? await myTeamIn(db, me.id, season)
        : [];
    const previous = stored ? friendlyTeamOf(stored) : null;
    // T-11-310 감독 칸: 보내지 않으면(옛 클라이언트) 그대로 둔다. 끝낸 내 감독만 넣는다.
    const coachId = input.coach === undefined ? (previous?.coachId ?? null) : input.coach;
    const coach = coachId ? await coachOf(db, { coachId, profileId: me.id }) : null;
    if (input.coach && !coach) throw coachNotEligible();
    const layout =
      input.layout === undefined
        ? previous?.formation === input.formation
          ? layoutOf(previous)
          : null
        : input.layout;
    const lineup = buildLineup(input.formation, input.slots, eligible, layout);
    if (!friendly) await checkCupLineup(db, me.id, season, ids, filledCount(lineup), now);
    const values = {
      name: input.name,
      manager: input.manager,
      formation: input.formation,
      slotsJson: JSON.stringify(input.slots),
      layoutJson: layout ? JSON.stringify(layout) : null,
      // 로고를 모르는 이전 클라이언트의 저장은 기존 로고를 보존한다.
      ...(input.logo !== undefined
        ? { logoJson: input.logo ? JSON.stringify(input.logo) : null }
        : {}),
      filled: filledCount(lineup),
      ovr: lineupOvr(lineup),
      coachId: coach ? coachId : null,
    };
    if (friendly) {
      const lineupJson = JSON.stringify({
        logoJson: previous?.logoJson ?? null,
        ...values,
      } satisfies FriendlyLineup);
      const [row] = await db
        .insert(ownerTeams)
        .values({
          id: newId('tem'),
          profileId: me.id,
          season,
          name: input.name,
          manager: input.manager,
          formation: input.formation,
          slotsJson: JSON.stringify(input.slots.map(() => null)),
          filled: 0,
          ovr: 0,
          friendlyJson: lineupJson,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [ownerTeams.profileId, ownerTeams.season],
          set: { friendlyJson: lineupJson },
        })
        .returning();
      return ok(c, PutOwnerTeamResponseSchema, {
        team: toOwnerTeam(friendlyTeamOf(row!), lineup, eligible, reqLang(c), coach),
      });
    }
    const [row] = await db
      .insert(ownerTeams)
      .values({
        id: newId('tem'),
        profileId: me.id,
        season,
        createdAt: now,
        updatedAt: now,
        ...values,
      })
      .onConflictDoUpdate({
        target: [ownerTeams.profileId, ownerTeams.season],
        set: { ...values, updatedAt: now },
      })
      .returning();
    purgeEdge(c, STALE.teamSaved(season));
    waitUntil(c, refreshAfterChange(db, me.id, season));
    return ok(c, PutOwnerTeamResponseSchema, {
      team: toOwnerTeam(row!, lineup, eligible, reqLang(c), coach),
    });
  });

  // T-11-310 감독 칸만 바꾸기(지금 시즌 팀). 컵 명단이 잠긴 동안은 선발과 같이 잠긴다. 끝낸 내 감독만 넣는다.
  app.put('/v1/owner-team/coach', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, PutTeamCoachBodySchema);
    const now = nowIso();
    const season = currentSeasonOrThrow(now);
    const [team] = await myTeamIn(db, me.id, season);
    if (!team) throw teamRequired();
    const coach = input.coach
      ? await coachOf(db, { coachId: input.coach, profileId: me.id })
      : null;
    if (input.coach && !coach) throw coachNotEligible();
    const ids = slotIdsOf(team).filter((x): x is string => x !== null);
    await checkCupLineup(db, me.id, season, ids, team.filled, now);
    await db
      .update(ownerTeams)
      .set({ coachId: coach ? input.coach : null, updatedAt: now })
      .where(and(eq(ownerTeams.id, team.id), eq(ownerTeams.profileId, me.id)));
    purgeEdge(c, STALE.teamSaved(season));
    waitUntil(c, refreshAfterChange(db, me.id, season));
    return ok(c, PutTeamCoachResponseSchema, { coach }, 200, NO_STORE);
  });

  // T-11-217 팀 프리셋 목록 통째 교체. 팀을 한 번 저장한 뒤에만(시즌 팀 행에 둔다). 프리셋은 편성 초안만 채우고,
  // 실제 팀 반영은 PUT /v1/owner-team이 선수 · 컵 잠금을 검사한다 — 여기서는 모양만 본다.
  app.put('/v1/owner-team/presets', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const input = readBody(c, PutTeamPresetsBodySchema);
    const now = nowIso();
    const current = teamSeasonAt(now);
    const season = input.season ?? currentSeasonOrThrow(now);
    checkEditableSeason(season, current);
    const [row] = await setTeamPresets(getDb(c), me.id, season, input.presets);
    if (!row) throw teamNotFound();
    return ok(c, PutTeamPresetsResponseSchema, { presets: input.presets });
  });

  // 경기 상대 후보: 같은 시즌에서 내 팀 레이팅에 가까운 다른 구단주의 팀 몇 개를 섞어서(레이팅이 같으면 OVR이 가까운 팀부터).
  // OVR로만 고르면 비슷한 전력끼리만 만나 레이팅이 실력만큼 벌어지지 않았다(시즌 1 첫날 OVR 대별 평균 레이팅이 모두 1000 안팎).
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
      { rating: mine.rating, ovr: mine.ovr },
      kstTodayStart(now),
    );
    // 가까운 팀 중에서 무작위로(매번 같은 상대만 나오지 않게).
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }
    const items: TeamOpponent[] = candidates
      .slice(0, OPPONENTS_SHOWN)
      .sort((a, b) => b.rating - a.rating || b.ovr - a.ovr)
      .map((team) => ({
        teamId: team.id,
        name: team.name,
        logo: logoOf(team),
        owner: team.manager,
        formation: team.formation as FormationId,
        shape: shapeOf(team.formation as FormationId, layoutOf(team)),
        ovr: team.ovr,
        rating: team.rating,
        record: recordOf(team),
        title: team.title,
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
    const [[mine], recorded, open, [opp]] = await db.batch([
      myTeamIn(db, me.id, season),
      challengedSince(db, me.id, kstTodayStart(now)),
      openLiveSince(db, me.id, kstTodayStart(now)),
      liveTeam(db, input.opponentTeamId),
    ]);
    if (!mine) throw teamRequired();
    // T-11-387 아직 끝나지 않은 장면 경기도 오늘 경기로 센다. 떠난 경기는 여기서 자동 선택으로 마감한다(cron보다 먼저).
    if (open.length)
      waitUntil(
        c,
        finishOpenLive(
          db,
          open.map((o) => o.id),
          now,
          reqLang(c),
        ),
      );
    const challenged = [...recorded, ...open];
    const usedToday = challenged.length;
    if (usedToday >= TEAM_MATCHES_PER_DAY) {
      throw rateLimited(
        `오늘 경기는 모두 치렀어요(하루 ${TEAM_MATCHES_PER_DAY}경기). 한국 시각 자정에 다시 열려요.`,
        'TEAM_MATCH_DAILY_LIMIT',
      );
    }
    if (!opp || opp.team.profileId === me.id || opp.team.season !== season) throw teamNotFound();
    // T-10-095 같은 상대에게는 하루 한 번만 건다(받은 경기는 세지 않는다 — 받은 쪽은 되갚을 수 있다).
    if (challenged.some((m) => m.teamId === opp.team.id)) {
      throw rateLimited(
        '이 팀과는 오늘 이미 겨뤘어요. 한국 시각 자정에 다시 도전할 수 있어요.',
        'TEAM_OPPONENT_DAILY_LIMIT',
      );
    }

    const [lineups, [met]] = await Promise.all([
      lineupsOf(db, season, mine, opp.team),
      meetingsSince(db, mine.id, opp.team.id, repeatWindowStart(now)),
    ]);
    if (filledCount(lineups.home) === 0) {
      throw conflictError('은퇴 선수를 한 명 이상 넣어야 경기할 수 있어요.', 'TEAM_EMPTY');
    }
    if (filledCount(lineups.away) === 0) throw teamNotFound();

    const id = newId('mat');
    if (input.live) {
      // T-11-387 장면 경기: 일반 골과 장면을 굴려 두고, 마지막 장면을 고르거나 마감할 때 경기를 남긴다.
      const state = startLiveMatch(id, lineups.home, lineups.away, season, {
        coaches: lineups.coaches,
      });
      const snap = matchDetailOf(mine, opp.team, lineups, liveResult(state));
      const payload = livePayload(
        season,
        state,
        { home: snap.home, away: snap.away },
        { home: filledCount(lineups.home), away: filledCount(lineups.away) },
        lineups,
        Number(met?.n ?? 0),
        Math.max(0, TEAM_MATCHES_PER_DAY - usedToday - 1),
      );
      const row = {
        id,
        profileId: me.id,
        homeTeamId: mine.id,
        awayTeamId: opp.team.id,
        stateJson: JSON.stringify(payload),
        createdAt: now,
      };
      if (liveDone(state)) {
        // 고를 장면이 하나도 없으면 바로 마감한다.
        await insertLive(db, row);
        const f = await finalizeLive(
          db,
          { ...row, rev: 0, doneAt: null, resultJson: null },
          now,
          reqLang(c),
        );
        if (!f) throw teamNotFound();
        afterLiveFinal(c, f);
        return ok(c, PlayTeamMatchResponseSchema, f.response, 201);
      }
      await insertLive(db, row);
      return ok(
        c,
        PlayTeamMatchResponseSchema,
        liveStartResponse(row, payload, mine, opp.team, reqLang(c)),
        201,
      );
    }
    const result = simulateMatch(id, lineups.home, lineups.away, season, {
      coaches: lineups.coaches,
    });
    const score = matchScore(result.homeGoals, result.awayGoals);
    // 기대 승률에 홈 이점을 넣고, 최근 TEAM_REPEAT_WINDOW_DAYS일 안에 이미 만난 횟수만큼 변화를 줄인다.
    const delta = ratingChange(mine.rating, opp.team.rating, score, Number(met?.n ?? 0));
    const detail = matchDetailOf(mine, opp.team, lineups, result, delta);
    const homeSide = {
      teamId: mine.id,
      filled: filledCount(lineups.home),
      ovr: detail.home.ovr,
      goals: result.homeGoals,
      rating: delta.home,
    };
    const awaySide = {
      teamId: opp.team.id,
      filled: filledCount(lineups.away),
      ovr: detail.away.ovr,
      goals: result.awayGoals,
      rating: delta.away,
    };
    await commitNotifiedEvent(
      db,
      [
        ...recordMatchStatements(db, {
          id,
          profileId: me.id,
          home: homeSide,
          away: awaySide,
          detail,
          now,
        }),
      ],
      matchNotice(id, mine, opp.team, result.homeGoals, result.awayGoals, now),
    );
    purgeEdge(c, STALE.teamMatchPlayed(mine.id, opp.team.id));
    // 상대 팀 기록(승패·레이팅)도 바뀌어 두 구단주 점수를 함께 센다.
    waitUntil(
      c,
      Promise.all([
        refreshAfterChange(db, me.id, season),
        refreshAfterChange(db, opp.team.profileId, season),
      ]),
    );
    const head = {
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
        match: playedMatch(head, detail, lineups, mine, opp.team, reqLang(c)),
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

  // T-11-387 장면 하나를 고른다. 서버가 미리 굴린 판정값으로 결과를 정하고, 마지막 장면이면 경기를 마감해 결과를 함께 준다.
  // 같은 장면을 다시 보내면(재시도) 처음 결과를 그대로 준다.
  app.post('/v1/owner-team/matches/:id/moments/:index', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const lang = reqLang(c);
    const { choice } = readBody(c, TeamMomentBodySchema);
    const index = Number(c.req.param('index'));
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await liveById(db, c.req.param('id'));
      if (!row || row.profileId !== me.id) throw liveNotFound();
      const payload = JSON.parse(row.stateJson) as LivePayload;
      const m = Number.isInteger(index) ? payload.state.moments[index] : undefined;
      if (!m || !m.shown) throw liveNotFound();
      const fresh = m.picked === undefined;
      if (fresh && !row.doneAt && !resolveMoment(m, choice)) {
        throw new AppError({
          code: 'VALIDATION_FAILED',
          status: 400,
          message: '고를 수 없는 선택지예요.',
          details: { reason: 'TEAM_LIVE_CHOICE' },
        });
      }
      const view = {
        moment: liveMomentView(payload, index, lang),
        goals: momentGoals(payload, m, lang),
      };
      if (row.doneAt || liveDone(payload.state)) {
        const f = await finalizeLive(
          db,
          { ...row, stateJson: JSON.stringify(payload) },
          nowIso(),
          lang,
        );
        if (!f) throw liveNotFound();
        if (f.fresh) afterLiveFinal(c, f);
        return ok(c, TeamMomentResponseSchema, { ...view, final: f.response });
      }
      if (!fresh) return ok(c, TeamMomentResponseSchema, view);
      const saved = await saveLiveState(db, row.id, row.rev, JSON.stringify(payload));
      if (saved.meta.changes > 0) return ok(c, TeamMomentResponseSchema, view);
      // 다른 요청이 먼저 고쳤다 — 다시 읽어 그 상태 위에서 고른다.
    }
    throw conflictError('잠시 뒤 다시 골라 주세요.', 'TEAM_LIVE_BUSY');
  });

  // T-11-387 남은 장면을 자동 선택으로 마감한다('결과 바로 보기').
  app.post('/v1/owner-team/matches/:id/finish', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const row = await liveById(db, c.req.param('id'));
    if (!row || row.profileId !== me.id) throw liveNotFound();
    const f = await finalizeLive(db, row, nowIso(), reqLang(c));
    if (!f) throw liveNotFound();
    if (f.fresh) afterLiveFinal(c, f);
    return ok(c, PlayTeamMatchResponseSchema, f.response);
  });

  // 구단 시즌 업적(클럽하우스). season 없으면 지금 시즌, 0이면 프리시즌. 팀 업적은 그 시즌 팀으로 판정한다(지난 시즌에 팀이
  // 없었으면 보이지 않는다). T-11-028 점수를 다시 세어 적고 업적 랭킹 순위를 함께 준다.
  app.get('/v1/owner-team/achievement-notifications', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const now = nowIso();
    const season = seasonQuery(c, now);
    const { groups, row } = await refreshOwnerAchievements(getDb(c), me, season, now, false);
    return ok(
      c,
      ClubAchievementNotificationsSchema,
      {
        season,
        groups: localizeAchievements(groups, reqLang(c)),
        score: row.score,
      },
      200,
      NO_STORE,
    );
  });

  app.get('/v1/owner-team/achievements', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const season = seasonQuery(c, now);
    const { groups, row, players } = await refreshOwnerAchievements(db, me, season, now, false);
    // T-11-262 랭킹 인원은 모두에게 같다 — 시즌마다 5분 엣지 캐시(순위는 사람마다 달라 매번 센다).
    const { rank, ranked } = await achievementRankOf(db, row, (load) =>
      edgeCached(c, EDGE.achRanked(season), ACH_RANKED_TTL, load),
    );
    const lang = reqLang(c);
    return ok(
      c,
      ClubAchievementsResponseSchema,
      {
        season,
        seasons: seasonOptions(now, lang),
        players,
        groups: localizeAchievements(groups, lang),
        score: row.score,
        rank,
        ranked,
      },
      200,
      NO_STORE,
    );
  });

  // 그 시즌 내 팀의 경기 기록(건 경기 + 받은 경기, 최신순). 선수 이름은 지금 공개 이름으로 붙인다.
  // T-11-269 cursor(앞 쪽의 next)를 주면 그다음 TEAM_MATCHES_PAGE경기를 준다. 첫 쪽은 예전처럼 TEAM_MATCHES_FIRST_PAGE경기.
  app.get('/v1/owner-team/matches', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const season = seasonQuery(c, nowIso());
    const raw = c.req.query('cursor');
    const cursor = raw ? parseWithAppError(TeamMatchCursorSchema, raw) : null;
    const [team] = await myTeamIn(db, me.id, season);
    if (!team) return ok(c, TeamMatchesResponseSchema, { items: [], next: null }, 200, NO_STORE);
    const cut = cursor ? cursor.lastIndexOf('_') : -1;
    const page = await listMatchesPage(
      db,
      team.id,
      cursor ? { createdAt: cursor.slice(0, cut), id: cursor.slice(cut + 1) } : null,
      cursor ? TEAM_MATCHES_PAGE : TEAM_MATCHES_FIRST_PAGE,
    );
    const items = await matchViews(db, page.rows, () => team.id, reqLang(c));
    const next = page.next ? `${page.next.createdAt}_${page.next.id}` : null;
    return ok(c, TeamMatchesResponseSchema, { items, next }, 200, NO_STORE);
  });

  // T-11-269 그 시즌 내 팀의 랭크 경기 통계(선수별 골 · 도움, 날짜별 · 상대별 전적). 통계 화면을 열 때만 부른다.
  // T-11-358 친선전 · 컵 전적(SQL 합계)과 흐름 요약을 summary로 함께 준다.
  app.get('/v1/owner-team/stats', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const season = seasonQuery(c, nowIso());
    const [team] = await myTeamIn(db, me.id, season);
    const [{ rows, capped }, kinds] = team
      ? await Promise.all([
          listStatsMatches(db, team.id, TEAM_STATS_MATCHES_MAX),
          otherKindTotals(db, team.id),
        ])
      : [{ rows: [], capped: false }, NO_KIND_TOTALS];
    const stats = await teamStatsView(db, season, team?.id ?? '', rows, capped, reqLang(c), kinds);
    return ok(c, TeamStatsResponseSchema, stats, 200, NO_STORE);
  });
}
