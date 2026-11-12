import {
  saveOwnerTeam,
  coachNotEligible,
  checkEditableSeason,
  checkLineupPlayers,
} from '../team/saveOwnerTeam.js';
import { requireOwner } from '../middleware/requireOwner.js';
import { activeCupSeasonsQuery } from '../team/cup.js';
import { checkCupLineup } from '../team/competitionLineup.js';
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
  type TeamPreset,
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
  type TeamOpponent,
} from '@offside/contracts';
import {
  TEAM_MATCHES_PER_DAY,
  teamMatchAllowance,
  TEAM_REPEAT_WINDOW_DAYS,
  achTierByRank,
  matchScore,
  usesRankLadder,
  shapeOf,
  LEGACY_NO_SALARY_BUDGET,
  type FormationId,
} from '@offside/contracts/owner-team';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import { resolveBalance } from '@offside/contracts/balance';
import { clampDivision, divisionRules, nextDivision } from '@offside/contracts/team-division';
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
import { kstDays, kstTodayStart } from '../time.js';
import { commitNotifiedEvent } from '../push/events.js';
import {
  careersByIds,
  challengedAtSince,
  challengedSince,
  eligibleMap,
  foundersOf,
  friendlyTeamOf,
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
  cupPresetOf,
  cupTeamOf,
  setTeamPresets,
  teamPlayerCard,
  toLineupCareer,
  type OwnerTeamRow,
} from '../db/repos/ownerTeams.js';
import { membersOf } from '../db/repos/memberships.js';
import { achievementRankOf } from '../db/repos/ownerAchievements.js';
import { teamCoachOf } from '../db/repos/managers.js';
import {
  activeBalanceQuery,
  balanceVersionOf,
  matchRechargeFrom,
  enhanceOpenFrom,
  leagueFatigueFrom,
} from '../db/repos/balance.js';
import { leagueMatches, ownerTeams } from '../db/schema.js';
import { FATIGUE_LOOKBACK, startStreaks } from '../team/fatigue.js';
import { and, desc, eq, isNotNull, or } from 'drizzle-orm';
import { edgeCached, purgeEdge, waitUntil } from '../edgeCache.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { refreshAfterChange, refreshOwnerAchievements } from '../team/ownerAchievements.js';
import {
  buildLineup,
  filledCount,
  lineupOvr,
  matchOdds,
  oddsPercent,
  rankedAtkK,
  simulateMatch,
} from '../team/sim.js';
import { lineupsOf, matchDetailOf, matchNotice, matchViews, playedMatch } from '../team/match.js';
import { teamStatsView } from '../team/stats.js';
import {
  MATCH_POOL,
  MATCH_POOL_CHECK,
  MATCH_REPICKS,
  matchRatingChange,
  nearestCandidates,
  pickCandidate,
} from '../team/rank.js';
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
import { toOwnerTeam, recordOf, seasonOptions } from '../team/view.js';
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

/** T-11-627 경기 전 예상(내 팀이 홈). 경기 한 판과 같은 명단 · 공격 계수 · 감독으로 계산한다. */
async function opponentOdds(db: Db, season: number, mine: OwnerTeamRow, opp: OwnerTeamRow) {
  const [[active], lineups] = await Promise.all([
    activeBalanceQuery(db),
    lineupsOf(db, season, mine, opp),
  ]);
  if (filledCount(lineups.home) === 0 || filledCount(lineups.away) === 0) return null;
  const { rankAtkK } = resolveBalance(active ? balanceVersionOf(active).values : undefined);
  return oddsPercent(
    matchOdds(lineups.home, lineups.away, season, {
      atkK: rankedAtkK(season, rankAtkK),
      coaches: lineups.coaches,
    }),
  );
}

const teamRequired = () => conflictError('먼저 이번 시즌 팀을 만들어 주세요.', 'TEAM_REQUIRED');
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

/** 재대결 감쇠를 세는 기간의 시작(오늘 포함 TEAM_REPEAT_WINDOW_DAYS일, 한국 시각 자정 기준). */
const repeatWindowStart = (now: string) => kstDays(new Date(now), TEAM_REPEAT_WINDOW_DAYS).startIso;

/** 오늘 건 경기로 센 남은 경기 수와 다음 충전 시각(응답에 그대로 펼친다). */
const matchAllowance = (
  played: readonly { createdAt: string }[],
  now: string,
  rechargeMin: number,
) => {
  const { left, nextAt } = teamMatchAllowance(
    played.map((m) => m.createdAt),
    now,
    kstTodayStart(now),
    rechargeMin,
  );
  return { matchesLeft: left, matchesNextAt: nextAt };
};

