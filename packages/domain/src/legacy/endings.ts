import { compareCodePoints } from '../canonical.js';

/** RULE-LEG-006 ordering only. eligibility.ts establishes eligibility from result.ts evidence. */
export const LEGACY_ENDING_PRIORITIES = Object.freeze({
  'END-WORLD-PIONEER': 5,
  'END-SECOND-HOME': 6,
  'END-HOMECOMING': 7,
  'END-OVERSEAS-CHALLENGER': 70,
  'END-ONE-CLUB-LEGEND': 10,
  'END-NATIONAL-HERO': 15,
  'END-UNCROWNED-KING': 20,
  'END-DERBY-HERO': 25,
  'END-PROMOTION-CAPTAIN': 30,
  'END-LOAN-LEGEND': 35,
  'END-COMEBACK-PLAYER': 40,
  'END-IRONMAN': 42,
  'END-PLAYER-COACH': 45,
  'END-MENTOR': 50,
  'END-LATE-BLOOMER': 55,
  'END-JOURNEYMAN': 60,
  'END-CONTROVERSIAL-STAR': 65,
  'END-COMPLETE-SHORT': 999,
});

export type LegacyEndingId = keyof typeof LEGACY_ENDING_PRIORITIES;
export type LegacyEndingResolution = {
  endingId: LegacyEndingId;
  endingCandidates: LegacyEndingId[];
};

const FALLBACK: LegacyEndingId = 'END-COMPLETE-SHORT';

function requireEnding(id: LegacyEndingId): void {
  if (!Object.prototype.hasOwnProperty.call(LEGACY_ENDING_PRIORITIES, id)) {
    throw new RangeError('Unknown Legacy ending ID.');
  }
}

/** Deduplicates eligibility evidence; fallback is never an alternative to a meaningful ending. */
export function resolveLegacyEndings(
  eligibleIds: readonly LegacyEndingId[],
): LegacyEndingResolution {
  for (const id of eligibleIds) requireEnding(id);
  const ordered = [...new Set(eligibleIds)]
    .filter((id) => id !== FALLBACK)
    .sort(
      (a, b) =>
        LEGACY_ENDING_PRIORITIES[a] - LEGACY_ENDING_PRIORITIES[b] || compareCodePoints(a, b),
    );
  return { endingId: ordered[0] ?? FALLBACK, endingCandidates: ordered.slice(1, 3) };
}

/** Display preference is separate from the immutable computed ending (RULE-LEG-006). */
export function selectLegacyDisplayEnding(
  resolution: Readonly<LegacyEndingResolution>,
  requestedId: LegacyEndingId,
): LegacyEndingId {
  requireEnding(requestedId);
  if (requestedId !== resolution.endingId && !resolution.endingCandidates.includes(requestedId)) {
    throw new RangeError('Display ending must be the primary ending or one of its candidates.');
  }
  return requestedId;
}
