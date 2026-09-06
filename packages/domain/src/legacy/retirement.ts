import { canonicalize, type JsonValue } from '../canonical.js';
import { sha256Hex } from '../hash.js';

const FACTORS = ['age', 'injury', 'market', 'opportunity', 'intent'] as const;
type Factor = (typeof FACTORS)[number];
type FactorScores = Record<Factor, number>;
export type RetirementIntent = 'CONTINUE' | 'UNDECIDED' | 'RETIRE';

/** Verified evidence from one settled season. Unknown market assessment is NOT zero offers. */
export type RetirementFacts = Readonly<{
  age: number;
  durability: number;
  injuryMissedMatches: number;
  scheduledMatches: number;
  minutes: number;
  possibleMinutes: number;
  eligibleOfferCount: number | null;
  contractRemainingSeasons: number;
  intent: RetirementIntent;
}>;

/** Caller supplies a versioned policy; there is deliberately no production default. */
export type RetirementPolicy = Readonly<{
  version: string;
  ageBands: ReadonlyArray<Readonly<{ fromAge: number; pressure: number }>>;
  weights: Readonly<FactorScores>;
  injuryAbsenceWeight: number;
  undecidedIntentPressure: number;
  watchThreshold: number;
  reviewThreshold: number;
}>;

export type RetirementAssessment = Readonly<{
  policyVersion: string;
  policyHash: string;
  factsHash: string;
  missing: readonly ('MARKET_DEMAND' | 'MATCH_EXPOSURE' | 'MINUTE_EXPOSURE')[];
  total: number | null;
  status: 'INSUFFICIENT_EVIDENCE' | 'CONTINUE' | 'WATCH' | 'REVIEW';
  factors: Readonly<FactorScores> | null;
  /** Exact score × weight numerators, fixed order. No per-factor rounding. */
  contributions: Readonly<FactorScores> | null;
}>;

function hash(value: unknown): string {
  return sha256Hex(canonicalize(value as JsonValue));
}

function integer(value: number, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new RangeError(`Retirement: invalid ${label}.`);
}

function identifier(value: string) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200)
    throw new RangeError('Retirement: invalid identifier.');
}

function percentage(part: number, whole: number): number {
  // Safe even near MAX_SAFE_INTEGER; multiplying Number by 100 can lose integer precision.
  return Number((BigInt(part) * 100n + BigInt(whole) / 2n) / BigInt(whole));
}

function validatePolicy(policy: RetirementPolicy): void {
  identifier(policy.version);
  for (const key of FACTORS) integer(policy.weights[key], `weight ${key}`, 0, 100);
  if (FACTORS.reduce((sum, key) => sum + policy.weights[key], 0) !== 100)
    throw new RangeError('Retirement: weights must sum to 100.');
  integer(policy.injuryAbsenceWeight, 'injury absence weight', 0, 100);
  integer(policy.undecidedIntentPressure, 'undecided intent pressure', 0, 100);
  integer(policy.watchThreshold, 'watch threshold', 1, 99);
  integer(policy.reviewThreshold, 'review threshold', policy.watchThreshold + 1, 100);
  if (
    policy.weights.age >= policy.reviewThreshold ||
    policy.weights.injury >= policy.reviewThreshold
  )
    throw new RangeError('Retirement: age or injury alone must not trigger review.');
  if (policy.ageBands.length === 0 || policy.ageBands[0]?.fromAge !== 0)
    throw new RangeError('Retirement: age bands must begin at zero.');
  let previousAge = -1;
  let previousPressure = -1;
  for (const band of policy.ageBands) {
    integer(band.fromAge, 'band age', previousAge + 1, 120);
    integer(band.pressure, 'band pressure', Math.max(0, previousPressure), 100);
    previousAge = band.fromAge;
    previousPressure = band.pressure;
  }
}

