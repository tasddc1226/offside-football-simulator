import type {
  CareerState,
  Contract,
  Position,
  PositionStatsTotals,
  TimelineEntry,
} from '@offside/domain';
import type { ConditionContext, SeasonStat } from '../schema/condition.ts';
import { SEASON_STATS } from '../schema/condition.ts';
import { ATTRIBUTE_KEYS } from '../schema/ruleset.ts';

/**
 * domain의 `positionGroupOf`와 같은 매핑이다. content는 domain 런타임 함수를 import할 수
 * 없으므로(ADR-005, 타입만 import) 이 pure 매핑을 복제한다. Position에 새 값이 추가되면
 * 이 switch가 컴파일 오류를 낸다.
 */
function resolvePositionGroup(position: Position): string {
  switch (position) {
    case 'GK':
      return 'GK';
    case 'CB':
    case 'FB':
      return 'DEF';
    case 'DM':
    case 'CM':
    case 'AM':
      return 'MID';
    case 'W':
    case 'ST':
      return 'FWD';
  }
}

// Phase 1 도메인에 아직 없는 값들의 기본값. 04 이벤트 엔진 문서의 조건 DSL 화이트리스트에는
// 있지만 CareerState가 아직 채우지 않는 필드들이다(부상·계약 잔여기간·경쟁 순위 등).
const NOT_MODELED_INT = 0;
const NOT_MODELED_STRING = '';
// rng.injuryRoll: 아직 부상 굴림 파이프라인이 없다. lte 비교(EVT-INJ-001)가 기본값에서
// 걸리지 않도록 최댓값(roll100 상한)을 기본값으로 둔다. 실제 롤이 생기면 이 필드를 채운다.
const NO_INJURY_ROLL = 100;

/**
 * F2(T-4-015): 파생 뒤에도 상수(NOT_MODELED)로 남는 조건 필드 → 값. `buildConditionContext`가
 * 이 객체를 그대로 context에 spread하고, `validate-pack.ts`의 `checkConstantFieldTriggers`는
 * `NOT_MODELED_CONDITION_FIELDS`(이 객체의 키 목록)만으로 트리거가 구성된 이벤트에 경고를 낸다.
 * 필드를 실값으로 바꾸려면 이 객체에서 지우고 context 조립부에 실제 파생식을 추가한다 — 별도
 * 목록을 손으로 맞추지 않는다.
 */
const NOT_MODELED_FIELDS = {
  'context.managerTrust': NOT_MODELED_INT,
  'context.competitionRank': NOT_MODELED_INT,
  'contract.monthsRemaining': NOT_MODELED_INT,
  'contract.wageBand': NOT_MODELED_STRING,
  'rng.injuryRoll': NO_INJURY_ROLL,
} as const;

export const NOT_MODELED_CONDITION_FIELDS: readonly string[] = Object.keys(NOT_MODELED_FIELDS);

// F1(T-4-015): 평점 표본이 0건이면 슬럼프류 lt(recentFormAvg, N) 조건이 걸리지 않도록 하는 상한
// sentinel(모든 슬럼프 임계값보다 큰 값). recentRatedMatches 게이트(최근 5경기 중 평점 받은 경기
// 수 ≥ 3)와 함께 써서 이중으로 막는다 — sentinel 하나만으로는 팩 저작자가 실수로 100 이상 임계를
// 쓰면 다시 뚫릴 수 있어서다.
const NO_SLUMP_FORM_SAMPLE = 100;

/**
 * ADR-010 유도식(`lengthSeasons − 서명 이후 SEASON_STARTED 횟수`)을 그대로 복제한다.
 * content는 domain 런타임 함수를 import할 수 없으므로(ADR-005, 타입만 import) domain의
 * `computeContractSeasonsRemaining`과 동일한 계산을 여기서도 순수 함수로 둔다.
 */
function computeSeasonsRemaining(contract: Contract, timeline: readonly TimelineEntry[]): number {
  const seasonsServed = timeline.filter(
    (entry) => entry.kind === 'SEASON_STARTED' && entry.revision > contract.signedAtRevision,
  ).length;
  return Math.max(0, contract.lengthSeasons - seasonsServed);
}

