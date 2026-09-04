import { describe, expect, it } from 'vitest';
import { runCareerFixture } from './__fixtures__/career-01.js';
import { runSettledFixture } from './__fixtures__/career-06-settled.js';
import { resolveChapter, selectChapter, type ChapterCandidateInput } from './chapter.js';
import { hashState } from './hash.js';
import {
  applyNationalTeamCallUp,
  buildNationalTeamCallUpRecord,
  chooseNationalOpponent,
  nationalTeamEffects,
  qualifyNationalTeam,
  reserveNationalDebut,
} from './national-team.js';
import { seedRng } from './rng.js';
import {
  buildInitialCompetitions,
  buildSeasonSteps,
  findSeasonStep,
  selectOpenSlot,
  walkToNextDecision,
  type PlayStepMatches,
} from './season.js';
import { simulate, verifySnapshot, type Command } from './simulate.js';
import { findLeague } from './schedule.js';
import type {
  CareerState,
  DomainSnapshot,
  MatchRecord,
  NationalTeamCallUp,
  NationalTeamState,
  Pending,
  SeasonStep,
} from './types.js';
import { rulesetProto } from './__fixtures__/career-01.js';

const EVENT_ID = rulesetProto.nationalTeamRules.event.id;
const EVENT_VERSION = rulesetProto.nationalTeamRules.event.version;
const LEAGUE = findLeague(rulesetProto, 'league-youth');
type TestCommand = Command & { commandId: string; expectedRevision: number };
type NationalIntegrationFlow = [
  DomainSnapshot,
  DomainSnapshot,
  DomainSnapshot,
  DomainSnapshot,
  DomainSnapshot,
  DomainSnapshot,
  DomainSnapshot,
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyNationalTeam(): NationalTeamState {
  return { callUps: [], debuted: false, pendingDebut: null };
}

type StateOptions = {
  tier?: 'YOUTH' | 1 | 2 | 3;
  baseOvr?: number;
  status?: CareerState['status'];
  stage?: CareerState['stage'];
  step?: number;
  popularityCenti?: number;
};

function makeEligibleState(options: StateOptions = {}): CareerState {
  const state = clone(runCareerFixture().state);
  const contract = state.contract;
  const profile = state.player.profile;
  if (contract === null || profile === null) throw new Error('fixture must have a confirmed player and contract');
  return {
    ...state,
    status: options.status ?? 'ACTIVE',
    stage: options.stage ?? 'PRO',
    currentStep: options.step ?? 8,
    seasonPhase: 'LEAGUE',
    season: null,
    contract: { ...contract, leagueTier: options.tier ?? 1 },
    player: { ...state.player, profile: { ...profile, baseOvr: options.baseOvr ?? 68 } },
    nationalTeam: emptyNationalTeam(),
    reputation: { ...state.reputation, popularityCenti: options.popularityCenti ?? 5000 },
  };
}

function withPreviousRating(state: CareerState, ratingTenths: number, ratedMatches = 1): CareerState {
  const settled = runSettledFixture().snapshot.state;
  const previous = settled.seasonHistory.at(-1);
  if (previous === undefined) throw new Error('settled fixture must have a season summary');
  return {
    ...state,
    seasonHistory: [
      {
        ...clone(previous),
        result: {
          ...clone(previous.result),
          playerStats: {
            ...clone(previous.result.playerStats),
            ratingSumTenths: ratingTenths * ratedMatches,
            ratedMatches,
          },
        },
      },
    ],
  };
}

function nationalSnapshot(): DomainSnapshot {
  const state = makeEligibleState({ baseOvr: 90, popularityCenti: 6000 });
  const pending: Extract<Pending, { kind: 'NATIONAL_TEAM' }> = {
    kind: 'NATIONAL_TEAM',
    step: 8,
    eventId: EVENT_ID,
    version: EVENT_VERSION,
  };
  const nextState: CareerState = {
    ...state,
    state: { ...state.state, fitness: 80 },
    relationships: { ...state.relationships, managerTrust: 61, fans: 50, agent: 50 },
    rngState: seedRng('national-resolve'),
    pending,
  };
  return {
    revision: 10,
    checkpoint: 'EVENT_OFFERED',
    state: nextState,
    stateHash: hashState(nextState),
    rulesetVersion: rulesetProto.version,
    contentPackVersion: '0.1.0',
  };
}

function nationalResolveCommand(snapshot: DomainSnapshot, choiceId: string, callUp: NationalTeamCallUp) {
  return {
    type: 'RESOLVE_EVENT' as const,
    commandId: `national-${choiceId}`,
    expectedRevision: snapshot.revision,
    payload: {
      eventId: EVENT_ID,
      definitionVersion: EVENT_VERSION,
      choiceId,
      callUp,
      // Domain must ignore these client-supplied effects for NATIONAL_TEAM.
      outcomes: [
        {
          id: 'CLIENT-OUTCOME',
          kind: 'FIXED' as const,
          weight: 1,
          effects: [
            {
              kind: 'RELATION' as const,
              sourceId: 'CLIENT-MANAGER-TRUST',
              target: 'managerTrust',
              delta: 99,
              clamp: { min: 0, max: 100 },
              appliesAt: { kind: 'IMMEDIATE' as const },
              expiresAt: null,
              stackingRule: 'SUM' as const,
            },
          ],
        },
      ],
    },
  };
}

function makeMatch(step: number, id = `club-match-${step}`): MatchRecord {
  return {
    id,
    step,
    order: 1,
    competitionId: 'LEAGUE',
    kind: 'LEAGUE',
    round: null,
    opponent: { id: 'league-youth-opp-1', name: 'Virtual Club Opponent', strength: 50 },
    home: true,
    result: { goalsFor: 1, goalsAgainst: 0, outcome: 'WIN' },
    appearance: 'START',
    outReason: null,
    minutes: 90,
    involvement: 50,
    stats: { group: 'FW', goals: 1, assists: 0, xgCenti: 30, shots: 3, offsides: 0 },
    ratingTenths: 70,
    cards: { yellow: 0, red: false },
    injuredOff: false,
    chapterId: null,
  };
}

function makeChapterStep(index: number, withSlot = true): SeasonStep {
  return {
    index,
    phase: 'LEAGUE',
    windowOpen: false,
    decisionSlots: withSlot ? [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }] : [],
    summary: null,
  };
}

