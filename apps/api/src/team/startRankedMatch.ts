import type { PlayTeamMatchBody, PlayTeamMatchResponse } from '@offside/contracts';
import { TEAM_MATCHES_PER_DAY, matchScore, usesRankLadder } from '@offside/contracts/owner-team';
import { resolveBalance } from '@offside/contracts/balance';
import { divisionRules } from '@offside/contracts/team-division';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import {
  challengedAtSince,
  listOpponentCandidates,
  liveTeam,
  meetingsSince,
  myTeamIn,
  recordMatchStatements,
} from '../db/repos/ownerTeams.js';
import { activeBalanceQuery, balanceVersionOf } from '../db/repos/balance.js';
import { insertLive, openLiveSince } from '../db/repos/teamLive.js';
import { commitNotifiedEvent } from '../push/events.js';
import { STALE } from '../edgeKeys.js';
import { kstTodayStart } from '../time.js';
import type { Lang } from '../lang.js';
import { conflictError, rateLimited, teamNotFound } from '../routes/shared.js';
import { refreshAfterChange } from './ownerAchievements.js';
import { filledCount, rankedAtkK, simulateMatch } from './sim.js';
import { lineupsOf, matchDetailOf, matchNotice, playedMatch } from './match.js';
import { MATCH_POOL_CHECK, matchRatingChange, nearestCandidates } from './rank.js';
import { liveDone, liveResult, startLiveMatch } from './moments.js';
import {
  finalizeLive,
  finishOpenLive,
  livePayload,
  liveStartResponse,
  refreshBoth,
} from './liveMatch.js';
import {
  currentSeasonOrThrow,
  matchAllowance,
  repeatWindowStart,
  teamRequired,
} from './matchPolicy.js';
import { rankedMatchProgress } from './rankedMatchProgress.js';

type MatchEffects = {
  background(work: Promise<unknown>): void;
  invalidate(paths: string[]): void;
};

/** Ranked-match command; the HTTP adapter owns background lifetime and cache origin. */
export async function startRankedMatch(
  db: Db,
  profileId: string,
  input: PlayTeamMatchBody,
  now: string,
  lang: Lang,
  effects: MatchEffects,
): Promise<PlayTeamMatchResponse> {
  const season = currentSeasonOrThrow(now);
  // T-11-375 디비전 경계 · 강등 보호는 활성 밸런스에서 — 같은 batch로 읽어 왕복을 늘리지 않는다.
  const [[mine], recorded, open, [opp], [active]] = await db.batch([
    myTeamIn(db, profileId, season),
    challengedAtSince(db, profileId, kstTodayStart(now)),
    openLiveSince(db, profileId, kstTodayStart(now)),
    liveTeam(db, input.opponentTeamId),
    activeBalanceQuery(db),
  ]);
  const activeBalance = resolveBalance(active ? balanceVersionOf(active).values : undefined);
  const divisions = divisionRules(activeBalance);
  if (!mine) throw teamRequired();
  // T-11-387 아직 끝나지 않은 장면 경기도 오늘 경기로 센다. 떠난 경기는 여기서 자동 선택으로 마감한다(cron보다 먼저).
  if (open.length)
    effects.background(
      finishOpenLive(
        db,
        open.map((o) => o.id),
        now,
        lang,
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
  if (!opp || opp.team.profileId === profileId || opp.team.season !== season) throw teamNotFound();
  // T-11-510 자동 매칭 시즌에는 고른 상대가 지금도 가까운 후보 안에 있어야 한다(그 사이 점수가 크게 바뀌면 새 상대를 받는다).
  if (usesRankLadder(season)) {
    const near = nearestCandidates(
      await listOpponentCandidates(
        db,
        profileId,
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
      profileId,
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
        lang,
      );
      if (!f) throw teamNotFound();
      effects.invalidate(STALE.teamMatchPlayed(f.homeTeamId, f.awayTeamId));
      effects.background(refreshBoth(db, f));
      return f.response;
    }
    await insertLive(db, row);
    return liveStartResponse(row, payload, mine, opp.team, lang);
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
        profileId,
        home: homeSide,
        away: awaySide,
        detail,
        now,
        divisions,
      }),
    ],
    matchNotice(id, mine, opp.team, result.homeGoals, result.awayGoals, now),
  );
  effects.invalidate(STALE.teamMatchPlayed(mine.id, opp.team.id));
  // 상대 팀 기록(승패·레이팅)도 바뀌어 두 구단주 점수를 함께 센다.
  effects.background(
    Promise.all([
      refreshAfterChange(db, profileId, season),
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
  return {
    match: playedMatch(head, detail, lineups, mine, opp.team, lang),
    ...rankedMatchProgress(season, mine, score, delta.home, divisions),
    ...after,
  };
}