export function assessRetirement(
  facts: RetirementFacts,
  policy: RetirementPolicy,
): RetirementAssessment {
  validatePolicy(policy);
  integer(facts.age, 'age', 0, 120);
  integer(facts.durability, 'durability', 0, 100);
  integer(facts.scheduledMatches, 'scheduled matches');
  integer(facts.injuryMissedMatches, 'injury missed matches', 0, facts.scheduledMatches);
  integer(facts.possibleMinutes, 'possible minutes');
  integer(facts.minutes, 'minutes', 0, facts.possibleMinutes);
  integer(facts.contractRemainingSeasons, 'remaining contract seasons');
  if (facts.eligibleOfferCount !== null) integer(facts.eligibleOfferCount, 'eligible offers');
  if (!['CONTINUE', 'UNDECIDED', 'RETIRE'].includes(facts.intent))
    throw new RangeError('Retirement: invalid intent.');
  const missing: Array<'MARKET_DEMAND' | 'MATCH_EXPOSURE' | 'MINUTE_EXPOSURE'> = [];
  if (facts.eligibleOfferCount === null) missing.push('MARKET_DEMAND');
  if (facts.scheduledMatches === 0) missing.push('MATCH_EXPOSURE');
  if (facts.possibleMinutes === 0) missing.push('MINUTE_EXPOSURE');
  const base = {
    policyVersion: policy.version,
    policyHash: hash(policy),
    factsHash: hash(facts),
    missing: Object.freeze(missing),
  };
  if (missing.length > 0)
    return Object.freeze({
      ...base,
      total: null,
      status: 'INSUFFICIENT_EVIDENCE',
      factors: null,
      contributions: null,
    });
  const age = policy.ageBands.findLast((band) => band.fromAge <= facts.age)!.pressure;
  const absence = percentage(facts.injuryMissedMatches, facts.scheduledMatches);
  const injury = Math.round(
    (absence * policy.injuryAbsenceWeight +
      (100 - facts.durability) * (100 - policy.injuryAbsenceWeight)) /
      100,
  );
  const factors = Object.freeze({
    age,
    injury,
    market: facts.eligibleOfferCount! > 0 || facts.contractRemainingSeasons > 0 ? 0 : 100,
    opportunity: 100 - percentage(facts.minutes, facts.possibleMinutes),
    intent:
      facts.intent === 'RETIRE'
        ? 100
        : facts.intent === 'CONTINUE'
          ? 0
          : policy.undecidedIntentPressure,
  });
  const contributions = Object.freeze(
    Object.fromEntries(
      FACTORS.map((key) => [key, factors[key] * policy.weights[key]]),
    ) as FactorScores,
  );
  const total = Math.round(FACTORS.reduce((sum, key) => sum + contributions[key], 0) / 100);
  const status =
    total >= policy.reviewThreshold
      ? 'REVIEW'
      : total >= policy.watchThreshold
        ? 'WATCH'
        : 'CONTINUE';
  return Object.freeze({ ...base, total, status, factors, contributions });
}

export type RetirementChoice = 'LAST_CONTRACT' | 'LOWER_LEAGUE' | 'COACH_EPILOGUE' | 'RETIRE';
export type RetirementBoundary = Readonly<{
  careerId: string;
  revision: number;
  settledSeasonIndex: number;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED' | 'ARCHIVED';
  hasPending: boolean;
  hasActiveSeason: boolean;
  lastChanceConsumed: boolean;
  /** Already verified eligible offers; null means unavailable, never fabricate a contract. */
  lastContractOfferId: string | null;
  lowerLeagueOfferId: string | null;
}>;
export type RetirementDecision = Readonly<{
  decisionId: string;
  careerId: string;
  expectedRevision: number;
  settledSeasonIndex: number;
  assessment: RetirementAssessment;
  options: ReadonlyArray<Readonly<{ choice: RetirementChoice; offerId: string | null }>>;
}>;

