import type { CareerState } from '../types.js';
import { assessRetirement, type RetirementIntent, type RetirementPolicy } from './retirement.js';

/** Phase 5 policy 1.0.0. Age alone is at most 25/100 and can never force a review. */
export const RETIREMENT_POLICY: RetirementPolicy = Object.freeze({
  version: '1.0.0',
  ageBands: Object.freeze(
    [
      { fromAge: 0, pressure: 0 },
      { fromAge: 30, pressure: 25 },
      { fromAge: 34, pressure: 60 },
      { fromAge: 38, pressure: 100 },
    ].map((band) => Object.freeze(band)),
  ),
  weights: Object.freeze({ age: 25, injury: 20, market: 20, opportunity: 20, intent: 15 }),
  injuryAbsenceWeight: 70,
  undecidedIntentPressure: 50,
  watchThreshold: 40,
  reviewThreshold: 65,
});

export function assessCareerRetirement(state: CareerState, intent: RetirementIntent = 'UNDECIDED') {
  const season = state.seasonHistory.at(-1);
  if (season === undefined) return null;
  const stats = season.result.playerStats;
  const remaining =
    state.contract === null
      ? 0
      : Math.max(
          0,
          state.contract.signedSeasonIndex +
            state.contract.lengthSeasons -
            state.seasonHistory.length -
            1,
        );
  // Only explicit injury absences count; substitution/selection/service counts are not a proxy.
  // Old ledgers lack this evidence, so preserve their non-forcing, unknown-market assessment.
  return assessRetirement(
    {
      age: state.age,
      durability: state.state.fitness,
      injuryMissedMatches: season.result.legacy?.injuryMissedMatches ?? 0,
      scheduledMatches: stats.appearances.total,
      minutes: stats.minutes,
      possibleMinutes: season.result.selectionSummary.possibleMinutes,
      eligibleOfferCount:
        season.result.legacy?.injuryMissedMatches === undefined
          ? null
          : (state.retirement?.marketOffers ?? null),
      contractRemainingSeasons: remaining,
      intent,
    },
    RETIREMENT_POLICY,
  );
}

export function retirementContinuationOptions(state: CareerState) {
  if (
    state.status !== 'ACTIVE' ||
    state.season !== null ||
    state.retirement?.lastChanceConsumed === true ||
    state.pending?.kind !== 'OFFERS'
  )
    return [];
  const tier = state.contract?.leagueTier;
  return state.pending.offers
    .filter((offer) => offer.negotiationState !== 'WITHDRAWN' && offer.lengthSeasons <= 1)
    .map((offer) => ({
      choice:
        typeof tier === 'number' && typeof offer.leagueTier === 'number' && offer.leagueTier > tier
          ? ('LOWER_LEAGUE' as const)
          : ('LAST_CONTRACT' as const),
      offerId: offer.id,
      teamName: offer.teamName,
    }));
}

export function retirementDecisionRequired(state: CareerState): boolean {
  if (
    state.retirement?.lastChanceConsumed === true &&
    state.retirement.lastChanceSeasonIndex !== null
  )
    return state.seasonHistory.length >= state.retirement.lastChanceSeasonIndex;
  return assessCareerRetirement(state)?.status === 'REVIEW';
}