function nationalChapterCandidate(): ChapterCandidateInput {
  return {
    chapterId: 'CHP-NAT-001',
    version: 1,
    importance: 'MAJOR',
    trigger: { kind: 'NATIONAL_DEBUT' },
    weight: 100,
    decisionsTotal: 1,
  };
}

function nationalScenarioRuleset(options: { nationalTeamStep: number | null; chapterStep: number | null }): typeof rulesetProto {
  const ruleset = clone(rulesetProto);
  ruleset.leagueCalendar = {
    ...ruleset.leagueCalendar,
    steps: ruleset.leagueCalendar.steps.map((step) => ({
      ...step,
      slots:
        step.index === 1
          ? [{ kind: 'ROLE' as const, required: true }]
          : options.nationalTeamStep !== null && step.index === options.nationalTeamStep
            ? [{ kind: 'NATIONAL_TEAM' as const, required: true }]
            : options.chapterStep !== null && step.index === options.chapterStep
              ? [{ kind: 'CHAPTER' as const, required: true, importance: 'MAJOR' as const }]
              : step.index === 12
                ? [{ kind: 'SETTLEMENT' as const, required: true }]
                : [],
    })),
  };
  ruleset.matchRules = {
    ...ruleset.matchRules,
    injury: { ...ruleset.matchRules.injury, perMatchPercent: 0, lowFitnessExtraPercent: 0 },
  };
  return ruleset;
}

