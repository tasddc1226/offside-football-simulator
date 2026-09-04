import type { CareerState, Contract, Position, TimelineEntry } from '@offside/domain';
import type { ConditionContext } from '../schema/condition.ts';
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
function findActiveEpisode(episodes: CareerState['health']['episodes']): CareerState['health']['episodes'][number] | null {
  for (let i = episodes.length - 1; i >= 0; i--) {
    const episode = episodes[i]!;
    if (episode.status === 'ACTIVE' || episode.status === 'REHAB') return episode;
  }
  return null;
}

function recentFormAverage(state: CareerState): number {
  if (state.season === null) return 0;
  const ratings = state.season.matches
    .map((match) => match.ratingTenths)
    .filter((rating): rating is number => rating !== null)
    .slice(-5);
  if (ratings.length === 0) return 0;
  return Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);
}

function proSeasonCount(state: CareerState): number {
  return state.seasonHistory.filter((summary) =>
    state.clubHistory.some((stint) => stint.teamId === summary.teamId && stint.leagueTier !== 'YOUTH'),
  ).length;
}

/** `CareerState`를 04 이벤트 엔진 조건 DSL(`ConditionContext`)로 매핑한다. */
export function buildConditionContext(state: CareerState): ConditionContext {
  const profile = state.player.profile;
  const contract = state.contract;
  const seasonsRemaining = contract ? computeSeasonsRemaining(contract, state.timeline) : NOT_MODELED_INT;
  const activeEpisode = findActiveEpisode(state.health.episodes);

  const context: ConditionContext = {
    'career.age': state.age,
    'career.stage': state.stage,
    'career.currentRole': state.contract?.rolePromise ?? 'RESERVE',
    'career.tags': state.tags,
    'career.proSeasons': proSeasonCount(state),

    'player.primaryPosition': profile?.primaryPosition ?? NOT_MODELED_STRING,
    'player.positionGroup': profile ? resolvePositionGroup(profile.primaryPosition) : NOT_MODELED_STRING,
    'player.archetypeId': profile?.archetypeId ?? NOT_MODELED_STRING,
    'player.baseOvr': profile?.baseOvr ?? NOT_MODELED_INT,

    'state.form': state.state.form,
    'state.fitness': state.state.fitness,
    'state.morale': state.state.morale,

    'context.tacticalFit': state.context.tacticalFit,
    'context.managerTrust': NOT_MODELED_INT,
    'context.squadStatus': state.context.squadStatus,
    'context.competitionRank': NOT_MODELED_INT,

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

    'contract.monthsRemaining': NOT_MODELED_INT,
    'contract.rolePromise': state.contract?.rolePromise ?? NOT_MODELED_STRING,
    'contract.wageBand': NOT_MODELED_STRING,

    // T-4-001: Phase 1 경로 두 개. health.injuryEpisode는 스키마 type이 'string'이라(condition.ts,
    // T-4-001 이전부터 예약된 값) 1/0을 문자열로 낸다.
    'health.injuryEpisode': activeEpisode !== null ? '1' : '0',
    'health.recurrenceRisk': Math.floor((activeEpisode?.recurrenceRiskBp ?? 0) / 100),

    'rng.injuryRoll': NO_INJURY_ROLL,

    // T-3-001 D-53: 트랙 A(계약·이적) 조건 화이트리스트. seasonsRemaining은 "지금 진행 중인 시즌
    // 뒤에 남은 시즌 수"다 — 예: 2시즌 계약을 시즌 1 시작 전 서명 → 시즌 1 진행 중 remaining
    // 1(마지막 아님), 시즌 2 진행 중 remaining 0(마지막). 시즌 사이(season === null)에는 isLastSeason이
    // 항상 0이고, 그때는 contract.seasonsRemaining으로 판단한다.
    'contract.kind': contract?.kind ?? NOT_MODELED_STRING,
    'contract.seasonsRemaining': seasonsRemaining,
    'contract.isLastSeason': state.season !== null && contract !== null && seasonsRemaining === 0 ? 1 : 0,
    'contract.promiseBreaches': contract?.promiseBreaches ?? NOT_MODELED_INT,
    'contract.onLoan': contract?.kind === 'LOAN' ? 1 : 0,
    'contract.leagueTier': contract ? String(contract.leagueTier) : NOT_MODELED_STRING,
    'career.permanentTransfers': state.clubHistory.filter((stint) => stint.endReason === 'TRANSFERRED').length,
    'career.clubsCount': new Set(state.clubHistory.map((stint) => stint.teamId)).size,

    // T-3-001 D-53 예약. 부상·감독 교체 필드는 현재 상태에서 읽고, 최근 폼은 저장하지 않는
    // 활성 시즌 경기 rating의 파생값으로 계산한다.
    'health.activeSeverity': activeEpisode?.severity ?? NOT_MODELED_STRING,
    'health.recurrenceRiskBp': activeEpisode?.recurrenceRiskBp ?? NOT_MODELED_INT,
    'health.majorInjuries': state.health.episodes.filter((episode) => episode.severity === 'MAJOR').length,
    'reputation.popularityCenti': state.reputation.popularityCenti,
    'season.manager.tenureSeasons': state.season?.manager?.tenureSeasons ?? NOT_MODELED_INT,
    'season.manager.id': state.season?.manager?.id ?? NOT_MODELED_STRING,
    'season.stats.recentFormAvg': recentFormAverage(state),
  };

  for (const key of ATTRIBUTE_KEYS) {
    context[`player.attributes.${key}`] = state.attributes[key];
  }
  for (const stat of SEASON_STATS) {
    context[`season.stats.${stat}`] = 0;
  }

  return context;
}
