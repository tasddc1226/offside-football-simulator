import { resolveLegacyEndings, type LegacyEndingResolution } from './endings.js';

/**
 * Legacy eligibility policy 1.0.0: facts are evaluated from an Archive adapter,
 * then the existing immutable priority resolver selects the representative ending.
 * This module does not calculate scores, mutate an Archive, or introduce new tags.
 */
export type LegacyEndingFacts = Readonly<{
  oneClubSeasons: number;
  fans: number;
  nationalCaps: number;
  decisiveInternational: boolean;
  trophies: number;
  achievement: number;
  contribution: number;
  derbySuccesses: number;
  promotions: number;
  captainSeasons: number;
  starterSeasonsAfterLoan: number;
  seasonsAfterComeback: number;
  seasonsAfterThirty: number;
  totalSeasons: number;
  peakOvr: number;
  finalChoice: 'RETIRE' | 'COACH_EPILOGUE';
  tags: readonly string[];
}>;

const TAGS = new Set([
  'TAG-ONE-CLUB',
  'TAG-UNCROWNED',
  'TAG-DERBY-HERO',
  'TAG-PROMOTION-EXPERT',
  'TAG-LOAN-LEGEND',
  'TAG-COMEBACK',
  'TAG-IRONMAN',
  'TAG-MENTOR',
  'TAG-LATE-BLOOMER',
  'TAG-JOURNEYMAN',
  'TAG-TRAITOR',
  'TAG-CONTROVERSIAL',
]);

function integer(value: unknown, label: string, max = 100): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError(`Legacy eligibility: invalid ${label}.`);
  }
}

function validateFacts(facts: LegacyEndingFacts): void {
  if (facts === null || typeof facts !== 'object')
    throw new RangeError('Legacy eligibility: facts required.');
  integer(facts.oneClubSeasons, 'oneClubSeasons', Number.MAX_SAFE_INTEGER);
  integer(facts.fans, 'fans');
  integer(facts.nationalCaps, 'nationalCaps', Number.MAX_SAFE_INTEGER);
  if (typeof facts.decisiveInternational !== 'boolean')
    throw new RangeError('Legacy eligibility: invalid decisiveInternational.');
  integer(facts.trophies, 'trophies', Number.MAX_SAFE_INTEGER);
  integer(facts.achievement, 'achievement');
  integer(facts.contribution, 'contribution');
  integer(facts.derbySuccesses, 'derbySuccesses', Number.MAX_SAFE_INTEGER);
  integer(facts.promotions, 'promotions', Number.MAX_SAFE_INTEGER);
  integer(facts.captainSeasons, 'captainSeasons', Number.MAX_SAFE_INTEGER);
  integer(facts.starterSeasonsAfterLoan, 'starterSeasonsAfterLoan', Number.MAX_SAFE_INTEGER);
  integer(facts.seasonsAfterComeback, 'seasonsAfterComeback', Number.MAX_SAFE_INTEGER);
  integer(facts.seasonsAfterThirty, 'seasonsAfterThirty', Number.MAX_SAFE_INTEGER);
  integer(facts.totalSeasons, 'totalSeasons', Number.MAX_SAFE_INTEGER);
  integer(facts.peakOvr, 'peakOvr');
  if (facts.finalChoice !== 'RETIRE' && facts.finalChoice !== 'COACH_EPILOGUE') {
    throw new RangeError('Legacy eligibility: invalid finalChoice.');
  }
  if (!Array.isArray(facts.tags) || facts.tags.some((tag) => typeof tag !== 'string')) {
    throw new RangeError('Legacy eligibility: invalid tags.');
  }
}

function hasTag(facts: LegacyEndingFacts, tag: string): boolean {
  return TAGS.has(tag) && facts.tags.includes(tag);
}

export function evaluateLegacyEndings(facts: LegacyEndingFacts): LegacyEndingResolution {
  validateFacts(facts);
  const eligible: Array<Parameters<typeof resolveLegacyEndings>[0][number]> = [];

  if (hasTag(facts, 'TAG-ONE-CLUB') && facts.oneClubSeasons >= 10 && facts.fans >= 80)
    eligible.push('END-ONE-CLUB-LEGEND');
  if (facts.nationalCaps >= 30 || facts.decisiveInternational) eligible.push('END-NATIONAL-HERO');
  if (
    hasTag(facts, 'TAG-UNCROWNED') &&
    facts.trophies === 0 &&
    facts.achievement >= 60 &&
    facts.contribution >= 80
  )
    eligible.push('END-UNCROWNED-KING');
  if (hasTag(facts, 'TAG-DERBY-HERO') && facts.derbySuccesses >= 3) eligible.push('END-DERBY-HERO');
  if (hasTag(facts, 'TAG-PROMOTION-EXPERT') && facts.promotions >= 2 && facts.captainSeasons >= 1)
    eligible.push('END-PROMOTION-CAPTAIN');
  if (hasTag(facts, 'TAG-LOAN-LEGEND') && facts.starterSeasonsAfterLoan >= 3)
    eligible.push('END-LOAN-LEGEND');
  if (hasTag(facts, 'TAG-COMEBACK') && facts.seasonsAfterComeback >= 3)
    eligible.push('END-COMEBACK-PLAYER');
  if (hasTag(facts, 'TAG-IRONMAN')) eligible.push('END-IRONMAN');
  if (facts.finalChoice === 'COACH_EPILOGUE') eligible.push('END-PLAYER-COACH');
  if (hasTag(facts, 'TAG-MENTOR') && facts.seasonsAfterThirty >= 3) eligible.push('END-MENTOR');
  // Base OVR 70+, not the unrelated Legacy score's BAND-REMEMBERED boundary.
  if (hasTag(facts, 'TAG-LATE-BLOOMER') && facts.peakOvr >= 70) eligible.push('END-LATE-BLOOMER');
  if (hasTag(facts, 'TAG-JOURNEYMAN') && facts.totalSeasons >= 8) eligible.push('END-JOURNEYMAN');
  if (
    facts.achievement >= 60 &&
    (hasTag(facts, 'TAG-TRAITOR') || hasTag(facts, 'TAG-CONTROVERSIAL'))
  )
    eligible.push('END-CONTROVERSIAL-STAR');

  return resolveLegacyEndings(eligible);
}
