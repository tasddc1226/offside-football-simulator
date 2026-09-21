import { clamp } from './clamp.js';
import type { ReputationRules, Ruleset } from './ruleset.js';
import type { CareerState, SeasonResult } from './types.js';

/**
 * 결산에서 평판을 올리는 타이틀 조건은 경기 결과의 파생값이 아니라 결산 대회 기록을 읽는다.
 * 리그 우승은 position 1, 컵 우승은 cupRound 'WON'으로 이미 season-stats가 기록한다.
 */
export function seasonWonTitle(result: Pick<SeasonResult, 'competitions'>): boolean {
  return result.competitions.some(
    (competition) =>
      (competition.kind === 'LEAGUE' && competition.position === 1) ||
      (competition.kind === 'CUP' && competition.cupRound === 'WON'),
  );
}

/** A promotion-zone finish is a truthful reward signal; it does not move the club between leagues. */
export function seasonReachedPromotionZone(
  result: Pick<SeasonResult, 'competitions'>,
  ruleset: Ruleset,
): boolean {
  const league = result.competitions.find((competition) => competition.kind === 'LEAGUE');
  if (league?.position === null || league?.position === undefined) return false;
  const policy = ruleset.leagues.find((candidate) => candidate.id === league.competitionId);
  return (
    policy !== undefined && policy.promotionSlots > 0 && league.position <= policy.promotionSlots
  );
}

/**
 * T-4-003: 결산 popularity delta를 계산한다. signed delta 자체는 decay를 보존하고,
 * 최종 popularity 상태만 0..clampMax로 자른다. mediaCenti는 이 함수에서 읽거나 쓰지 않는다.
 */
export function computeSettlementPopularityDelta(
  result: Pick<SeasonResult, 'selectionSummary' | 'playerStats' | 'competitions'>,
  rules: ReputationRules,
  ruleset?: Ruleset,
): number {
  const averageRatingTenths =
    result.playerStats.ratedMatches === 0
      ? 0
      : Math.round(result.playerStats.ratingSumTenths / result.playerStats.ratedMatches);
  const rawDelta =
    -rules.settlement.decayCenti +
    (result.selectionSummary.squadRoleAtEnd === 'STARTER'
      ? rules.settlement.starterSeasonCenti
      : 0) +
    (averageRatingTenths >= 70 ? rules.settlement.ratingAbove70Centi : 0) +
    (seasonWonTitle(result) ? rules.settlement.titleCenti : 0) +
    (rules.settlement.promotionCenti !== undefined &&
    ruleset !== undefined &&
    seasonReachedPromotionZone(result, ruleset)
      ? rules.settlement.promotionCenti
      : 0);
  return rawDelta;
}

/** 짧은 별칭은 순수 계산기를 사용하는 호출부·테스트가 읽기 쉽게 유지한다. */
export const computePopularityDelta = computeSettlementPopularityDelta;

/** 결산 평판 적용. 상태의 market value cache는 만들지 않고 popularity만 갱신한다. */
export function applySettlementReputation(
  state: CareerState,
  result: SeasonResult,
  ruleset: Ruleset,
): CareerState {
  const delta = computeSettlementPopularityDelta(result, ruleset.reputationRules, ruleset);
  return {
    ...state,
    reputation: {
      ...state.reputation,
      popularityCenti: clamp(
        state.reputation.popularityCenti + delta,
        0,
        ruleset.reputationRules.clampMax,
      ),
    },
  };
}
