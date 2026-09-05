import { describe, expect, it } from 'vitest';
import {
  assessRetirement,
  createRetirementDecision,
  resolveRetirementDecision,
  type RetirementBoundary,
  type RetirementFacts,
  type RetirementPolicy,
} from './retirement.js';

// TEST-ONLY policy: not a production balance table, ruleset entry, or registry manifest.
const policy: RetirementPolicy = {
  version: 'test-retirement-1',
  ageBands: [
    { fromAge: 0, pressure: 0 },
    { fromAge: 30, pressure: 25 },
    { fromAge: 34, pressure: 60 },
    { fromAge: 38, pressure: 100 },
  ],
  weights: { age: 25, injury: 20, market: 20, opportunity: 20, intent: 15 },
  injuryAbsenceWeight: 70,
  undecidedIntentPressure: 50,
  watchThreshold: 40,
  reviewThreshold: 65,
};
const healthy: RetirementFacts = {
  age: 25,
  durability: 100,
  injuryMissedMatches: 0,
  scheduledMatches: 20,
  minutes: 1800,
  possibleMinutes: 1800,
  eligibleOfferCount: 1,
  contractRemainingSeasons: 1,
  intent: 'CONTINUE',
};
const high: RetirementFacts = {
  ...healthy,
  age: 40,
  durability: 0,
  injuryMissedMatches: 20,
  minutes: 0,
  eligibleOfferCount: 0,
  contractRemainingSeasons: 0,
  intent: 'RETIRE',
};
const boundary: RetirementBoundary = {
  careerId: 'career-retirement',
  revision: 50,
  settledSeasonIndex: 10,
  status: 'ACTIVE',
  hasPending: false,
  hasActiveSeason: false,
  lastChanceConsumed: false,
  lastContractOfferId: 'offer-final',
  lowerLeagueOfferId: 'offer-lower',
};