/** T-11-310 감독 칸에 든 내 감독(끝낸 감독만, 없으면 null). */
const coachOf = teamCoachOf;

/**
 * T-11-571 내 팀의 리그 체력(켜져 있을 때만). 이 팀의 최근 리그 경기 몇 판의 선발로 다음 라운드 기준 연속 선발 수를 센다.
 * 꺼져 있으면 쿼리하지 않는다.
 */
async function fatigueOf(
  db: Db,
  teamId: string,
  season: number,
  balance: Parameters<typeof leagueFatigueFrom>[0],
) {
  const rate = leagueFatigueFrom(balance);
  if (rate <= 0) return null;
  const played = await db
    .select({
      round: leagueMatches.round,
      homeTeamId: leagueMatches.homeTeamId,
      awayTeamId: leagueMatches.awayTeamId,
      detailJson: leagueMatches.detailJson,
    })
    .from(leagueMatches)
    .where(
      and(
        eq(leagueMatches.season, season),
        isNotNull(leagueMatches.playedAt),
        or(eq(leagueMatches.homeTeamId, teamId), eq(leagueMatches.awayTeamId, teamId)),
      ),
    )
    .orderBy(desc(leagueMatches.round))
    .limit(FATIGUE_LOOKBACK);
  const next = (played[0]?.round ?? 0) + 1;
  return { rate, streaks: Object.fromEntries(startStreaks(played, teamId, next)) };
}