function runNationalScenario(
  snapshot: DomainSnapshot,
  ruleset: typeof rulesetProto,
  command: TestCommand,
): DomainSnapshot {
  const result = simulate({
    snapshot,
    command: { ...command, expectedRevision: snapshot.revision },
    ruleset,
    rulesetVersion: ruleset.version,
    contentPackVersion: '0.1.0',
  });
  if (!result.ok) throw new Error(`${command.type} failed: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

describe('T-4-004 qualification', () => {
  it.each([
    ['YOUTH', 70],
    [1, 68],
    [2, 74],
    [3, 78],
  ] as const)('tier %s accepts the exact base OVR boundary and rejects one below it', (tier, minOvr) => {
    expect(qualifyNationalTeam(makeEligibleState({ tier, baseOvr: minOvr }), rulesetProto)).toEqual({
      eligible: true,
      reason: 'BASE_OVR',
    });
    expect(qualifyNationalTeam(makeEligibleState({ tier, baseOvr: minOvr - 1 }), rulesetProto)).toEqual({
      eligible: false,
      reason: 'INELIGIBLE',
    });
  });

  it('uses the previous-season rating and popularity path at both boundaries', () => {
    const base = withPreviousRating(makeEligibleState({ baseOvr: 0, popularityCenti: 6000 }), 70, 2);
    expect(qualifyNationalTeam(base, rulesetProto)).toEqual({ eligible: true, reason: 'RATING_AND_POPULARITY' });

    const lowRating = withPreviousRating(makeEligibleState({ baseOvr: 0, popularityCenti: 6000 }), 69, 2);
    expect(qualifyNationalTeam(lowRating, rulesetProto).eligible).toBe(false);

    const lowPopularity = withPreviousRating(makeEligibleState({ baseOvr: 0, popularityCenti: 5999 }), 70, 2);
    expect(qualifyNationalTeam(lowPopularity, rulesetProto).eligible).toBe(false);
  });

  it('rejects inactive, non-pro, wrong-step, no-contract, and already-called-up states without consuming RNG', () => {
    const cases: Array<[string, CareerState, 'NOT_ACTIVE' | 'NOT_PRO' | 'WRONG_STEP' | 'NO_CONTRACT' | 'ALREADY_CALLED_UP']> = [
      ['inactive', makeEligibleState({ status: 'RETIRED' }), 'NOT_ACTIVE'],
      ['non-pro', makeEligibleState({ stage: 'YOUTH' }), 'NOT_PRO'],
      ['wrong step', makeEligibleState({ step: 7 }), 'WRONG_STEP'],
      ['no contract', { ...makeEligibleState(), contract: null }, 'NO_CONTRACT'],
      [
        'duplicate',
        {
          ...makeEligibleState(),
          nationalTeam: {
            ...emptyNationalTeam(),
            callUps: [buildNationalTeamCallUpRecord(makeEligibleState(), EVENT_ID, EVENT_VERSION, 'DECLINE')],
          },
        },
        'ALREADY_CALLED_UP',
      ],
    ];
    for (const [label, state, reason] of cases) {
      const before = clone(state);
      expect(qualifyNationalTeam(state, rulesetProto), label).toEqual({ eligible: false, reason });
      expect(state.rngState, label).toEqual(before.rngState);
    }
  });
});

describe('T-4-004 step 8 generation and injury priority', () => {
  it('opens the strict event ref at step 8 with RNG 0', () => {
    const steps = buildSeasonSteps(rulesetProto.leagueCalendar, 'CHAPTER');
    const rng = seedRng('national-generation');
    const result = selectOpenSlot(
      findSeasonStep(steps, 8),
      'CHAPTER',
      [],
      rng,
      null,
      null,
      20,
      1,
      makeEligibleState(),
      rulesetProto,
    );
    expect(result).toEqual({
      opened: true,
      pending: { kind: 'NATIONAL_TEAM', step: 8, eventId: EVENT_ID, version: EVENT_VERSION },
      rngState: rng,
    });
  });

  it('automatically declines an eligible call-up during injury and continues to a later same-step slot', () => {
    const state = makeEligibleState();
    const steps = buildSeasonSteps(rulesetProto.leagueCalendar, 'CHAPTER');
    const rng = seedRng('national-injury-auto-decline');
    const play: PlayStepMatches = () => ({
      results: [],
      records: [],
      competitions: buildInitialCompetitions(rulesetProto.leagueCalendar),
      forcedPending: null,
      injuryReturnMatchId: null,
      injuryUnavailable: true,
    });
    const result = walkToNextDecision(
      steps,
      8,
      'CHAPTER',
      [{ eventId: 'EVT-OTHER-001', version: 1, weight: 1 }],
      rng,
      20,
      null,
      play,
      [],
      {
        chapterCandidates: [],
        tags: [],
        resolvedChapterIds: [],
        existingChapterIds: [],
        league: LEAGUE,
        seasonIndex: 1,
      },
      state,
      rulesetProto,
    );

    expect(result.pending).toEqual({ kind: 'EVENT', eventId: 'EVT-OTHER-001', version: 1 });
    expect(result.rngState).toEqual(rng);
    expect(result.nationalTeamState.callUps).toEqual([
      {
        seasonIndex: 1,
        step: 8,
        eventId: EVENT_ID,
        version: EVENT_VERSION,
        decision: 'DECLINE',
        reason: 'INJURY',
      },
    ]);
    expect(result.nationalTeamTimeline).toEqual([
      { revision: 20, kind: 'NATIONAL_TEAM_DECLINED', refId: 'INJURY', age: state.age, step: 8 },
    ]);
  });

  it('keeps a post-match forced injury pending ahead of national-team auto-decline', () => {
    const state = makeEligibleState();
    const steps = buildSeasonSteps(rulesetProto.leagueCalendar, 'CHAPTER');
    const rng = seedRng('national-injury-priority');
    const play: PlayStepMatches = () => ({
      results: [],
      records: [],
      competitions: buildInitialCompetitions(rulesetProto.leagueCalendar),
      forcedPending: {
        kind: 'INJURY',
        step: 8,
        episodeId: 'INJ-1-8-1',
        eventId: rulesetProto.injuryRules.event.id,
        version: rulesetProto.injuryRules.event.version,
      },
      injuryReturnMatchId: null,
      injuryUnavailable: true,
    });
    const result = walkToNextDecision(
      steps,
      8,
      'CHAPTER',
      [],
      rng,
      20,
      null,
      play,
      [],
      {
        chapterCandidates: [],
        tags: [],
        resolvedChapterIds: [],
        existingChapterIds: [],
        league: LEAGUE,
        seasonIndex: 1,
      },
      state,
      rulesetProto,
    );
    expect(result.pending?.kind).toBe('INJURY');
    expect(result.nationalTeamState).toEqual(emptyNationalTeam());
    expect(result.nationalTeamTimeline).toEqual([]);
    expect(result.rngState).toEqual(rng);
  });

  it('keeps the same-step optional EVENT open after a user national-team resolve', () => {
    const ruleset = nationalScenarioRuleset({ nationalTeamStep: 8, chapterStep: null });
    ruleset.leagueCalendar = {
      ...ruleset.leagueCalendar,
      steps: ruleset.leagueCalendar.steps.map((step) =>
        step.index === 8
          ? {
              ...step,
              slots: [
                { kind: 'EVENT' as const, required: false },
                { kind: 'NATIONAL_TEAM' as const, required: true },
              ],
            }
          : step,
      ),
    };
    const initialState = { ...makeEligibleState({ tier: 1, baseOvr: 68 }), rngState: seedRng('national-same-step-event') };
    const initialSnapshot: DomainSnapshot = {
      revision: 200,
      checkpoint: 'CONTRACT_CONFIRMED',
      state: initialState,
      stateHash: hashState(initialState),
      rulesetVersion: ruleset.version,
      contentPackVersion: '0.1.0',
    };

    const started = runNationalScenario(initialSnapshot, ruleset, {
      type: 'START_SEASON',
      commandId: 'national-same-step-start',
      expectedRevision: initialSnapshot.revision,
      payload: { simulationMode: 'CHAPTER', serviceSeasonId: 'svc-national-same-step' },
    });
    const afterRole = runNationalScenario(started, ruleset, {
      type: 'RESOLVE_ROLE',
      commandId: 'national-same-step-role',
      expectedRevision: started.revision,
      payload: { decision: 'ACCEPT' },
    });
    const called = runNationalScenario(afterRole, ruleset, {
      type: 'ADVANCE',
      commandId: 'national-same-step-call-up',
      expectedRevision: afterRole.revision,
      payload: { eligibleEvents: [{ eventId: 'EVT-OTHER-001', version: 1, weight: 1 }] },
    });
    expect(called.state.pending).toEqual({
      kind: 'NATIONAL_TEAM',
      step: 8,
      eventId: EVENT_ID,
      version: EVENT_VERSION,
    });

    const accepted = runNationalScenario(called, ruleset, {
      type: 'RESOLVE_EVENT',
      commandId: 'national-same-step-accept',
      expectedRevision: called.revision,
      payload: {
        eventId: EVENT_ID,
        definitionVersion: EVENT_VERSION,
        choiceId: 'A',
        callUp: 'ACCEPT',
        outcomes: [{ id: 'A1', kind: 'FIXED', weight: 1, effects: [] }],
      },
    });
    const acceptedBeforeReservedAdvance = clone(accepted.state);
    const reservedAdvance = simulate({
      snapshot: accepted,
      command: {
        type: 'ADVANCE',
        commandId: 'national-same-step-forged-advance',
        expectedRevision: accepted.revision,
        payload: { eligibleEvents: [{ eventId: EVENT_ID, version: EVENT_VERSION + 99, weight: 1 }] },
      },
      ruleset,
      rulesetVersion: ruleset.version,
      contentPackVersion: '0.1.0',
    });
    expect(reservedAdvance.ok).toBe(false);
    if (!reservedAdvance.ok) expect(reservedAdvance.error.details).toEqual({ reason: 'RESERVED_NATIONAL_TEAM_EVENT' });
    expect(accepted.state).toEqual(acceptedBeforeReservedAdvance);
    expect(accepted.state.relationships.managerTrust).toBe(acceptedBeforeReservedAdvance.relationships.managerTrust);
    expect(accepted.state.rngState).toEqual(acceptedBeforeReservedAdvance.rngState);
    expect(accepted.state.pending).toBeNull();
    const matchesBeforeResume = clone(accepted.state.season?.matches ?? []);
    const rngBeforeResume = clone(accepted.state.rngState);

    const resumed = runNationalScenario(accepted, ruleset, {
      type: 'ADVANCE',
      commandId: 'national-same-step-resume-event',
      expectedRevision: accepted.revision,
      payload: { eligibleEvents: [{ eventId: 'EVT-OTHER-001', version: 1, weight: 1 }] },
    });
    expect(resumed.state.pending).toEqual({ kind: 'EVENT', eventId: 'EVT-OTHER-001', version: 1 });
    expect(resumed.state.currentStep).toBe(8);
    expect(resumed.state.season?.steps.find((step) => step.index === 8)?.summary).toBeNull();
    expect(resumed.state.season?.matches).toEqual(matchesBeforeResume);
    expect(resumed.state.rngState).toEqual(rngBeforeResume);

    const eventResolved = runNationalScenario(resumed, ruleset, {
      type: 'RESOLVE_EVENT',
      commandId: 'national-same-step-event-resolve',
      expectedRevision: resumed.revision,
      payload: {
        eventId: 'EVT-OTHER-001',
        definitionVersion: 1,
        choiceId: 'A',
        outcomes: [{ id: 'A1', kind: 'FIXED', weight: 1, effects: [] }],
      },
    });
    const continued = runNationalScenario(eventResolved, ruleset, {
      type: 'ADVANCE',
      commandId: 'national-same-step-complete',
      expectedRevision: eventResolved.revision,
      payload: { eligibleEvents: [] },
    });
    expect(continued.state.season?.steps.find((step) => step.index === 8)?.summary?.decisionsOpened).toBe(2);
  });
});

describe('T-4-004 call-up choices and replay contract', () => {
  it.each([
    ['A', 'ACCEPT', 65, 54, 54, true, 'NATIONAL_TEAM_CALLED'],
    ['B', 'CONDITIONAL', 72, 52, 52, true, 'NATIONAL_TEAM_CALLED'],
    ['C', 'DECLINE', 80, 46, 44, false, 'NATIONAL_TEAM_DECLINED'],
  ] as const)('choice %s maps to %s and preserves managerTrust', (choiceId, callUp, fitness, fans, agent, accepted, timelineKind) => {
    const snapshot = nationalSnapshot();
    const managerTrust = snapshot.state.relationships.managerTrust;
    const rng = clone(snapshot.state.rngState);
    const result = simulate({
      snapshot,
      command: nationalResolveCommand(snapshot, choiceId, callUp),
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.roll).toBe(0);
    expect(result.snapshot.state.rngState).toEqual(rng);
    expect(result.snapshot.state.state.fitness).toBe(fitness);
    expect(result.snapshot.state.relationships).toMatchObject({ managerTrust, fans, agent });
    expect(result.snapshot.state.pending).toBeNull();
    expect(result.snapshot.state.nationalTeam.callUps[0]?.decision).toBe(callUp);
    expect(result.snapshot.state.nationalTeam.pendingDebut).toEqual(
      accepted ? chooseNationalOpponent(rulesetProto, 0) : null,
    );
    if (accepted) {
      expect(result.snapshot.state.tags).toContain('대표팀_소집');
    } else {
      expect(result.snapshot.state.tags).not.toContain('대표팀_소집');
    }
    expect(result.snapshot.state.tags).not.toContain(timelineKind);
    expect(result.snapshot.state.timeline.at(-1)?.kind).toBe(timelineKind);
    expect(result.snapshot.state.relationshipLog).toEqual(
      expect.arrayContaining(
        accepted
          ? [
              expect.objectContaining({ target: 'fans', delta: fans - 50, sourceId: `${EVENT_ID}:NATIONAL_TEAM:${callUp}:FANS` }),
              expect.objectContaining({ target: 'agent', delta: agent - 50, sourceId: `${EVENT_ID}:NATIONAL_TEAM:${callUp}:AGENT` }),
            ]
          : [
              expect.objectContaining({ target: 'fans', delta: -4, reasonTag: 'NATIONAL_TEAM_DECLINE' }),
              expect.objectContaining({ target: 'agent', delta: -6, reasonTag: 'NATIONAL_TEAM_DECLINE' }),
            ],
      ),
    );
    expect(result.appliedEffects.every((effect) => effect.target !== 'managerTrust')).toBe(true);
    expect(result.snapshot.stateHash).toBe(hashState(result.snapshot.state));
  });

  it('rejects missing/mismatched call-up input and strict event version before any RNG draw', () => {
    const snapshot = nationalSnapshot();
    const baseCommand = nationalResolveCommand(snapshot, 'A', 'ACCEPT');

    const missingCallUp = clone(baseCommand);
    delete (missingCallUp.payload as { callUp?: NationalTeamCallUp }).callUp;
    const missingResult = simulate({
      snapshot,
      command: missingCallUp,
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    });
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) expect(missingResult.error.message).toMatch(/callUp이 필요/);

    const mismatchResult = simulate({
      snapshot,
      command: nationalResolveCommand(snapshot, 'A', 'DECLINE'),
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    });
    expect(mismatchResult.ok).toBe(false);
    if (!mismatchResult.ok) expect(mismatchResult.error.details).toEqual({ reason: 'CALL_UP_MISMATCH' });

    const wrongEventResult = simulate({
      snapshot,
      command: {
        ...baseCommand,
        payload: { ...baseCommand.payload, eventId: 'EVT-NAT-WRONG' },
      },
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    });
    expect(wrongEventResult.ok).toBe(false);
    if (!wrongEventResult.ok) expect(wrongEventResult.error.details).toEqual({ reason: 'PENDING_EVENT_MISMATCH' });

    const wrongRefState = {
      ...snapshot.state,
      pending: { kind: 'NATIONAL_TEAM' as const, step: 8, eventId: EVENT_ID, version: EVENT_VERSION + 1 },
    };
    const wrongRefSnapshot = { ...snapshot, state: wrongRefState, stateHash: hashState(wrongRefState) };
    const wrongRefCommand = {
      ...nationalResolveCommand(wrongRefSnapshot, 'A', 'ACCEPT'),
      payload: {
        ...nationalResolveCommand(wrongRefSnapshot, 'A', 'ACCEPT').payload,
        definitionVersion: EVENT_VERSION + 1,
      },
    };
    const wrongRefResult = simulate({
      snapshot: wrongRefSnapshot,
      command: wrongRefCommand,
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    });
    expect(wrongRefResult.ok).toBe(false);
    if (!wrongRefResult.ok) {
      expect(wrongRefResult.error.code).toBe('VERSION_MISMATCH');
      expect(wrongRefResult.error.details).toEqual({ reason: 'RULE_EVENT_VERSION_MISMATCH' });
    }
    expect(snapshot.state.rngState.draws).toBe(0);
  });

  it('rejects the reserved national-team event id through generic ADVANCE and RESOLVE_EVENT', () => {
    const noSeasonState = makeEligibleState();
    const noSeasonSnapshot: DomainSnapshot = {
      revision: 30,
      checkpoint: 'CONTRACT_CONFIRMED',
      state: noSeasonState,
      stateHash: hashState(noSeasonState),
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    };
    const noSeasonBefore = clone(noSeasonSnapshot.state);
    const noSeasonResult = simulate({
      snapshot: noSeasonSnapshot,
      command: {
        type: 'ADVANCE',
        commandId: 'national-forged-generic-advance',
        expectedRevision: noSeasonSnapshot.revision,
        payload: { eligibleEvents: [{ eventId: EVENT_ID, version: EVENT_VERSION + 99, weight: 1 }] },
      },
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    });
    expect(noSeasonResult.ok).toBe(false);
    if (!noSeasonResult.ok) expect(noSeasonResult.error.details).toEqual({ reason: 'RESERVED_NATIONAL_TEAM_EVENT' });
    expect(noSeasonSnapshot.state).toEqual(noSeasonBefore);

    const national = nationalSnapshot();
    const forgedState: CareerState = {
      ...national.state,
      pending: { kind: 'EVENT', eventId: EVENT_ID, version: EVENT_VERSION + 99 },
    };
    const forgedSnapshot: DomainSnapshot = {
      ...national,
      state: forgedState,
      stateHash: hashState(forgedState),
    };
    const forgedBefore = clone(forgedSnapshot.state);
    const forgedResult = simulate({
      snapshot: forgedSnapshot,
      command: {
        type: 'RESOLVE_EVENT',
        commandId: 'national-forged-generic-resolve',
        expectedRevision: forgedSnapshot.revision,
        payload: {
          eventId: EVENT_ID,
          definitionVersion: EVENT_VERSION + 99,
          choiceId: 'A',
          outcomes: [
            {
              id: 'FORGED',
              kind: 'FIXED',
              weight: 1,
              effects: [
                {
                  kind: 'RELATION',
                  sourceId: 'FORGED-MANAGER-TRUST',
                  target: 'managerTrust',
                  delta: 99,
                  clamp: { min: 0, max: 100 },
                  appliesAt: { kind: 'IMMEDIATE' },
                  expiresAt: null,
                  stackingRule: 'SUM',
                },
              ],
            },
          ],
        },
      },
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    });
    expect(forgedResult.ok).toBe(false);
    if (!forgedResult.ok) expect(forgedResult.error.details).toEqual({ reason: 'RESERVED_NATIONAL_TEAM_EVENT' });
    expect(forgedSnapshot.state).toEqual(forgedBefore);
    expect(forgedSnapshot.state.relationships.managerTrust).toBe(national.state.relationships.managerTrust);
    expect(forgedSnapshot.state.rngState).toEqual(national.state.rngState);
  });

  it('rejects a duplicate resolve after pending closes and gives the same canonical hash on replay', () => {
    const firstInput = {
      snapshot: nationalSnapshot(),
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    };
    const first = simulate({ ...firstInput, command: nationalResolveCommand(firstInput.snapshot, 'A', 'ACCEPT') });
    const replay = simulate({
      ...firstInput,
      command: nationalResolveCommand(firstInput.snapshot, 'A', 'ACCEPT'),
    });
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (!first.ok || !replay.ok) return;
    expect(first.snapshot.stateHash).toBe(replay.snapshot.stateHash);
    expect(first.snapshot.revision).toBe(replay.snapshot.revision);
    expect(first.snapshot.state.rngState).toEqual(replay.snapshot.state.rngState);

    const duplicate = simulate({
      ...firstInput,
      snapshot: first.snapshot,
      command: nationalResolveCommand(first.snapshot, 'A', 'ACCEPT'),
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.details).toEqual({ reason: 'NO_PENDING_EVENT' });
  });

  it('keeps national effects limited to fitness/fans/agent and uses deterministic opponent ordering', () => {
    const effects = nationalTeamEffects(rulesetProto, EVENT_ID, 'ACCEPT');
    expect(effects.map((effect) => effect.target)).toEqual(['fitness', 'fans', 'agent']);
    expect(effects.some((effect) => effect.target === 'managerTrust')).toBe(false);

    const reversedRuleset = clone(rulesetProto);
    reversedRuleset.nationalTeamRules.opponents.reverse();
    expect(chooseNationalOpponent(rulesetProto, 0)).toEqual(chooseNationalOpponent(reversedRuleset, 0));
    expect(chooseNationalOpponent(rulesetProto, 1)).not.toEqual(chooseNationalOpponent(rulesetProto, 0));
  });
});

describe('T-4-004 NATIONAL_DEBUT reservation', () => {
  it('opens NATIONAL_DEBUT as a MAJOR chapter in FAST mode', () => {
    const reserved = reserveNationalDebut(emptyNationalTeam(), rulesetProto);
    const steps = buildSeasonSteps(rulesetProto.leagueCalendar, 'FAST');
    const open = selectChapter({
      step: findSeasonStep(steps, 11),
      steps,
      seasonIndex: 1,
      mode: 'FAST',
      matchesThisStep: [makeMatch(11)],
      matchesBeforeThisStep: [],
      competitions: buildInitialCompetitions(rulesetProto.leagueCalendar),
      candidates: [nationalChapterCandidate()],
      tags: [],
      resolvedChapterIds: [],
      existingChapterIds: [],
      league: LEAGUE,
      nationalDebutReservation: reserved.pendingDebut,
    });
    expect(open).toMatchObject({
      chapterId: 'CHP-NAT-001',
      importance: 'MAJOR',
      trigger: 'NATIONAL_DEBUT',
      virtualOpponent: reserved.pendingDebut,
    });
  });

  it('is persistent, consumed by the next existing chapter slot, records virtual metadata, and is one-time', () => {
    const reserved = reserveNationalDebut(emptyNationalTeam(), rulesetProto);
    expect(reserved.pendingDebut).toEqual(chooseNationalOpponent(rulesetProto, 0));
    expect(reserveNationalDebut(reserved, rulesetProto)).toEqual(reserved);

    const step = makeChapterStep(11);
    const candidate = nationalChapterCandidate();
    const open = selectChapter({
      step,
      steps: [step],
      seasonIndex: 1,
      mode: 'CHAPTER',
      matchesThisStep: [makeMatch(11)],
      matchesBeforeThisStep: [],
      competitions: buildInitialCompetitions(rulesetProto.leagueCalendar),
      candidates: [candidate],
      tags: [],
      resolvedChapterIds: [],
      existingChapterIds: [],
      league: LEAGUE,
      nationalDebutReservation: reserved.pendingDebut,
    });
    expect(open).toEqual({
      chapterId: 'CHP-NAT-001',
      version: 1,
      importance: 'MAJOR',
      matchId: 'club-match-11',
      decisionsTotal: 1,
      trigger: 'NATIONAL_DEBUT',
      virtualOpponent: reserved.pendingDebut,
    });

    const noChapterSlot = selectChapter({
      step: makeChapterStep(11, false),
      steps: [makeChapterStep(11, false)],
      seasonIndex: 1,
      mode: 'CHAPTER',
      matchesThisStep: [makeMatch(11)],
      matchesBeforeThisStep: [],
      competitions: buildInitialCompetitions(rulesetProto.leagueCalendar),
      candidates: [candidate],
      tags: [],
      resolvedChapterIds: [],
      existingChapterIds: [],
      league: LEAGUE,
      nationalDebutReservation: reserved.pendingDebut,
    });
    expect(noChapterSlot).toBeNull();
    expect(reserved.pendingDebut).not.toBeNull();

    const settled = runSettledFixture().beforeSettlementState;
    const season = settled.season;
    if (season === null) throw new Error('fixture must be in a season');
    const existingMatch = season.matches.find((match) => match.minutes > 0);
    if (existingMatch === undefined) throw new Error('fixture must have a played match');
    const pending: Extract<Pending, { kind: 'CHAPTER' }> = {
      kind: 'CHAPTER',
      step: existingMatch.step,
      chapterId: 'CHP-NAT-001',
      version: 1,
      importance: 'MAJOR',
      matchId: existingMatch.id,
      decisionsTotal: 1,
      trigger: 'NATIONAL_DEBUT',
      resolved: [],
      virtualOpponent: reserved.pendingDebut!,
    };
    const state: CareerState = {
      ...clone(settled),
      currentStep: existingMatch.step,
      pending,
      nationalTeam: { ...emptyNationalTeam(), pendingDebut: reserved.pendingDebut },
      season: { ...clone(season), currentStep: existingMatch.step },
    };
    const stateSeason = state.season;
    if (stateSeason === null) throw new Error('chapter state must have a season');
    const matchesBeforeResolve = clone(stateSeason.matches);
    const playerStatsBeforeResolve = clone(stateSeason.playerStats);
    const scheduleBeforeResolve = clone(stateSeason.schedule);
    const lastRatingBeforeResolve = stateSeason.lastRatingTenths;
    const moraleBeforeResolve = state.state.morale;
    const resolved = resolveChapter({
      state,
      ruleset: rulesetProto,
      chapterId: 'CHP-NAT-001',
      definitionVersion: 1,
      decisionId: 'D1',
      optionId: 'A',
      outcomes: [
        {
          id: 'A1',
          kind: 'FIXED',
          weight: 1,
          effects: [
            {
              kind: 'CURRENT',
              sourceId: 'NATIONAL-DEBUT-MORALE',
              target: 'morale',
              delta: 3,
              clamp: { min: 0, max: 100 },
              appliesAt: { kind: 'IMMEDIATE' },
              expiresAt: null,
              stackingRule: 'SUM',
            },
          ],
          ratingDeltaTenths: 7,
        },
      ],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.nationalTeam).toEqual({
      callUps: [],
      debuted: true,
      pendingDebut: null,
    });
    expect(resolved.state.season?.chapters.at(-1)).toMatchObject({
      chapterId: 'CHP-NAT-001',
      trigger: 'NATIONAL_DEBUT',
      matchId: existingMatch.id,
      ratingDeltaTenths: 0,
      virtualOpponent: reserved.pendingDebut,
    });
    expect(resolved.state.season?.matches).toEqual(matchesBeforeResolve);
    expect(resolved.state.season?.playerStats).toEqual(playerStatsBeforeResolve);
    expect(resolved.state.season?.playerStats.ratingSumTenths).toBe(playerStatsBeforeResolve.ratingSumTenths);
    expect(resolved.state.season?.playerStats.ratedMatches).toBe(playerStatsBeforeResolve.ratedMatches);
    expect(resolved.state.season?.schedule).toEqual(scheduleBeforeResolve);
    expect(resolved.state.season?.lastRatingTenths).toBe(lastRatingBeforeResolve);
    expect(resolved.state.state.morale).toBe(moraleBeforeResolve + 3);
    expect(JSON.stringify(resolved.state.season?.matches)).toBe(JSON.stringify(matchesBeforeResolve));
    expect(JSON.stringify(resolved.state.season?.playerStats)).toBe(JSON.stringify(playerStatsBeforeResolve));
    expect(JSON.stringify(resolved.state.season?.schedule)).toBe(JSON.stringify(scheduleBeforeResolve));

    const debuted = reserveNationalDebut({ ...reserved, debuted: true, pendingDebut: null }, rulesetProto);
    expect(debuted.pendingDebut).toBeNull();
  });

  it('keeps the reservation in CareerState through a season with no CHAPTER slot and opens it first next season', () => {
    const seasonOneRuleset = nationalScenarioRuleset({ nationalTeamStep: 8, chapterStep: null });
    const seasonTwoRuleset = nationalScenarioRuleset({ nationalTeamStep: null, chapterStep: 9 });
    const initialSource = makeEligibleState({ tier: 1, baseOvr: 68 });
    const initialState = {
      ...initialSource,
      tags: [...initialSource.tags, '잔류_선언'],
      rngState: seedRng('national-reservation-next-season'),
    };
    const initialSnapshot: DomainSnapshot = {
      revision: 100,
      checkpoint: 'CONTRACT_CONFIRMED',
      state: initialState,
      stateHash: hashState(initialState),
      rulesetVersion: seasonOneRuleset.version,
      contentPackVersion: '0.1.0',
    };

    const started = runNationalScenario(initialSnapshot, seasonOneRuleset, {
      type: 'START_SEASON',
      commandId: 'reservation-next-season-start-1',
      expectedRevision: initialSnapshot.revision,
      payload: { simulationMode: 'CHAPTER', serviceSeasonId: 'svc-reservation-1' },
    });
    const afterRole = runNationalScenario(started, seasonOneRuleset, {
      type: 'RESOLVE_ROLE',
      commandId: 'reservation-next-season-role-1',
      expectedRevision: started.revision,
      payload: { decision: 'ACCEPT' },
    });
    const called = runNationalScenario(afterRole, seasonOneRuleset, {
      type: 'ADVANCE',
      commandId: 'reservation-next-season-call-up-1',
      expectedRevision: afterRole.revision,
      payload: { eligibleEvents: [] },
    });
    const accepted = runNationalScenario(called, seasonOneRuleset, {
      type: 'RESOLVE_EVENT',
      commandId: 'reservation-next-season-accept-1',
      expectedRevision: called.revision,
      payload: {
        eventId: EVENT_ID,
        definitionVersion: EVENT_VERSION,
        choiceId: 'A',
        callUp: 'ACCEPT',
        outcomes: [{ id: 'A1', kind: 'FIXED', weight: 1, effects: [] }],
      },
    });
    const reservation = accepted.state.nationalTeam.pendingDebut;
    expect(reservation).not.toBeNull();

    const noChapterSlot = runNationalScenario(accepted, seasonOneRuleset, {
      type: 'ADVANCE',
      commandId: 'reservation-next-season-no-chapter-1',
      expectedRevision: accepted.revision,
      payload: { eligibleEvents: [], chapterCandidates: [nationalChapterCandidate()] },
    });
    expect(noChapterSlot.state.pending).toEqual({ kind: 'SETTLEMENT', step: 12 });
    expect(noChapterSlot.state.season?.chapters).toEqual([]);
    expect(noChapterSlot.state.nationalTeam.pendingDebut).toEqual(reservation);

    const settled = runNationalScenario(noChapterSlot, seasonOneRuleset, {
      type: 'SETTLE_SEASON',
      commandId: 'reservation-next-season-settle-1',
      expectedRevision: noChapterSlot.revision,
      payload: {},
    });
    expect(settled.state.season).toBeNull();
    expect(settled.state.nationalTeam.pendingDebut).toEqual(reservation);

    const nextStarted = runNationalScenario(settled, seasonTwoRuleset, {
      type: 'START_SEASON',
      commandId: 'reservation-next-season-start-2',
      expectedRevision: settled.revision,
      payload: { simulationMode: 'CHAPTER', serviceSeasonId: 'svc-reservation-2' },
    });
    const nextAfterRole = runNationalScenario(nextStarted, seasonTwoRuleset, {
      type: 'RESOLVE_ROLE',
      commandId: 'reservation-next-season-role-2',
      expectedRevision: nextStarted.revision,
      payload: { decision: 'ACCEPT' },
    });
    const nextChapter = runNationalScenario(nextAfterRole, seasonTwoRuleset, {
      type: 'ADVANCE',
      commandId: 'reservation-next-season-chapter-2',
      expectedRevision: nextAfterRole.revision,
      payload: { eligibleEvents: [], chapterCandidates: [nationalChapterCandidate()] },
    });
    expect(nextChapter.state.pending).toMatchObject({
      kind: 'CHAPTER',
      trigger: 'NATIONAL_DEBUT',
      chapterId: 'CHP-NAT-001',
      step: 9,
      virtualOpponent: reservation,
    });
    const pending = nextChapter.state.pending;
    if (pending?.kind !== 'CHAPTER') return;
    const debutMatch = nextChapter.state.season?.matches.find((match) => match.id === pending.matchId);
    expect(debutMatch).toBeDefined();
    expect(debutMatch?.minutes ?? 0).toBeGreaterThan(0);
    expect(debutMatch?.chapterId).toBeNull();
    expect(nextChapter.state.nationalTeam.pendingDebut).toEqual(reservation);
  });

  it('keeps the reservation in CareerState when an injury blocks the next CHAPTER appearance', () => {
    const ruleset = nationalScenarioRuleset({ nationalTeamStep: null, chapterStep: 2 });
    const source = makeEligibleState({ tier: 1, baseOvr: 68 });
    const acceptedRecord = buildNationalTeamCallUpRecord(source, EVENT_ID, EVENT_VERSION, 'ACCEPT', null, 8);
    const nationalTeam = reserveNationalDebut(
      applyNationalTeamCallUp(emptyNationalTeam(), acceptedRecord),
      ruleset,
    );
    const activeInjury = {
      id: 'INJ-1-1-1',
      severity: 'MODERATE',
      bodyPart: 'KNEE',
      occurredAt: { seasonIndex: 1, step: 1, matchId: 'prior-match' },
      diagnosisRange: { minMatches: 3, maxMatches: 4 },
      rehab: 'STANDARD',
      recurrenceRiskBp: 0,
      recurrenceChecksRemaining: 0,
      status: 'REHAB',
      permanentDelta: null,
      remainingMatches: 99,
    } satisfies CareerState['health']['episodes'][number];
    const initialState: CareerState = {
      ...source,
      currentStep: 0,
      seasonPhase: 'PRESEASON',
      rngState: seedRng('national-reservation-injury'),
      nationalTeam,
      health: { episodes: [activeInjury] },
    };
    const initialSnapshot: DomainSnapshot = {
      revision: 140,
      checkpoint: 'CONTRACT_CONFIRMED',
      state: initialState,
      stateHash: hashState(initialState),
      rulesetVersion: ruleset.version,
      contentPackVersion: '0.1.0',
    };

    const started = runNationalScenario(initialSnapshot, ruleset, {
      type: 'START_SEASON',
      commandId: 'reservation-injury-start',
      expectedRevision: initialSnapshot.revision,
      payload: { simulationMode: 'CHAPTER', serviceSeasonId: 'svc-reservation-injury' },
    });
    const afterRole = runNationalScenario(started, ruleset, {
      type: 'RESOLVE_ROLE',
      commandId: 'reservation-injury-role',
      expectedRevision: started.revision,
      payload: { decision: 'ACCEPT' },
    });

    const advanced = runNationalScenario(afterRole, ruleset, {
      type: 'ADVANCE',
      commandId: 'reservation-injury-advance',
      expectedRevision: afterRole.revision,
      payload: { eligibleEvents: [], chapterCandidates: [nationalChapterCandidate()] },
    });

    expect(advanced.state.pending).toEqual({ kind: 'SETTLEMENT', step: 12 });
    expect(advanced.state.season?.chapters).toEqual([]);
    expect(advanced.state.nationalTeam).toEqual(nationalTeam);
    expect(advanced.state.nationalTeam.pendingDebut).not.toBeNull();
  });

  it('runs step 8 call-up → ACCEPT → next CHAPTER NATIONAL_DEBUT → continuation identically twice for the same seed', () => {
    const integrationRuleset = nationalScenarioRuleset({ nationalTeamStep: 8, chapterStep: 11 });
    const runFlow = (seed: string): NationalIntegrationFlow => {
      const initialState = { ...makeEligibleState({ tier: 1, baseOvr: 68 }), rngState: seedRng(seed) };
      const initialSnapshot: DomainSnapshot = {
        revision: 50,
        checkpoint: 'CONTRACT_CONFIRMED',
        state: initialState,
        stateHash: hashState(initialState),
        rulesetVersion: integrationRuleset.version,
        contentPackVersion: '0.1.0',
      };

      const started = runNationalScenario(initialSnapshot, integrationRuleset, {
        type: 'START_SEASON',
        commandId: 'national-integration-start',
        expectedRevision: initialSnapshot.revision,
        payload: { simulationMode: 'CHAPTER', serviceSeasonId: 'svc-national-integration' },
      });
      const afterRole = runNationalScenario(started, integrationRuleset, {
        type: 'RESOLVE_ROLE',
        commandId: 'national-integration-role',
        expectedRevision: started.revision,
        payload: { decision: 'ACCEPT' },
      });
      const called = runNationalScenario(afterRole, integrationRuleset, {
        type: 'ADVANCE',
        commandId: 'national-integration-to-call-up',
        expectedRevision: afterRole.revision,
        payload: { eligibleEvents: [] },
      });
      const accepted = runNationalScenario(called, integrationRuleset, {
        type: 'RESOLVE_EVENT',
        commandId: 'national-integration-accept',
        expectedRevision: called.revision,
        payload: {
          eventId: EVENT_ID,
          definitionVersion: EVENT_VERSION,
          choiceId: 'A',
          callUp: 'ACCEPT',
          outcomes: [{ id: 'A1', kind: 'FIXED', weight: 1, effects: [] }],
        },
      });
      const debut = runNationalScenario(accepted, integrationRuleset, {
        type: 'ADVANCE',
        commandId: 'national-integration-to-debut',
        expectedRevision: accepted.revision,
        payload: { eligibleEvents: [], chapterCandidates: [nationalChapterCandidate()] },
      });
      const completed = runNationalScenario(debut, integrationRuleset, {
        type: 'RESOLVE_CHAPTER',
        commandId: 'national-integration-debut-resolve',
        expectedRevision: debut.revision,
        payload: {
          chapterId: 'CHP-NAT-001',
          definitionVersion: 1,
          decisionId: 'D1',
          optionId: 'STEADY',
          outcomes: [{ id: 'STEADY-1', kind: 'FIXED', weight: 1, effects: [], ratingDeltaTenths: 0 }],
        },
      });
      const continued = runNationalScenario(completed, integrationRuleset, {
        type: 'ADVANCE',
        commandId: 'national-integration-continue',
        expectedRevision: completed.revision,
        payload: { eligibleEvents: [], chapterCandidates: [nationalChapterCandidate()] },
      });
      return [started, afterRole, called, accepted, debut, completed, continued];
    };

    const first = runFlow('offside-fixture-01');
    const second = runFlow('offside-fixture-01');
    const fingerprints = (snapshots: readonly DomainSnapshot[]) =>
      snapshots.map((snapshot) => ({
        revision: snapshot.revision,
        stateHash: snapshot.stateHash,
        rngDraws: snapshot.state.rngState.draws,
      }));
    expect(fingerprints(second)).toEqual(fingerprints(first));

    const [started, afterRole, called, accepted, debut, completed, continued] = first;
    expect(started.state.pending?.kind).toBe('ROLE_PROPOSAL');
    expect(called.state.pending).toEqual({
      kind: 'NATIONAL_TEAM',
      step: 8,
      eventId: EVENT_ID,
      version: EVENT_VERSION,
    });
    expect(accepted.state.pending).toBeNull();
    expect(accepted.state.nationalTeam.pendingDebut).not.toBeNull();
    expect(accepted.state.tags).toContain('대표팀_소집');
    expect(debut.state.pending).toMatchObject({
      kind: 'CHAPTER',
      trigger: 'NATIONAL_DEBUT',
      chapterId: 'CHP-NAT-001',
      virtualOpponent: accepted.state.nationalTeam.pendingDebut,
    });
    expect(debut.state.season?.matches.length).toBeGreaterThan(0);
    expect(completed.state.nationalTeam).toEqual({
      callUps: [expect.objectContaining({ decision: 'ACCEPT' })],
      debuted: true,
      pendingDebut: null,
    });
    expect(completed.state.season?.chapters.filter((chapter) => chapter.trigger === 'NATIONAL_DEBUT')).toHaveLength(1);
    expect(continued.state.pending).toEqual({ kind: 'SETTLEMENT', step: 12 });
    expect(continued.state.nationalTeam.debuted).toBe(true);
    expect(continued.state.season?.chapters.filter((chapter) => chapter.trigger === 'NATIONAL_DEBUT')).toHaveLength(1);
    expect(continued.state.rngState.draws).toBe(first.at(-1)!.state.rngState.draws);
    expect(verifySnapshot(continued)).toEqual({ ok: true });
    expect(afterRole.state.rngState.draws).toBe(started.state.rngState.draws);
  });

  it('canonicalization is independent of national-state property insertion order', () => {
    const state = makeEligibleState();
    const reordered: CareerState = {
      ...state,
      nationalityRuleState: { exceptions: [], moduleId: 'DEFAULT' },
      nationalTeam: { pendingDebut: null, debuted: false, callUps: [] },
    };
    expect(hashState(state)).toBe(hashState(reordered));
  });
});

describe('T-4-004 helper invariants', () => {
  it('appends a call-up record without mutating the source state', () => {
    const state = makeEligibleState();
    const record = buildNationalTeamCallUpRecord(state, EVENT_ID, EVENT_VERSION, 'DECLINE');
    const next = applyNationalTeamCallUp(emptyNationalTeam(), record);
    expect(next.callUps[0]?.decision).toBe('DECLINE');
    expect(emptyNationalTeam()).toEqual({ callUps: [], debuted: false, pendingDebut: null });
    expect(state.nationalTeam).toEqual(emptyNationalTeam());
  });
});