/** Planning only: neither starts a contract nor mutates CareerState, RNG, Archive or status. */
export function createRetirementDecision(
  boundary: RetirementBoundary,
  facts: RetirementFacts,
  policy: RetirementPolicy,
): RetirementDecision {
  identifier(boundary.careerId);
  integer(boundary.revision, 'revision', 1);
  integer(boundary.settledSeasonIndex, 'season index');
  for (const flag of [boundary.hasPending, boundary.hasActiveSeason, boundary.lastChanceConsumed]) {
    if (typeof flag !== 'boolean') throw new RangeError('Retirement: invalid boundary flag.');
  }
  if (boundary.status !== 'ACTIVE' || boundary.hasPending || boundary.hasActiveSeason)
    throw new RangeError('Retirement: unsettled or inactive boundary.');
  for (const offer of [boundary.lastContractOfferId, boundary.lowerLeagueOfferId]) {
    if (offer !== null) identifier(offer);
  }
  if (
    boundary.lastContractOfferId !== null &&
    boundary.lastContractOfferId === boundary.lowerLeagueOfferId
  )
    throw new RangeError('Retirement: duplicate offer route.');
  const assessment = assessRetirement(facts, policy);
  if (facts.intent !== 'RETIRE' && assessment.status !== 'REVIEW')
    throw new RangeError('Retirement: decision is not due.');
  const options: Array<{ choice: RetirementChoice; offerId: string | null }> = [];
  if (!boundary.lastChanceConsumed) {
    if (boundary.lastContractOfferId !== null)
      options.push({ choice: 'LAST_CONTRACT', offerId: boundary.lastContractOfferId });
    if (boundary.lowerLeagueOfferId !== null)
      options.push({ choice: 'LOWER_LEAGUE', offerId: boundary.lowerLeagueOfferId });
  }
  options.push({ choice: 'COACH_EPILOGUE', offerId: null }, { choice: 'RETIRE', offerId: null });
  const body = {
    careerId: boundary.careerId,
    expectedRevision: boundary.revision,
    settledSeasonIndex: boundary.settledSeasonIndex,
    assessment,
    options: Object.freeze(options.map((option) => Object.freeze(option))),
  };
  return Object.freeze({ decisionId: `ret_${hash(body)}`, ...body });
}

export type RetirementResolution = Readonly<{
  decisionId: string;
  expectedRevision: number;
  choice: RetirementChoice;
  offerId: string | null;
  /** Must be persisted atomically with a successful contract command, never on preview. */
  consumesLastChance: boolean;
  next: 'CONTRACT_CONFIRMATION' | 'RETIREMENT_CONFIRMATION';
}>;

/** Same decision+choice is reusable; changing a resolved choice or replaying another revision fails. */
export function resolveRetirementDecision(
  decision: RetirementDecision,
  request: Readonly<{ decisionId: string; expectedRevision: number; choice: RetirementChoice }>,
  existing: RetirementResolution | null = null,
): Readonly<{ kind: 'INSERT' | 'REUSE'; resolution: RetirementResolution }> {
  if (
    request.decisionId !== decision.decisionId ||
    request.expectedRevision !== decision.expectedRevision
  )
    throw new RangeError('Retirement: stale decision.');
  const option = decision.options.find((item) => item.choice === request.choice);
  if (!option) throw new RangeError('Retirement: unavailable choice.');
  const contract = option.offerId !== null;
  const resolution: RetirementResolution = Object.freeze({
    decisionId: decision.decisionId,
    expectedRevision: decision.expectedRevision,
    choice: option.choice,
    offerId: option.offerId,
    consumesLastChance: contract,
    next: contract ? 'CONTRACT_CONFIRMATION' : 'RETIREMENT_CONFIRMATION',
  });
  if (existing !== null && hash(existing) !== hash(resolution))
    throw new RangeError('Retirement: conflicting resolution.');
  return Object.freeze({ kind: existing === null ? 'INSERT' : 'REUSE', resolution });
}