describe('retirement pressure evidence', () => {
  it('has no pressure for a healthy wanted starter who wants to continue', () => {
    expect(assessRetirement(healthy, policy)).toMatchObject({
      total: 0,
      status: 'CONTINUE',
      missing: [],
    });
  });
  it('explains a high score with all five contributions without retiring the career', () => {
    const result = assessRetirement(high, policy);
    expect(result).toMatchObject({
      total: 100,
      status: 'REVIEW',
      contributions: { age: 2500, injury: 2000, market: 2000, opportunity: 2000, intent: 1500 },
    });
    expect(result).not.toHaveProperty('careerStatus');
  });
  it.each([
    [29, 0],
    [30, 25],
    [33, 25],
    [34, 60],
    [37, 60],
    [38, 100],
    [120, 100],
  ])('age %i has factor %i', (age, score) => {
    expect(assessRetirement({ ...healthy, age }, policy).factors?.age).toBe(score);
  });
  it('neither age alone nor injury alone requests review', () => {
    expect(assessRetirement({ ...healthy, age: 120 }, policy).status).toBe('CONTINUE');
    expect(
      assessRetirement({ ...healthy, durability: 0, injuryMissedMatches: 20 }, policy).status,
    ).toBe('CONTINUE');
  });
  it('distinguishes injury absences from total bench time and weights durability', () => {
    expect(assessRetirement({ ...healthy, minutes: 0 }, policy).factors).toMatchObject({
      injury: 0,
      opportunity: 100,
    });
    expect(assessRetirement({ ...healthy, durability: 0 }, policy).factors?.injury).toBe(30);
    expect(assessRetirement({ ...healthy, injuryMissedMatches: 10 }, policy).factors?.injury).toBe(
      35,
    );
  });
  it.each([
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 100],
  ])(
    'offers %i / contract %i yields market %i',
    (eligibleOfferCount, contractRemainingSeasons, market) => {
      expect(
        assessRetirement({ ...healthy, eligibleOfferCount, contractRemainingSeasons }, policy)
          .factors?.market,
      ).toBe(market);
    },
  );
  it('does not convert unknown demand or absent exposure into zero evidence', () => {
    const result = assessRetirement(
      { ...healthy, eligibleOfferCount: null, minutes: 0, possibleMinutes: 0, scheduledMatches: 0 },
      policy,
    );
    expect(result).toMatchObject({
      status: 'INSUFFICIENT_EVIDENCE',
      total: null,
      factors: null,
      missing: ['MARKET_DEMAND', 'MATCH_EXPOSURE', 'MINUTE_EXPOSURE'],
    });
  });
  it('keeps the total rounding after the weighted sum', () => {
    const result = assessRetirement({ ...healthy, age: 30, intent: 'UNDECIDED' }, policy);
    expect(result.contributions).toMatchObject({ age: 625, intent: 750 });
    expect(result.total).toBe(14);
  });
  it('uses exact integer ratios even near safe integer limits', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(
      assessRetirement(
        {
          ...healthy,
          minutes: max - 1,
          possibleMinutes: max,
          injuryMissedMatches: max - 1,
          scheduledMatches: max,
        },
        policy,
      ).factors,
    ).toMatchObject({ opportunity: 0, injury: 70 });
  });
  it('honors watch/review threshold inclusivity', () => {
    const facts = { ...healthy, eligibleOfferCount: 0, contractRemainingSeasons: 0, minutes: 0 };
    expect(assessRetirement(facts, policy)).toMatchObject({ total: 40, status: 'WATCH' });
    expect(assessRetirement({ ...facts, age: 38 }, policy)).toMatchObject({
      total: 65,
      status: 'REVIEW',
    });
  });
  it.each([
    { age: -1 },
    { age: 121 },
    { age: 30.5 },
    { durability: 101 },
    { durability: NaN },
    { minutes: 1801 },
    { minutes: -1 },
    { possibleMinutes: Infinity },
    { injuryMissedMatches: 21 },
    { scheduledMatches: -1 },
    { eligibleOfferCount: -1 },
    { contractRemainingSeasons: -1 },
    { intent: 'UNKNOWN' },
    { possibleMinutes: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid facts %j', (patch) => {
    expect(() => assessRetirement({ ...healthy, ...patch } as RetirementFacts, policy)).toThrow(
      RangeError,
    );
  });
  it.each([
    { version: '' },
    { ageBands: [] },
    { ageBands: [{ fromAge: 1, pressure: 0 }] },
    {
      ageBands: [
        { fromAge: 0, pressure: 30 },
        { fromAge: 20, pressure: 20 },
      ],
    },
    {
      ageBands: [
        { fromAge: 0, pressure: 0 },
        { fromAge: 0, pressure: 20 },
      ],
    },
    { weights: { ...policy.weights, intent: 16 } },
    { weights: { age: 65, injury: 0, market: 20, opportunity: 0, intent: 15 } },
    { weights: { age: 0, injury: 65, market: 20, opportunity: 0, intent: 15 } },
    { reviewThreshold: 40 },
    { watchThreshold: 0 },
    { injuryAbsenceWeight: 101 },
    { undecidedIntentPressure: -1 },
  ])('rejects invalid policy %j', (patch) => {
    expect(() => assessRetirement(healthy, { ...policy, ...patch })).toThrow(RangeError);
  });
  it('is repeatable, immutable and exposes definition/facts drift', () => {
    const original = JSON.stringify({ healthy, policy });
    const a = assessRetirement(healthy, policy);
    for (let i = 0; i < 100; i++) expect(assessRetirement(healthy, policy)).toEqual(a);
    expect(JSON.stringify({ healthy, policy })).toBe(original);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.factors)).toBe(true);
    expect(Object.isFrozen(a.missing)).toBe(true);
    expect(assessRetirement(high, policy).factsHash).not.toBe(a.factsHash);
    expect(
      assessRetirement(healthy, { ...policy, undecidedIntentPressure: 30 }).policyHash,
    ).not.toBe(a.policyHash);
  });
});

