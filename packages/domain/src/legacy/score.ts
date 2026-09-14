/** RULE-LEG-002. Inputs are normalized by the separate raw-record adapter in result.ts. */
export type LegacyComponentScores = {
  achievement: number;
  contribution: number;
  longevity: number;
  relationship: number;
  narrative: number;
};

export const LEGACY_COMPONENT_WEIGHTS = Object.freeze({
  achievement: 30,
  contribution: 25,
  longevity: 15,
  relationship: 15,
  narrative: 15,
} satisfies LegacyComponentScores);

export type LegacyBandId =
  'BAND-LEGEND' | 'BAND-ICON' | 'BAND-REMEMBERED' | 'BAND-SOLID' | 'BAND-COMPLETE';

export type LegacyScoreSummary = {
  componentScores: LegacyComponentScores;
  totalScore: number;
  bandId: LegacyBandId;
};

function requireScore(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
    throw new RangeError('Legacy scores must be integers between 0 and 100.');
  }
}

/** Original (1.0.0/1.1.0) band cuts. Never change — persisted results rely on them staying fixed. */
export const LEGACY_BAND_CUTS = Object.freeze({ LEGEND: 90, ICON: 75, REMEMBERED: 50, SOLID: 25 });
export type LegacyBandCuts = Readonly<{
  LEGEND: number;
  ICON: number;
  REMEMBERED: number;
  SOLID: number;
}>;

export function legacyBandForScore(
  totalScore: number,
  cuts: LegacyBandCuts = LEGACY_BAND_CUTS,
): LegacyBandId {
  requireScore(totalScore);
  if (totalScore >= cuts.LEGEND) return 'BAND-LEGEND';
  if (totalScore >= cuts.ICON) return 'BAND-ICON';
  if (totalScore >= cuts.REMEMBERED) return 'BAND-REMEMBERED';
  if (totalScore >= cuts.SOLID) return 'BAND-SOLID';
  return 'BAND-COMPLETE';
}

/** No OVR, identity, clock, reference population or RNG input. Does not produce a full LegacyResult. */
export function calculateLegacyScore(
  scores: Readonly<LegacyComponentScores>,
  cuts?: LegacyBandCuts,
): LegacyScoreSummary {
  let weightedTotal = 0;
  const componentScores: LegacyComponentScores = {
    achievement: scores.achievement,
    contribution: scores.contribution,
    longevity: scores.longevity,
    relationship: scores.relationship,
    narrative: scores.narrative,
  };
  for (const component of Object.keys(LEGACY_COMPONENT_WEIGHTS) as Array<
    keyof LegacyComponentScores
  >) {
    requireScore(componentScores[component]);
    weightedTotal += componentScores[component] * LEGACY_COMPONENT_WEIGHTS[component];
  }
  // Keep the numerator integral; round once after summing, not once per component.
  const totalScore = Math.floor((weightedTotal + 50) / 100);
  return { componentScores, totalScore, bandId: legacyBandForScore(totalScore, cuts) };
}