/**
 * T-4-001 D-49: domain effects.ts `findActiveEpisodeIndex`와 같은 규칙("활성 에피소드" = status가
 * ACTIVE 또는 REHAB인 것 중 배열 마지막 항목)을 content가 domain 런타임을 import할 수 없어(ADR-005)
 * 여기서 다시 복제한다.
 */
function findActiveEpisode(
  episodes: CareerState['health']['episodes'],
): CareerState['health']['episodes'][number] | null {
  for (let i = episodes.length - 1; i >= 0; i--) {
    const episode = episodes[i]!;
    if (episode.status === 'ACTIVE' || episode.status === 'REHAB') return episode;
  }
  return null;
}

/** T-4-003 정의를 그대로 유지: 활성 시즌의 non-null 평점 중 최근 최대 5개(경기 순서, null은 표본에서
 * 제외). recentFormAvg·recentRatedMatches 둘 다 이 표본에서 파생한다. */
function recentRatings(state: CareerState): number[] {
  if (state.season === null) return [];
  return state.season.matches
    .map((match) => match.ratingTenths)
    .filter((rating): rating is number => rating !== null)
    .slice(-5);
}

/** F1(T-4-015): 표본이 없으면(시즌 밖이거나 평점 받은 경기가 하나도 없으면) 슬럼프 lt 조건이 걸리지
 * 않는 sentinel을 낸다. 이전에는 0을 내 출전 0경기 선수에게도 EVT-SLUMP-010이 열렸다. */
function recentFormAverage(ratings: readonly number[]): number {
  if (ratings.length === 0) return NO_SLUMP_FORM_SAMPLE;
  return Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);
}

/** F2(T-4-015): `state.season.playerStats.totals`는 포지션군마다 다른 판별 유니언이라(FW만 goals를
 * 가진다) season.stats.goals/assists는 그룹별로 값이 있을 때만 실값을, 없으면 0을 낸다. */
function seasonStatGoals(totals: PositionStatsTotals): number {
  return totals.group === 'FW' ? totals.goals : 0;
}

function seasonStatAssists(totals: PositionStatsTotals): number {
  return totals.group === 'FW' || totals.group === 'MF' ? totals.assists : 0;
}

/** F2(T-4-015): 조건 DSL의 8개 season.stats 필드를 `state.season.playerStats`에서 파생한다. season이
 * 없으면(시즌 사이) 전부 0. 단위: rating은 ratingSumTenths 평균을 내림한 값(×10 정수, recentFormAvg와
 * 같은 스케일 — 평균 7.2 → 72). PR 본문에 이 단위를 그대로 옮긴다. */
function computeSeasonStats(state: CareerState): Record<SeasonStat, number> {
  const stats = state.season?.playerStats;
  if (!stats) {
    return {
      goals: 0,
      assists: 0,
      appearances: 0,
      starts: 0,
      minutes: 0,
      rating: 0,
      yellowCards: 0,
      redCards: 0,
    };
  }
  return {
    goals: seasonStatGoals(stats.totals),
    assists: seasonStatAssists(stats.totals),
    appearances: stats.appearances.total,
    starts: stats.appearances.started,
    minutes: stats.minutes,
    rating: stats.ratedMatches > 0 ? Math.floor(stats.ratingSumTenths / stats.ratedMatches) : 0,
    yellowCards: stats.yellow,
    redCards: stats.red,
  };
}

function proSeasonCount(state: CareerState): number {
  return state.seasonHistory.filter((summary) =>
    state.clubHistory.some(
      (stint) => stint.teamId === summary.teamId && stint.leagueTier !== 'YOUTH',
    ),
  ).length;
}