describe('last-choice planning without engine mutation', () => {
  it('offers only verified routes and preserves caller input', () => {
    const original = JSON.stringify({ boundary, high, policy });
    const decision = createRetirementDecision(boundary, high, policy);
    expect(decision.options.map((option) => option.choice)).toEqual([
      'LAST_CONTRACT',
      'LOWER_LEAGUE',
      'COACH_EPILOGUE',
      'RETIRE',
    ]);
    expect(JSON.stringify({ boundary, high, policy })).toBe(original);
    expect(createRetirementDecision(boundary, high, policy)).toEqual(decision);
    expect(Object.isFrozen(decision.options[0])).toBe(true);
    expect(
      createRetirementDecision({ ...boundary, revision: 51 }, high, policy).decisionId,
    ).not.toBe(decision.decisionId);
  });
  it('does not invent offers or reopen an already consumed last chance', () => {
    for (const patch of [
      { lastContractOfferId: null, lowerLeagueOfferId: null },
      { lastChanceConsumed: true },
    ]) {
      expect(
        createRetirementDecision({ ...boundary, ...patch }, high, policy).options.map(
          (option) => option.choice,
        ),
      ).toEqual(['COACH_EPILOGUE', 'RETIRE']);
    }
  });
  it('blocks pressure-triggered decisions without evidence but permits voluntary retirement', () => {
    expect(() => createRetirementDecision(boundary, healthy, policy)).toThrow('not due');
    expect(() =>
      createRetirementDecision(
        boundary,
        { ...high, eligibleOfferCount: null, intent: 'CONTINUE' },
        policy,
      ),
    ).toThrow('not due');
    const decision = createRetirementDecision(
      { ...boundary, settledSeasonIndex: 0 },
      { ...healthy, eligibleOfferCount: null, intent: 'RETIRE' },
      policy,
    );
    expect(decision.assessment.status).toBe('INSUFFICIENT_EVIDENCE');
  });
  it.each([
    { status: 'RETIRED' },
    { status: 'ARCHIVED' },
    { status: 'DRAFT' },
    { hasPending: true },
    { hasActiveSeason: true },
    { revision: 0 },
    { settledSeasonIndex: -1 },
    { careerId: '' },
    { lastContractOfferId: '' },
    { lowerLeagueOfferId: 'offer-final' },
    { hasPending: undefined },
  ])('rejects invalid boundary %j', (patch) => {
    expect(() =>
      createRetirementDecision({ ...boundary, ...patch } as RetirementBoundary, high, policy),
    ).toThrow(RangeError);
  });
  it.each(['LAST_CONTRACT', 'LOWER_LEAGUE', 'COACH_EPILOGUE', 'RETIRE'] as const)(
    'plans %s without claiming contract/retirement completion',
    (choice) => {
      const decision = createRetirementDecision(boundary, high, policy);
      const request = { decisionId: decision.decisionId, expectedRevision: 50, choice };
      const first = resolveRetirementDecision(decision, request);
      const contract = choice === 'LAST_CONTRACT' || choice === 'LOWER_LEAGUE';
      expect(first).toMatchObject({
        kind: 'INSERT',
        resolution: {
          choice,
          consumesLastChance: contract,
          next: contract ? 'CONTRACT_CONFIRMATION' : 'RETIREMENT_CONFIRMATION',
        },
      });
      expect(resolveRetirementDecision(decision, request, first.resolution)).toMatchObject({
        kind: 'REUSE',
        resolution: first.resolution,
      });
      expect(decision).not.toHaveProperty('resolution');
      expect(Object.isFrozen(first.resolution)).toBe(true);
    },
  );
  it('rejects stale revision, foreign decision, unavailable choice and changed resolution', () => {
    const decision = createRetirementDecision(
      { ...boundary, lastChanceConsumed: true },
      high,
      policy,
    );
    const request = {
      decisionId: decision.decisionId,
      expectedRevision: 50,
      choice: 'RETIRE' as const,
    };
    const first = resolveRetirementDecision(decision, request);
    expect(() => resolveRetirementDecision(decision, { ...request, expectedRevision: 49 })).toThrow(
      'stale',
    );
    expect(() =>
      resolveRetirementDecision(decision, { ...request, decisionId: 'foreign' }),
    ).toThrow('stale');
    expect(() =>
      resolveRetirementDecision(decision, { ...request, choice: 'LAST_CONTRACT' }),
    ).toThrow('unavailable');
    expect(() =>
      resolveRetirementDecision(
        decision,
        { ...request, choice: 'COACH_EPILOGUE' },
        first.resolution,
      ),
    ).toThrow('conflicting');
    expect(() =>
      resolveRetirementDecision(decision, request, { ...first.resolution, offerId: 'forged' }),
    ).toThrow('conflicting');
  });
});