export function registerOwnerTeamRoutes(app: Hono<AppEnv>): void {
  // 내 팀(보고 있는 시즌) + 그 시즌에 넣을 수 있는 은퇴 선수 + 오늘 남은 경기 수. 화면을 열 때 한 번 부른다(웹 메모 1분).
  app.get('/v1/owner-team', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const season = seasonQuery(c, now);
    const todayStart = kstTodayStart(now);
    const [teams, players, played, openLive, founder, [balance], member, cupSeasons] =
      await db.batch([
        listMyTeams(db, me.id),
        listEligibleCareers(db, me.id, season),
        challengedAtSince(db, me.id, todayStart),
        openLiveSince(db, me.id, todayStart),
        foundersOf(db, [me.id]),
        activeBalanceQuery(db),
        membersOf(db, [me.id], now),
        activeCupSeasonsQuery(db, me.id),
      ]);
    const current = teamSeasonAt(now);
    // T-11-552 끝나지 않은 컵에 참가 중인 지난 시즌(시즌 1 제3회 컵). 그 시즌 팀은 컵 명단으로 고친다.
    const cupSeason =
      cupSeasons.map((r) => r.season).find((s) => current !== null && s > 0 && s < current) ?? null;
    // T-11-113 개막 뒤의 프리시즌 팀은 친선전용 편성을 보이고 고친다(지금 가진 선수만).
    const editableSeason = season === current || season === 0 || season === cupSeason;
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
    const fatigue =
      team && season === current ? await fatigueOf(db, team.id, season, balance) : null;
    return ok(
      c,
      OwnerTeamResponseSchema,
      {
        season,
        current,
        cupSeason,
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
        ...matchAllowance([...played, ...openLive], now, matchRechargeFrom(balance)),
        matchesPerDay: TEAM_MATCHES_PER_DAY,
        // 급여 예산은 없앴다. OTA 전의 옛 앱이 편성을 막지 않게 닿지 않는 값을 보낸다.
        pastSalaryBudget: LEGACY_NO_SALARY_BUDGET,
        // T-11-373 강화 버튼을 보일지(이미 읽은 활성 밸런스 한 줄).
        enhanceOpen: enhanceOpenFrom(balance),
        founder: founder.length > 0,
        member: member.length > 0,
        // 컵 성적은 최근 대회부터 온다 — 첫 우승이 가장 최근 우승.
        ownerTitle: me.title,
        ...(fatigue ? { fatigue } : {}),
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
    const { row, lineup, eligible, coach, season, friendly } = await saveOwnerTeam(
      db,
      me.id,
      input,
      now,
      {
        currentSeasonOrThrow,
        checkCupLineup,
      },
    );
    if (!friendly) {
      purgeEdge(c, STALE.teamSaved(season));
      waitUntil(c, refreshAfterChange(db, me.id, season));
    }
    return ok(c, PutOwnerTeamResponseSchema, {
      team: toOwnerTeam(row, lineup, eligible, reqLang(c), coach),
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
    // T-11-570 감독은 리그 · 컵 모두에 나가므로 컵 검사는 컵 명단(프리셋이 있으면 그 편성)으로 한다.
    const cupTeam = cupTeamOf(team);
    const ids = slotIdsOf(cupTeam).filter((x): x is string => x !== null);
    await checkCupLineup(db, me.id, season, ids, cupTeam.filled, now, cupTeam.ovr);
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
  // T-11-570 컵 명단 프리셋은 컵에 그대로 나가므로, 컵 명단이 바뀔 때(지정 · 해제 · 편성 변경)만 팀 저장과 같은 선수 · 컵 검사를 한다.
  app.put('/v1/owner-team/presets', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const input = readBody(c, PutTeamPresetsBodySchema);
    const now = nowIso();
    const current = teamSeasonAt(now);
    const season = input.season ?? currentSeasonOrThrow(now);
    const db = getDb(c);
    await checkEditableSeason(db, me.id, season, current);
    const [team] = await myTeamIn(db, me.id, season);
    if (!team) throw teamNotFound();
    const before = cupPresetOf(team);
    const next = input.presets.find((p) => p.cup);
    // OVR · 선발 수는 서버가 채운다(보낸 값은 버린다).
    let presets = input.presets.map(({ ovr: _ovr, filled: _filled, ...p }) => p as TeamPreset);
    const lineupKey = (p: TeamPreset | null | undefined) =>
      p ? JSON.stringify([p.formation, p.slots, p.layout]) : null;
    let fixed: { ovr: number; filled: number } | null =
      before && before.ovr !== undefined ? { ovr: before.ovr, filled: before.filled ?? 0 } : null;
    if (lineupKey(before) !== lineupKey(next)) {
      if (next) {
        const { ids, eligible } = await checkLineupPlayers(db, me.id, season, current, next.slots);
        const lineup = buildLineup(next.formation, next.slots, eligible, next.layout);
        fixed = { ovr: lineupOvr(lineup), filled: filledCount(lineup) };
        await checkCupLineup(db, me.id, season, ids, fixed.filled, now, fixed.ovr, {
          league: false,
        });
      } else {
        // 컵 명단을 풀면 팀 명단이 다시 컵에 나간다.
        const ids = slotIdsOf(team).filter((x): x is string => x !== null);
        await checkCupLineup(db, me.id, season, ids, team.filled, now, team.ovr, {
          league: false,
        });
      }
    }
    if (next && fixed) presets = presets.map((p) => (p.cup ? { ...p, ...fixed } : p));
    const [row] = await setTeamPresets(db, me.id, season, presets);
    if (!row) throw teamNotFound();
    return ok(c, PutTeamPresetsResponseSchema, { presets });
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
    const ladder = usesRankLadder(season);
    const todayStart = kstTodayStart(now);
    const [candidates, [played, live]] = await Promise.all([
      listOpponentCandidates(
        db,
        me.id,
        season,
        { rating: mine.rating, ovr: mine.ovr },
        todayStart,
        ladder ? MATCH_POOL_CHECK : undefined,
      ),
      ladder
        ? db.batch([challengedSince(db, me.id, todayStart), openLiveSince(db, me.id, todayStart)])
        : Promise.resolve([[], []] as const),
    ]);
    // 오늘 건 경기(마감 전 장면 경기 포함) 수와 그 상대들 — 장면 경기 중인 상대는 후보에서 뺀다.
    const used = played.length + live.length;
    const busy = new Set(live.map((m) => m.teamId));
    if (ladder) {
      // T-11-510 자동 매칭: 가까운 후보 중 (구단주, 날짜, 오늘 치른 경기 수, 몇 번째 상대)로 정한 한 팀. 같은 값이면 같은 상대다.
      const pick = Math.min(
        MATCH_REPICKS,
        Math.max(0, Math.trunc(Number(c.req.query('pick') ?? 0)) || 0),
      );
      const chosen = pickCandidate(
        nearestCandidates(
          candidates.filter((t) => !busy.has(t.id)),
          mine,
          MATCH_POOL,
        ),
        `${me.id}:${todayStart}:${used}:${pick}`,
      );
      candidates.splice(0, candidates.length, ...(chosen ? [chosen] : []));
    }
    // 가까운 팀 중에서 무작위로(매번 같은 상대만 나오지 않게).
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }
    // T-11-627 자동 매칭이 고른 한 팀의 경기 전 예상. 매칭 찾기를 눌렀을 때만 오는 요청이라 명단을 이때만 읽는다.
    const matched = ladder ? candidates[0] : undefined;
    const odds = matched ? await opponentOdds(db, season, mine, matched) : null;
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
        ...(odds ? { odds } : {}),
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
    // T-11-375 디비전 경계 · 강등 보호는 활성 밸런스에서 — 같은 batch로 읽어 왕복을 늘리지 않는다.
    const [[mine], recorded, open, [opp], [active]] = await db.batch([
      myTeamIn(db, me.id, season),
      challengedAtSince(db, me.id, kstTodayStart(now)),
      openLiveSince(db, me.id, kstTodayStart(now)),
      liveTeam(db, input.opponentTeamId),
      activeBalanceQuery(db),
    ]);
    const activeBalance = resolveBalance(active ? balanceVersionOf(active).values : undefined);
    const divisions = divisionRules(activeBalance);
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
    const rechargeMin = activeBalance.teamMatchRechargeMin;
    if (matchAllowance(challenged, now, rechargeMin).matchesLeft === 0) {
      throw rateLimited(
        `오늘 경기는 모두 치렀어요(하루 ${TEAM_MATCHES_PER_DAY}경기). 시간이 지나면 1경기씩 더 열려요.`,
        'TEAM_MATCH_DAILY_LIMIT',
      );
    }
    if (!opp || opp.team.profileId === me.id || opp.team.season !== season) throw teamNotFound();
    // T-11-510 자동 매칭 시즌에는 고른 상대가 지금도 가까운 후보 안에 있어야 한다(그 사이 점수가 크게 바뀌면 새 상대를 받는다).
    if (usesRankLadder(season)) {
      const near = nearestCandidates(
        await listOpponentCandidates(
          db,
          me.id,
          season,
          { rating: mine.rating, ovr: mine.ovr },
          kstTodayStart(now),
          MATCH_POOL_CHECK,
        ),
        mine,
        MATCH_POOL_CHECK,
      );
      if (!near.some((t) => t.id === opp.team.id))
        throw conflictError(
          '상대 팀 점수가 바뀌어 새 상대를 찾았어요. 다시 경기를 시작해 주세요.',
          'TEAM_OPPONENT_STALE',
        );
    }
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
    // 이 경기까지 친 뒤의 남은 경기와 다음 충전 시각.
    const after = matchAllowance([...challenged, { createdAt: now }], now, rechargeMin);
    if (input.live) {
      // T-11-387 장면 경기: 일반 골과 장면을 굴려 두고, 마지막 장면을 고르거나 마감할 때 경기를 남긴다.
      const state = startLiveMatch(id, lineups.home, lineups.away, season, {
        atkK: rankedAtkK(season, activeBalance.rankAtkK),
        coaches: lineups.coaches,
      });
      const snap = matchDetailOf(mine, opp.team, lineups, liveResult(state), undefined, {
        xi: true,
      });
      const payload = livePayload(
        season,
        state,
        { home: snap.home, away: snap.away },
        { home: filledCount(lineups.home), away: filledCount(lineups.away) },
        lineups,
        Number(met?.n ?? 0),
        after.matchesLeft,
        after.matchesNextAt,
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
      atkK: rankedAtkK(season, activeBalance.rankAtkK),
      coaches: lineups.coaches,
    });
    const score = matchScore(result.homeGoals, result.awayGoals);
    // 시즌 1(엘로)은 홈 이점과 최근 재대결 감쇠를 넣고, 시즌 2부터는 RP 사다리(T-11-510)다.
    const delta = matchRatingChange(season, mine, opp.team, score, Number(met?.n ?? 0));
    const detail = matchDetailOf(mine, opp.team, lineups, result, delta, { xi: true });
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
          divisions,
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
        // 읽은 레이팅으로 셈한 값이다(같은 순간 받은 경기가 있으면 저장값과 한 칸 다를 수 있고, 다음 팀 응답이 바로잡는다).
        ...(usesRankLadder(season)
          ? {
              division: {
                from: clampDivision(mine.division),
                to: nextDivision(mine.rating + delta.home, mine.division, divisions),
              },
            }
          : {}),
        ...after,
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
    const db = getDb(c);
    const { groups, row } = await refreshOwnerAchievements(db, me, season, now, false);
    // T-11-489 상위 비율 시즌은 등급이 순위로 정해져 순위를 함께 준다(랭킹 인원은 업적 화면과 같은 엣지 캐시).
    const standing = achTierByRank(season)
      ? await achievementRankOf(db, row, (load) =>
          edgeCached(c, EDGE.achRanked(season), ACH_RANKED_TTL, load),
        )
      : {};
    return ok(
      c,
      ClubAchievementNotificationsSchema,
      {
        season,
        groups: localizeAchievements(groups, reqLang(c)),
        score: row.score,
        ...standing,
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
    const { groups, row, players, bonus } = await refreshOwnerAchievements(
      db,
      me,
      season,
      now,
      false,
    );
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
        ...(bonus ? { bonus } : {}),
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
