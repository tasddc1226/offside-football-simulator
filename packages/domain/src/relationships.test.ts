import { describe, expect, it } from 'vitest';
import { initialSeasonPlayerStats } from './season-stats.js';
import { onSettlementRelations } from './relationships.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import { rollInt, seedRng } from './rng.js';
import {
  ATTRIBUTE_KEYS,
  type CareerState,
  type FootballSeason,
  type SeasonManager,
  type SeasonResult,
} from './types.js';

const zeroAttributes = Object.fromEntries(
  ATTRIBUTE_KEYS.map((key) => [key, 50]),
) as CareerState['attributes'];
const zeroGrowth = Object.fromEntries(
  ATTRIBUTE_KEYS.map((key) => [key, 0]),
) as CareerState['growthCarryCenti'];

function makeManager(overrides: Partial<SeasonManager> = {}): SeasonManager {
  return {
    id: 'seoul-tier1-mgr-1',
    name: rulesetProto.managerRules.names[0]!,
    preferredArchetypeIds: [],
    tenureSeasons: 1,
    trustBase: rulesetProto.managerRules.trustBase,
    ...overrides,
  };
}

function makeState(overrides: Partial<CareerState> = {}): CareerState {
  const rngState = seedRng('relationships-test');
  return {
    schemaVersion: 1,
    careerId: 'relationships-test',
    status: 'ACTIVE',
    stage: 'PRO',
    age: 20,
    currentStep: 12,
    seasonPhase: 'SETTLEMENT',
    simulationMode: 'FAST',
    attributes: zeroAttributes,
    growthCarryCenti: zeroGrowth,
    state: { form: 60, fitness: 80, morale: 70 },
    context: { tacticalFit: 70, squadStatus: 6, positionProficiency: 80 },
    relationships: { managerTrust: 65, captain: 80, rival: 10, fans: 5000, agent: 30 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState,
    rulesetVersion: rulesetProto.version,
    contentPackVersion: '0.2.0',
    player: {
      draft: {
        name: 'Test Player',
        gender: 'UNSPECIFIED',
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT',
        position: 'W',
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
      },
      profile: {
        name: 'Test Player',
        gender: 'UNSPECIFIED',
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT',
        preferredPosition: 'W',
        primaryPosition: 'W',
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
        truePotential: 85,
        scoutedPotentialMin: 80,
        scoutedPotentialMax: 90,
        baseOvr: 72,
      },
    },
    pending: null,
    contract: {
      id: 'CTR-1',
      offerId: 'OFR-1',
      teamId: 'seoul-tier1',
      teamName: 'Seoul FC',
      leagueTier: 1,
      lengthSeasons: 3,
      wageMinorPerWeek: 1,
      signingBonusMinor: 1,
      rolePromise: 'STARTER',
      shirtNumber: 7,
      signatureType: 'AUTO',
      signedAtRevision: 1,
      kind: 'PERMANENT',
      appearancePromise: { minutesShareBp: 6500 },
      positionPlan: 'W',
      suspended: false,
      loan: null,
      promiseBreaches: 0,
      signedSeasonIndex: 1,
    },
    parentContract: null,
    clubHistory: [],
    timeline: [],
    season: null,
    seasonHistory: [],
    nextManager: null,
    captaincy: 'NONE',
    captaincySeasons: 0,
    controversyFailures: 0,
    nationalityRuleState: { moduleId: 'DEFAULT', exceptions: [] },
    nationalTeam: { callUps: [], debuted: false, pendingDebut: null },
    health: { episodes: [] },
    relationshipLog: [],
    memoryTags: { managerTrust: [], captain: [], rival: [], fans: [], agent: [] },
    reputation: { popularityCenti: 5000, mediaCenti: 3210 },
    ...overrides,
  };
}

function makeSeason(manager: SeasonManager | null = makeManager()): FootballSeason {
  return {
    index: 4,
    serviceSeasonId: 'svc-4',
    simulationMode: 'FAST',
    calendarId: 'calendar-proto',
    currentStep: 12,
    phase: 'SETTLEMENT',
    steps: [],
    teamId: 'seoul-tier1',
    styleId: 'style-1',
    squadRole: 'STARTER',
    squadRoleAtStart: 'STARTER',
    trainingFocus: 'ROLE',
    competitions: [],
    schedule: [],
    matches: [],
    ageReferenceStep: 1,
    squad: { competitors: [] },
    selection: {
      position: 'W',
      slots: 1,
      benchSlots: 1,
      candidates: [],
      playerReason: null,
    },
    playerStats: initialSeasonPlayerStats('FW'),
    availability: null,
    lastRatingTenths: 70,
    yellowSuspensionCount: 0,
    matchRngState: seedRng('match'),
    chapters: [],
    scheduledEffects: [],
    manager,
    injuryCount: 0,
  };
}

function makeResult(overrides: Partial<SeasonResult> = {}): SeasonResult {
  return {
    index: 4,
    simulationMode: 'FAST',
    teamId: 'seoul-tier1',
    managerId: 'seoul-tier1-mgr-1',
    captaincyAtEnd: 'NONE',
    competitions: [
      {
        competitionId: 'league-tier1',
        kind: 'LEAGUE',
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        goalsFor: 1,
        goalsAgainst: 0,
        position: 1,
        cupRound: null,
      },
    ],
    playerStats: {
      ...initialSeasonPlayerStats('FW'),
      ratedMatches: 10,
      ratingSumTenths: 700,
    },
    selectionSummary: {
      squadRoleAtStart: 'STARTER',
      squadRoleAtEnd: 'STARTER',
      started: 10,
      sub: 0,
      zeroMinute: 0,
      out: 0,
      minutes: 900,
      possibleMinutes: 900,
      finalRank: 1,
    },
    roleChanges: [],
    promiseFulfilment: {
      promised: 'STARTER',
      delivered: 'STARTER',
      fulfilled: true,
      minutesShareBp: 10000,
    },
    attributeDeltas: [],
    baseOvr: { before: 72, after: 72 },
    stateDeltas: {
      form: { before: 60, after: 50 },
      fitness: { before: 80, after: 80 },
      morale: { before: 70, after: 60 },
      managerTrust: { before: 65, after: 65 },
    },
    chapters: [],
    stepSummaries: [],
    hash: 'result-hash',
    ...overrides,
  };
}

function makeSummary(
  index: number,
  managerId = 'seoul-tier1-mgr-1',
): CareerState['seasonHistory'][number] {
  return {
    index,
    simulationMode: 'FAST',
    teamId: 'seoul-tier1',
    competitions: [],
    settledAtRevision: index,
    result: makeResult({ index, managerId }),
  };
}

describe('onSettlementRelations', () => {
  it('legacy partial mocks remain an identity operation', () => {
    const rng = seedRng('relationships-test');
    const state = { rngState: rng } as CareerState;

    const result = onSettlementRelations({
      state,
      season: {} as FootballSeason,
      result: {} as SeasonResult,
      ruleset: rulesetProto,
      rng,
    });

    expect(result.state).toBe(state);
    expect(result.rng).toBe(rng);
  });

  it('settlement popularity uses the signed delta and preserves media reputation', () => {
    const state = makeState({ relationships: { ...makeState().relationships, captain: 0 } });
    const result = onSettlementRelations({
      state,
      season: makeSeason(),
      result: makeResult(),
      ruleset: rulesetProto,
      rng: state.rngState,
      timelineRevision: 10,
    });

    expect(result.state.reputation.popularityCenti).toBe(5900);
    expect(result.state.reputation.mediaCenti).toBe(3210);
  });

  it('below-tenure managers do not consume the settlement decision roll', () => {
    const state = makeState({
      seasonHistory: [makeSummary(1)],
      captaincy: 'NONE',
      captaincySeasons: 0,
    });
    const result = onSettlementRelations({
      state,
      season: makeSeason(makeManager({ tenureSeasons: 0 })),
      result: makeResult({ captaincyAtEnd: 'NONE' }),
      ruleset: rulesetProto,
      rng: state.rngState,
      timelineRevision: 10,
    });

    expect(result.rng.draws).toBe(state.rngState.draws);
    expect(result.state.nextManager?.id).toBe('seoul-tier1-mgr-1');
    expect(result.state.nextManager?.tenureSeasons).toBe(1);
    expect(
      Math.max(...result.state.timeline.map((entry) => entry.revision), 0),
    ).toBeLessThanOrEqual(10);
  });

  it('manager replacement consumes one derived roll without changing main rng and shares the settlement revision', () => {
    const ruleset = {
      ...rulesetProto,
      managerRules: {
        ...rulesetProto.managerRules,
        changeProbability: {
          ...rulesetProto.managerRules.changeProbability,
          baseBp: 10000,
          maxBp: 10000,
        },
      },
    };
    const state = makeState({
      seasonHistory: [makeSummary(1)],
      // The manager stream must not accidentally inherit the main stream's draw counter.
      rngState: { ...seedRng('relationships-test'), draws: 37 },
    });
    const inputRngBytes = JSON.stringify(state.rngState);
    const directRoll = rollInt(state.rngState, 10000);
    const managerRoll = rollInt(
      seedRng(`manager:${makeSeason(makeManager()).index}:${state.rngState.s.join(',')}`),
      10000,
    );
    expect(managerRoll.value).not.toBe(directRoll.value);
    const result = onSettlementRelations({
      state,
      season: makeSeason(makeManager({ tenureSeasons: 3 })),
      result: makeResult(),
      ruleset,
      rng: state.rngState,
      timelineRevision: 10,
    });

    // manager 판정은 기존 T-3 결정 순서를 이동시키지 않는 전용 substream에서 정확히 1회 소비한다.
    expect(result.rng).toEqual(state.rngState);
    expect(JSON.stringify(result.rng)).toBe(inputRngBytes);
    expect(result.rng.draws).toBe(state.rngState.draws);
    expect(result.managerDecisionRng?.draws).toBe(1);
    expect(result.managerDecisionRng).toEqual(managerRoll.state);
    const replay = onSettlementRelations({
      state,
      season: makeSeason(makeManager({ tenureSeasons: 3 })),
      result: makeResult(),
      ruleset,
      rng: state.rngState,
      timelineRevision: 10,
    });
    expect(replay.managerDecisionRng).toEqual(result.managerDecisionRng);

    const forked = onSettlementRelations({
      state: { ...state, careerId: 'relationships-fork' },
      season: makeSeason(makeManager({ tenureSeasons: 3 })),
      result: makeResult(),
      ruleset,
      rng: state.rngState,
      timelineRevision: 10,
    });
    expect(forked.rng).toEqual(result.rng);
    expect(forked.managerDecisionRng).toEqual(result.managerDecisionRng);
    expect(forked.state.nextManager).toEqual(result.state.nextManager);
    expect(forked.state.timeline).toEqual(result.state.timeline);

    expect(result.state.nextManager?.id).toBe('seoul-tier1-mgr-2');
    expect(result.state.timeline.at(-1)?.kind).toBe('MANAGER_CHANGED');
    expect(result.state.timeline.at(-1)?.revision).toBe(10);
    expect(
      Math.max(...result.state.timeline.map((entry) => entry.revision), 0),
    ).toBeLessThanOrEqual(10);
  });

  it('NONE-ended seasons start captaincySeasons at zero, then count VICE/CAPTAIN seasons', () => {
    const state = makeState({
      seasonHistory: [makeSummary(1), makeSummary(2), makeSummary(3)],
      captaincy: 'NONE',
      captaincySeasons: 0,
    });
    const vice = onSettlementRelations({
      state,
      season: makeSeason(),
      result: makeResult({ captaincyAtEnd: 'NONE' }),
      ruleset: rulesetProto,
      rng: state.rngState,
      timelineRevision: 10,
    });

    expect(vice.state.captaincy).toBe('VICE');
    expect(vice.state.captaincySeasons).toBe(0);
    expect(vice.state.timeline.at(-1)).toMatchObject({
      kind: 'CAPTAIN_APPOINTED',
      revision: 10,
      refId: 'VICE',
    });

    const captainState = { ...vice.state, captaincy: 'VICE' as const, captaincySeasons: 2 };
    const captain = onSettlementRelations({
      state: captainState,
      season: makeSeason(),
      result: makeResult({ captaincyAtEnd: 'VICE' }),
      ruleset: rulesetProto,
      rng: vice.rng,
      timelineRevision: 11,
    });

    expect(captain.state.captaincy).toBe('CAPTAIN');
    expect(captain.state.captaincySeasons).toBe(3);
    expect(captain.state.timeline.at(-1)).toMatchObject({
      kind: 'CAPTAIN_APPOINTED',
      revision: 11,
      refId: 'CAPTAIN',
    });
  });

  it('후보 ruleset은 3시즌 이상 뛴 STARTER에게만 주장 관계를 점진적으로 열고 BENCH에는 적용하지 않는다', () => {
    const candidateRuleset = {
      ...rulesetProto,
      relationshipRules: { ...rulesetProto.relationshipRules, captainSeasonStarterDelta: 4 },
    };
    const established = makeState({
      relationships: { ...makeState().relationships, captain: 69 },
      seasonHistory: [makeSummary(1), makeSummary(2), makeSummary(3)],
      captaincy: 'NONE',
      captaincySeasons: 0,
    });
    const promoted = onSettlementRelations({
      state: established,
      season: makeSeason(),
      result: makeResult({ captaincyAtEnd: 'NONE' }),
      ruleset: candidateRuleset,
      rng: established.rngState,
      timelineRevision: 10,
    });
    expect(promoted.state.relationships.captain).toBe(73);
    expect(promoted.state.captaincy).toBe('VICE');

    const bench = onSettlementRelations({
      state: established,
      season: makeSeason(),
      result: makeResult({
        captaincyAtEnd: 'NONE',
        selectionSummary: { ...makeResult().selectionSummary, squadRoleAtEnd: 'BENCH' },
      }),
      ruleset: candidateRuleset,
      rng: established.rngState,
      timelineRevision: 10,
    });
    expect(bench.state.relationships.captain).toBe(69);
    expect(bench.state.captaincy).toBe('NONE');
  });
});