/** `CareerState`를 04 이벤트 엔진 조건 DSL(`ConditionContext`)로 매핑한다. */
export function buildConditionContext(state: CareerState): ConditionContext {
  const profile = state.player.profile;
  const contract = state.contract;
  const seasonsRemaining = contract
    ? computeSeasonsRemaining(contract, state.timeline)
    : NOT_MODELED_INT;
  const activeEpisode = findActiveEpisode(state.health.episodes);
  const recentRatingsSample = recentRatings(state);

  const context: ConditionContext = {
    'career.age': state.age,
    'career.stage': state.stage,
    'contract.teamId': state.contract?.teamId ?? '',
    'career.currentRole': state.contract?.rolePromise ?? 'RESERVE',
    'career.tags': state.tags,
    'career.proSeasons': proSeasonCount(state),

    'player.primaryPosition': profile?.primaryPosition ?? NOT_MODELED_STRING,
    'player.backgroundId': profile?.backgroundId ?? NOT_MODELED_STRING,
    'player.positionGroup': profile
      ? resolvePositionGroup(profile.primaryPosition)
      : NOT_MODELED_STRING,
    'player.archetypeId': profile?.archetypeId ?? NOT_MODELED_STRING,
    'player.baseOvr': profile?.baseOvr ?? NOT_MODELED_INT,

    'state.form': state.state.form,
    'state.fitness': state.state.fitness,
    'state.morale': state.state.morale,

    'context.tacticalFit': state.context.tacticalFit,
    'context.squadStatus': state.context.squadStatus,

    'relationships.managerTrust': state.relationships.managerTrust,
    'relationships.captain': state.relationships.captain,
    'relationships.rival': state.relationships.rival,
    'relationships.fans': state.relationships.fans,
    'relationships.agent': state.relationships.agent,

    'season.step': state.currentStep,
    'season.phase': state.seasonPhase,
    'season.simulationMode': state.simulationMode,
    'season.tags': [],
    'season.chapterHighlights': 0,

    'contract.rolePromise': state.contract?.rolePromise ?? NOT_MODELED_STRING,
    ...NOT_MODELED_FIELDS,

    // T-4-001: Phase 1 경로 두 개. health.injuryEpisode는 스키마 type이 'string'이라(condition.ts,
    // T-4-001 이전부터 예약된 값) 1/0을 문자열로 낸다.
    'health.injuryEpisode': activeEpisode !== null ? '1' : '0',
    'health.recurrenceRisk': Math.floor((activeEpisode?.recurrenceRiskBp ?? 0) / 100),

    // T-3-001 D-53: 트랙 A(계약·이적) 조건 화이트리스트. seasonsRemaining은 "지금 진행 중인 시즌
    // 뒤에 남은 시즌 수"다 — 예: 2시즌 계약을 시즌 1 시작 전 서명 → 시즌 1 진행 중 remaining
    // 1(마지막 아님), 시즌 2 진행 중 remaining 0(마지막). 시즌 사이(season === null)에는 isLastSeason이
    // 항상 0이고, 그때는 contract.seasonsRemaining으로 판단한다.
    'contract.kind': contract?.kind ?? NOT_MODELED_STRING,
    'contract.seasonsRemaining': seasonsRemaining,
    'contract.isLastSeason':
      state.season !== null && contract !== null && seasonsRemaining === 0 ? 1 : 0,
    'contract.promiseBreaches': contract?.promiseBreaches ?? NOT_MODELED_INT,
    'contract.onLoan': contract?.kind === 'LOAN' ? 1 : 0,
    'contract.leagueTier': contract ? String(contract.leagueTier) : NOT_MODELED_STRING,
    'career.permanentTransfers': state.clubHistory.filter(
      (stint) => stint.endReason === 'TRANSFERRED',
    ).length,
    'career.clubsCount': new Set(state.clubHistory.map((stint) => stint.teamId)).size,

    // T-3-001 D-53 예약. 부상·감독 교체 필드는 현재 상태에서 읽고, 최근 폼은 저장하지 않는
    // 활성 시즌 경기 rating의 파생값으로 계산한다.
    'health.activeSeverity': activeEpisode?.severity ?? NOT_MODELED_STRING,
    'health.recurrenceRiskBp': activeEpisode?.recurrenceRiskBp ?? NOT_MODELED_INT,
    'health.majorInjuries': state.health.episodes.filter((episode) => episode.severity === 'MAJOR')
      .length,
    'reputation.popularityCenti': state.reputation.popularityCenti,
    'season.manager.tenureSeasons': state.season?.manager?.tenureSeasons ?? NOT_MODELED_INT,
    'season.manager.id': state.season?.manager?.id ?? NOT_MODELED_STRING,
    'season.stats.recentFormAvg': recentFormAverage(recentRatingsSample),
    'season.stats.recentRatedMatches': recentRatingsSample.length,
  };

  for (const key of ATTRIBUTE_KEYS) {
    context[`player.attributes.${key}`] = state.attributes[key];
  }
  const seasonStats = computeSeasonStats(state);
  for (const stat of SEASON_STATS) {
    context[`season.stats.${stat}`] = seasonStats[stat];
  }

  return context;
}
