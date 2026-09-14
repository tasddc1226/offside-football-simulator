import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import ruleset160Raw from '../../content/rulesets/1.6.0/ruleset.json' with { type: 'json' };
import type { Ruleset } from './ruleset.js';
import { runGkFixture } from './__fixtures__/career-04-gk.js';
import { runSettledFixture } from './__fixtures__/career-06-settled.js';
import { compareCodePoints } from './canonical.js';
import { hashState } from './hash.js';
import { hashSeasonResult } from './settlement.js';
import * as injuryModule from './injury.js';
import { rollRange } from './roll-range.js';
import {
  computeSquadStatus,
  familiarityOf,
  rankPositionForPlayer,
  squadRoleFromSelection,
} from './selection.js';
import { simulate, verifySnapshot, type Command, type SimulationInput } from './simulate.js';
import type {
  DomainSnapshot,
  Effect,
  InjuryEpisode,
  NationalTeamCallUp,
  PlayerProfile,
  Position,
  RehabPlan,
  TimelineEntry,
} from './types.js';

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK = '0.1.0';
const RULESET = rulesetProto;

type EngineCommand = Command & { commandId: string; expectedRevision: number };
type CreateCareerCommand = Extract<Command, { type: 'CREATE_CAREER' }> & {
  commandId: string;
  expectedRevision: number;
};

function baseInput(
  overrides: Partial<SimulationInput> = {},
): Omit<SimulationInput, 'command' | 'snapshot'> {
  return {
    ruleset: RULESET,
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK,
    ...overrides,
  };
}

function createCareerCommand(overrides?: {
  careerId?: string;
  seed?: string;
}): CreateCareerCommand {
  return {
    type: 'CREATE_CAREER',
    commandId: 'cmd-create',
    expectedRevision: 0,
    payload: {
      careerId: overrides?.careerId ?? 'car_test',
      seed: overrides?.seed ?? 'simulate-test-seed',
      simulationMode: 'CHAPTER',
      rulesetVersion: RULESET_VERSION,
      contentPackVersion: CONTENT_PACK,
    },
  };
}

function createDraftSnapshot(seed?: string): DomainSnapshot {
  const result = simulate({
    ...baseInput(),
    snapshot: null,
    command: createCareerCommand(seed === undefined ? undefined : { seed }),
  });
  if (!result.ok) throw new Error(`setup failed: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

function updateDraft(snapshot: DomainSnapshot, draft: Record<string, unknown>) {
  const command: EngineCommand = {
    type: 'UPDATE_PLAYER_DRAFT',
    commandId: `cmd-draft-${snapshot.revision}`,
    expectedRevision: snapshot.revision,
    payload: { draft },
  };
  return simulate({ ...baseInput(), snapshot, command });
}

const FULL_DRAFT_STEP_1 = {
  name: '김서준',
  gender: 'UNSPECIFIED' as const,
  nationalityCode: 'KR',
  preferredFoot: 'LEFT' as const,
};
const FULL_DRAFT_STEP_2 = {
  position: 'W' as const,
  archetypeId: 'inside-forward',
  backgroundId: 'club-academy',
};

/** DRAFT: CREATE_CAREER 뒤 7개 필드를 모두 채운 snapshot(아직 CONFIRM_PLAYER 전). */
function fullyDraftedSnapshot(seed?: string): DomainSnapshot {
  let snapshot = createDraftSnapshot(seed);
  const step1 = updateDraft(snapshot, FULL_DRAFT_STEP_1);
  if (!step1.ok) throw new Error('draft step1 failed');
  snapshot = step1.snapshot;
  const step2 = updateDraft(snapshot, FULL_DRAFT_STEP_2);
  if (!step2.ok) throw new Error('draft step2 failed');
  return step2.snapshot;
}

function confirmPlayerCommand(expectedRevision: number): EngineCommand {
  return {
    type: 'CONFIRM_PLAYER',
    commandId: `cmd-confirm-${expectedRevision}`,
    expectedRevision,
    payload: {},
  };
}

/** ACTIVE: 김서준 draft를 CONFIRM_PLAYER까지 마친 snapshot. */
function confirmedActiveSnapshot(seed?: string): DomainSnapshot {
  const drafted = fullyDraftedSnapshot(seed);
  const result = simulate({
    ...baseInput(),
    snapshot: drafted,
    command: confirmPlayerCommand(drafted.revision),
  });
  if (!result.ok)
    throw new Error(`CONFIRM_PLAYER failed: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

function advanceCommand(
  expectedRevision: number,
  eligibleEvents: Array<{ eventId: string; version: number; weight: number }> = [],
): EngineCommand {
  return {
    type: 'ADVANCE',
    commandId: `cmd-advance-${expectedRevision}`,
    expectedRevision,
    payload: { eligibleEvents },
  };
}

function resolveEventCommand(
  expectedRevision: number,
  overrides?: Partial<{
    eventId: string;
    definitionVersion: number;
    choiceId: string;
    outcomes: Array<{ id: string; kind: 'SUCCESS' | 'NEUTRAL' | 'FAIL' | 'FIXED'; weight: number; effects: Effect[]; addTags?: string[] }>;
    rehabPlan: RehabPlan;
    callUp: NationalTeamCallUp;
  }>,
): EngineCommand {
  const outcomes = overrides?.outcomes ?? [
    {
      id: 'success',
      kind: 'SUCCESS',
      weight: 70,
      effects: [
        {
          kind: 'RELATION',
          sourceId: 'EVT-TEST.A.success',
          target: 'managerTrust',
          delta: 5,
          clamp: { min: 0, max: 100 },
          appliesAt: { kind: 'IMMEDIATE' },
          expiresAt: null,
          stackingRule: 'ONCE_PER_SOURCE',
        } as Effect,
      ],
      addTags: ['지시를_따름'],
    },
    {
      id: 'neutral',
      kind: 'NEUTRAL',
      weight: 30,
      effects: [
        {
          kind: 'CURRENT',
          sourceId: 'EVT-TEST.A.neutral',
          target: 'morale',
          delta: -3,
          clamp: { min: 0, max: 100 },
          appliesAt: { kind: 'IMMEDIATE' },
          expiresAt: null,
          stackingRule: 'SUM',
        } as Effect,
      ],
    },
  ];
  return {
    type: 'RESOLVE_EVENT',
    commandId: `cmd-resolve-${expectedRevision}`,
    expectedRevision,
    payload: {
      eventId: overrides?.eventId ?? 'EVT-TEST',
      definitionVersion: overrides?.definitionVersion ?? 1,
      choiceId: overrides?.choiceId ?? 'A',
      outcomes,
      ...(overrides?.rehabPlan !== undefined ? { rehabPlan: overrides.rehabPlan } : {}),
      ...(overrides?.callUp !== undefined ? { callUp: overrides.callUp } : {}),
    },
  };
}

/** ACTIVE 스냅샷에 EVT-TEST를 pending으로 올려 둔다(단일 후보라 rng를 소비하지 않는다). */
function withPendingEvent(active: DomainSnapshot, eventId = 'EVT-TEST'): DomainSnapshot {
  const result = simulate({
    ...baseInput(),
    snapshot: active,
    command: advanceCommand(active.revision, [{ eventId, version: 1, weight: 10 }]),
  });
  if (!result.ok) throw new Error('withPendingEvent failed');
  return result.snapshot;
}

/** ACTIVE: 배경을 골라 CONFIRM_PLAYER까지 마친 snapshot(관계 초기값이 배경마다 다름을 이용한 테스트용). */
function confirmedActiveSnapshotWithBackground(
  backgroundId: string,
  seed?: string,
): DomainSnapshot {
  let snapshot = createDraftSnapshot(seed);
  const step1 = updateDraft(snapshot, FULL_DRAFT_STEP_1);
  if (!step1.ok) throw new Error('draft step1 failed');
  snapshot = step1.snapshot;
  const step2 = updateDraft(snapshot, {
    position: 'W',
    archetypeId: 'inside-forward',
    backgroundId,
  });
  if (!step2.ok) throw new Error('draft step2 failed');
  const result = simulate({
    ...baseInput(),
    snapshot: step2.snapshot,
    command: confirmPlayerCommand(step2.snapshot.revision),
  });
  if (!result.ok)
    throw new Error(`CONFIRM_PLAYER failed: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

/** 제안 분기 테스트용으로 offerRules 태그만 강제로 덮어쓴다(정렬·중복 없이 이미 정렬된 태그를 준다). */
function withTags(snapshot: DomainSnapshot, tags: string[]): DomainSnapshot {
  return { ...snapshot, state: { ...snapshot.state, tags: [...tags].sort(compareCodePoints) } };
}

/** baseOvr 경계 테스트용으로 player.profile.baseOvr만 강제로 덮어쓴다. */
function withBaseOvr(snapshot: DomainSnapshot, baseOvr: number): DomainSnapshot {
  const profile = snapshot.state.player.profile as PlayerProfile;
  return {
    ...snapshot,
    state: {
      ...snapshot.state,
      player: { ...snapshot.state.player, profile: { ...profile, baseOvr } },
    },
  };
}

function acceptOfferCommand(expectedRevision: number, offerId: string): EngineCommand {
  return {
    type: 'ACCEPT_OFFER',
    commandId: `cmd-accept-${expectedRevision}`,
    expectedRevision,
    payload: { offerId },
  };
}

describe('simulate — CREATE_CAREER', () => {
  it('DRAFT 상태의 첫 Snapshot을 revision 1로 만든다', () => {
    const result = simulate({ ...baseInput(), snapshot: null, command: createCareerCommand() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.revision).toBe(1);
    expect(result.snapshot.checkpoint).toBe('CAREER_CREATED');
    expect(result.snapshot.state.status).toBe('DRAFT');
    expect(result.snapshot.state.stage).toBe('YOUTH');
    expect(result.snapshot.state.age).toBe(17);
    expect(result.snapshot.state.currentStep).toBe(0);
    expect(result.snapshot.state.seasonPhase).toBe('PRESEASON');
    expect(result.snapshot.state.player).toEqual({
      draft: {
        name: null,
        gender: null,
        nationalityCode: null,
        preferredFoot: null,
        position: null,
        archetypeId: null,
        backgroundId: null,
      },
      profile: null,
    });
    expect(result.snapshot.state.pending).toBeNull();
    expect(result.snapshot.state.contract).toBeNull();
    expect(result.snapshot.state.nationalityRuleState).toEqual({ moduleId: 'DEFAULT', exceptions: [] });
    expect(result.snapshot.state.timeline).toEqual([]);
    expect(result.snapshot.state.rngState.draws).toBe(0);
    expect(Object.values(result.snapshot.state.attributes).every((v) => v === 0)).toBe(true);
    expect(result.snapshot.stateHash).toBe(hashState(result.snapshot.state));
  });

  it('새 룰셋은 시작 나이를 선택하고 과거 룰셋은 17세 폴백을 유지한다', () => {
    const ruleset19 = { ...RULESET, version: '1.2.0', initialAge: 19 };
    const command = {
      ...createCareerCommand(),
      payload: { ...createCareerCommand().payload, rulesetVersion: '1.2.0' },
    };
    const result = simulate({ ...baseInput({ ruleset: ruleset19, rulesetVersion: '1.2.0' }), snapshot: null, command });
    expect(result.ok && result.snapshot.state.age).toBe(19);

    const legacy = simulate({ ...baseInput(), snapshot: null, command: createCareerCommand() });
    expect(legacy.ok && legacy.snapshot.state.age).toBe(17);
  });

  it('명령 버전이 SimulationInput과 다르면 VERSION_MISMATCH다', () => {
    const command = createCareerCommand();
    command.payload.rulesetVersion = '9.9.9';
    const result = simulate({ ...baseInput(), snapshot: null, command });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VERSION_MISMATCH');
  });

  it('룰셋의 version이 SimulationInput.rulesetVersion과 다르면 VERSION_MISMATCH다', () => {
    const result = simulate({
      ...baseInput({ ruleset: { ...RULESET, version: '9.9.9' } }),
      snapshot: null,
      command: createCareerCommand(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VERSION_MISMATCH');
  });

  it('기존 snapshot이 있으면 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({ ...baseInput(), snapshot, command: createCareerCommand() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('simulate — UPDATE_PLAYER_DRAFT', () => {
  it('준 필드만 병합하고 rng를 소비하지 않는다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { name: '김서준' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.player.draft.name).toBe('김서준');
    expect(result.snapshot.state.player.draft.nationalityCode).toBeNull();
    expect(result.snapshot.state.rngState.draws).toBe(0);
    expect(result.snapshot.checkpoint).toBe('CAREER_CREATED');
  });

  it('DRAFT가 아닌 상태에서는 VALIDATION_FAILED다', () => {
    const active = confirmedActiveSnapshot();
    const result = updateDraft(active, { name: '다른이름' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.details).toEqual({ reason: 'NOT_DRAFT' });
  });

  it('이름이 2자 미만이면 VALIDATION_FAILED(LENGTH)다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { name: '김' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: 'name', reason: 'LENGTH' });
  });

  it('이름에 제어문자가 있으면 VALIDATION_FAILED(CONTROL_CHARS)다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { name: '김서준\n' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: 'name', reason: 'CONTROL_CHARS' });
  });

  it('알 수 없는 성별은 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { gender: 'OTHER' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: 'gender', reason: 'UNKNOWN' });
  });

  it('성별 세 값(FEMALE·MALE·UNSPECIFIED)을 모두 받아들이고 rng를 소비하지 않는다', () => {
    const snapshot = createDraftSnapshot();
    for (const gender of ['FEMALE', 'MALE', 'UNSPECIFIED'] as const) {
      const result = updateDraft(snapshot, { gender });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.snapshot.state.player.draft.gender).toBe(gender);
      expect(result.snapshot.state.rngState.draws).toBe(0);
    }
  });

  it('알 수 없는 국적 코드는 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { nationalityCode: 'ZZ' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: 'nationalityCode', reason: 'UNKNOWN' });
  });

  it('알 수 없는 주발은 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { preferredFoot: 'CENTER' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: 'preferredFoot', reason: 'UNKNOWN' });
  });

  it('알 수 없는 포지션은 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { position: 'XX' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: 'position', reason: 'UNKNOWN' });
  });

  it('알 수 없는 배경은 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { backgroundId: 'no-such-background' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: 'backgroundId', reason: 'UNKNOWN' });
  });

  it('아키타입과 포지션이 어긋나면 VALIDATION_FAILED(ARCHETYPE_POSITION_MISMATCH)다', () => {
    const snapshot = createDraftSnapshot();
    const result = updateDraft(snapshot, { position: 'ST', archetypeId: 'inside-forward' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({
      field: 'archetypeId',
      reason: 'ARCHETYPE_POSITION_MISMATCH',
    });
  });

  it('현재 저장된 position 기준으로 archetype만 바꿔도 불일치를 잡는다', () => {
    const snapshot = createDraftSnapshot();
    const withPosition = updateDraft(snapshot, { position: 'ST' });
    expect(withPosition.ok).toBe(true);
    if (!withPosition.ok) return;
    const result = updateDraft(withPosition.snapshot, { archetypeId: 'inside-forward' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({
      field: 'archetypeId',
      reason: 'ARCHETYPE_POSITION_MISMATCH',
    });
  });
});

describe('simulate — CONFIRM_PLAYER', () => {
  it('draft 필드가 비어 있으면 missing 목록과 함께 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot,
      command: confirmPlayerCommand(snapshot.revision),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({
      missing: [
        'name',
        'gender',
        'nationalityCode',
        'preferredFoot',
        'position',
        'archetypeId',
        'backgroundId',
      ],
    });
  });

  it('gender만 비어 있으면 missing에 gender만 담긴다', () => {
    let snapshot = createDraftSnapshot();
    const step1 = updateDraft(snapshot, {
      name: '김서준',
      nationalityCode: 'KR',
      preferredFoot: 'LEFT',
    });
    if (!step1.ok) throw new Error('draft step1 failed');
    snapshot = step1.snapshot;
    const step2 = updateDraft(snapshot, FULL_DRAFT_STEP_2);
    if (!step2.ok) throw new Error('draft step2 failed');
    snapshot = step2.snapshot;

    const result = simulate({
      ...baseInput(),
      snapshot,
      command: confirmPlayerCommand(snapshot.revision),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ missing: ['gender'] });
  });

  it('DRAFT가 아닌 상태에서는 VALIDATION_FAILED다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: confirmPlayerCommand(active.revision),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOT_DRAFT' });
  });

  it('rng를 정확히 23회 소비하고 status·currentStep·seasonPhase를 확정한다', () => {
    const drafted = fullyDraftedSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: drafted,
      command: confirmPlayerCommand(drafted.revision),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.rngState.draws).toBe(drafted.state.rngState.draws + 23);
    expect(result.snapshot.state.status).toBe('ACTIVE');
    expect(result.snapshot.state.currentStep).toBe(12);
    expect(result.snapshot.state.seasonPhase).toBe('SETTLEMENT');
    expect(result.snapshot.state.player.profile).not.toBeNull();
    expect(result.snapshot.checkpoint).toBe('CAREER_CREATED');
    expect(result.nextAction).toBe('ADVANCE');
  });

  it('club-academy 배경의 state·context·relationships가 D-5 표와 정확히 같다', () => {
    const active = confirmedActiveSnapshot();
    expect(active.state.state).toEqual({ form: 50, fitness: 80, morale: 60 });
    expect(active.state.context).toEqual({
      tacticalFit: 58,
      squadStatus: 40,
      positionProficiency: 100,
    });
    expect(active.state.relationships).toEqual({
      managerTrust: 40,
      captain: 50,
      rival: 50,
      fans: 50,
      agent: 50,
    });
  });

  it('CAREER_CONFIRMED 타임라인 항목을 남긴다', () => {
    const active = confirmedActiveSnapshot();
    expect(active.state.timeline).toEqual([
      {
        revision: active.revision,
        kind: 'CAREER_CONFIRMED',
        refId: null,
        age: 17,
        step: 12,
      } satisfies TimelineEntry,
    ]);
  });
});

describe('simulate — DRAFT 단계는 rng를 소비하지 않는다', () => {
  it('CREATE_CAREER·UPDATE_PLAYER_DRAFT 모두 draws가 0이다', () => {
    const created = createDraftSnapshot();
    expect(created.state.rngState.draws).toBe(0);
    const step1 = updateDraft(created, FULL_DRAFT_STEP_1);
    if (!step1.ok) throw new Error('unreachable');
    expect(step1.snapshot.state.rngState.draws).toBe(0);
    const step2 = updateDraft(step1.snapshot, FULL_DRAFT_STEP_2);
    if (!step2.ok) throw new Error('unreachable');
    expect(step2.snapshot.state.rngState.draws).toBe(0);
  });

  it('DRAFT 상태에서 ADVANCE는 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot,
      command: advanceCommand(snapshot.revision),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('DRAFT 상태에서 RESOLVE_EVENT는 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot,
      command: resolveEventCommand(snapshot.revision),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('simulate — ADVANCE', () => {
  it('eligibleEvents가 1개면 rng를 소비하지 않고 그대로 pending에 올린다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, [{ eventId: 'EVT-A', version: 1, weight: 10 }]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.rngState.draws).toBe(active.state.rngState.draws);
    expect(result.snapshot.state.pending).toEqual({ kind: 'EVENT', eventId: 'EVT-A', version: 1 });
    expect(result.snapshot.checkpoint).toBe('EVENT_OFFERED');
    expect(result.nextAction).toBe('DECISION');
  });

  it('같은 seed에서 가중 선택은 항상 같은 이벤트를 고른다', () => {
    const events = [
      { eventId: 'EVT-A', version: 1, weight: 30 },
      { eventId: 'EVT-B', version: 1, weight: 70 },
    ];
    const runOnce = () => {
      const active = confirmedActiveSnapshot('weighted-select-seed');
      const result = simulate({
        ...baseInput(),
        snapshot: active,
        command: advanceCommand(active.revision, events),
      });
      if (!result.ok) throw new Error('unreachable');
      return result.snapshot.state.pending;
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it('누적 구간 경계(roll = 첫 weight, 첫 weight+1)가 정확히 갈린다', () => {
    const weightSum = 1000;
    const active = confirmedActiveSnapshot('boundary-seed');
    const predicted = rollRange(active.state.rngState, 1, weightSum);
    const r = predicted.value;
    expect(r).toBeGreaterThanOrEqual(2);
    expect(r).toBeLessThanOrEqual(weightSum - 1);

    const atBoundary = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, [
        { eventId: 'EVT-A', version: 1, weight: r },
        { eventId: 'EVT-B', version: 1, weight: weightSum - r },
      ]),
    });
    expect(atBoundary.ok).toBe(true);
    if (atBoundary.ok) {
      expect(atBoundary.snapshot.state.pending).toEqual({
        kind: 'EVENT',
        eventId: 'EVT-A',
        version: 1,
      });
    }

    const pastBoundary = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, [
        { eventId: 'EVT-A', version: 1, weight: r - 1 },
        { eventId: 'EVT-B', version: 1, weight: weightSum - (r - 1) },
      ]),
    });
    expect(pastBoundary.ok).toBe(true);
    if (pastBoundary.ok) {
      expect(pastBoundary.snapshot.state.pending).toEqual({
        kind: 'EVENT',
        eventId: 'EVT-B',
        version: 1,
      });
    }
  });

  it('정렬 안 된 eligibleEvents는 UNSORTED_ELIGIBLE_EVENTS로 거부한다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, [
        { eventId: 'EVT-B', version: 1, weight: 10 },
        { eventId: 'EVT-A', version: 1, weight: 10 },
      ]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'UNSORTED_ELIGIBLE_EVENTS' });
  });

  it('pending이 이미 있으면 PENDING_DECISION으로 거부한다', () => {
    const active = confirmedActiveSnapshot();
    const withPending = withPendingEvent(active);
    const result = simulate({
      ...baseInput(),
      snapshot: withPending,
      command: advanceCommand(withPending.revision),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'PENDING_DECISION' });
  });

  it('eligibleEvents가 비어 있고 SETTLEMENT면 NOTHING_TO_ADVANCE다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, []),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOTHING_TO_ADVANCE' });
  });

  it('ACTIVE가 아니면 NOT_ACTIVE로 거부한다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot,
      command: advanceCommand(snapshot.revision),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOT_ACTIVE' });
  });
});

describe('simulate — RESOLVE_EVENT', () => {
  it('pending과 일치하면 roll 하나로 outcome을 고르고 pending을 비운다', () => {
    const active = confirmedActiveSnapshot();
    const pending = withPendingEvent(active);
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.revision).toBe(pending.revision + 1);
    expect(result.snapshot.checkpoint).toBe('EVENT_RESOLVED');
    expect(['success', 'neutral']).toContain(result.outcomeId);
    expect(typeof result.roll).toBe('number');
    expect(result.snapshot.state.pending).toBeNull();
    expect(result.snapshot.state.resolvedEventIds).toEqual(['EVT-TEST']);
    expect(result.snapshot.state.rngState.draws).toBe(pending.state.rngState.draws + 1);
    expect(result.nextAction).toBe('ADVANCE');
    const lastEntry = result.snapshot.state.timeline.at(-1);
    expect(lastEntry?.kind).toBe('EVENT_RESOLVED');
    expect(lastEntry?.refId).toBe(`EVT-TEST:A:${result.outcomeId}`);
  });

  it('pending이 없으면 NO_PENDING_EVENT다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: resolveEventCommand(active.revision),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NO_PENDING_EVENT' });
  });

  it('pending과 eventId·definitionVersion이 다르면 PENDING_EVENT_MISMATCH다', () => {
    const active = confirmedActiveSnapshot();
    const pending = withPendingEvent(active);
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision, { eventId: 'EVT-OTHER' }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'PENDING_EVENT_MISMATCH' });
  });

  it('revision 불일치는 CAREER_REVISION_CONFLICT다', () => {
    const active = confirmedActiveSnapshot();
    const pending = withPendingEvent(active);
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision + 99),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CAREER_REVISION_CONFLICT');
  });

  it('outcome 가중치 합이 정수가 아니면 throw하지 않고 VALIDATION_FAILED를 돌려준다', () => {
    const active = confirmedActiveSnapshot();
    const pending = withPendingEvent(active);
    const command = resolveEventCommand(pending.revision);
    if (command.type !== 'RESOLVE_EVENT') throw new Error('unreachable');
    command.payload.outcomes[0]!.weight = 33.3;
    expect(() => simulate({ ...baseInput(), snapshot: pending, command })).not.toThrow();
    const result = simulate({ ...baseInput(), snapshot: pending, command });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('outcome kind이 없으면 RNG를 소비하지 않고 OUTCOME_KIND_REQUIRED로 거부한다', () => {
    const active = confirmedActiveSnapshot();
    const pending = withPendingEvent(active);
    const beforeDraws = pending.state.rngState.draws;
    const command = resolveEventCommand(pending.revision);
    const malformed = JSON.parse(JSON.stringify(command)) as EngineCommand;
    if (malformed.type !== 'RESOLVE_EVENT') throw new Error('unreachable');
    delete (malformed.payload.outcomes[0] as unknown as { kind?: unknown }).kind;

    expect(() => simulate({ ...baseInput(), snapshot: pending, command: malformed })).not.toThrow();
    const result = simulate({ ...baseInput(), snapshot: pending, command: malformed });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'OUTCOME_KIND_REQUIRED' });
    expect(pending.state.rngState.draws).toBe(beforeDraws);
  });

  it.each(['EVT-ETH-010', 'EVT-MEDIA-010'] as const)('%s FAIL은 controversyFailures를 증가시킨다', (eventId) => {
    const active = confirmedActiveSnapshot();
    const pending = withPendingEvent(active, eventId);
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision, {
        eventId,
        outcomes: [{ id: 'fail', kind: 'FAIL', weight: 100, effects: [] }],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.controversyFailures).toBe(1);
    expect(result.snapshot.state.rngState.draws).toBe(pending.state.rngState.draws + 1);
  });
});

// T-4-001 D-52: RESOLVE_EVENT가 INJURY·NATIONAL_TEAM pending도 닫는다. 생성기(T-4-002·T-4-004)가
// 아직 없어 정상 경로로는 이 pending이 열리지 않으므로, 테스트가 직접 snapshot에 주입한다(다른
// describe들의 `withRoleProposal`/tampered-snapshot 패턴과 같다).
describe('simulate — RESOLVE_EVENT (INJURY·NATIONAL_TEAM, T-4-001 D-52)', () => {
  const TEST_EPISODE: InjuryEpisode = {
    id: 'INJ-1-3-1',
    severity: 'MODERATE',
    bodyPart: 'HAMSTRING',
    occurredAt: { seasonIndex: 1, step: 3, matchId: 'm1' },
    diagnosisRange: { minMatches: 3, maxMatches: 6 },
    rehab: null,
    recurrenceRiskBp: 3000,
    recurrenceChecksRemaining: 0,
    status: 'ACTIVE',
    permanentDelta: null,
    remainingMatches: 3,
  };

  function withPendingInjury(
    active: DomainSnapshot,
    episode: InjuryEpisode = TEST_EPISODE,
  ): DomainSnapshot {
    const state: DomainSnapshot['state'] = {
      ...active.state,
      health: { episodes: [episode] },
      pending: {
        kind: 'INJURY',
        step: active.state.currentStep,
        episodeId: episode.id,
        eventId: 'EVT-INJ-001',
        version: 1,
      },
    };
    return { ...active, state, stateHash: hashState(state) };
  }

  function withPendingNationalTeam(active: DomainSnapshot): DomainSnapshot {
    const state: DomainSnapshot['state'] = {
      ...active.state,
      pending: {
        kind: 'NATIONAL_TEAM',
        step: active.state.currentStep,
        eventId: 'EVT-NAT-001',
        version: 1,
      },
    };
    return { ...active, state, stateHash: hashState(state) };
  }

  it('INJURY pending: rehabPlan을 적용하고 REHAB_CHOSEN 타임라인을 남기며 pending을 비운다', () => {
    const pending = withPendingInjury(confirmedActiveSnapshot());
    const command = resolveEventCommand(pending.revision, {
      eventId: 'EVT-INJ-001',
      rehabPlan: 'EARLY',
    });
    const result = simulate({ ...baseInput(), snapshot: pending, command });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.pending).toBeNull();
    const episode = result.snapshot.state.health.episodes[0]!;
    expect(episode.status).toBe('REHAB');
    expect(episode.rehab).toBe('EARLY');
    // EARLY: returnShiftMatches -2, recurrenceAddBp +1500(rulesetProto.injuryRules.rehab.EARLY).
    expect(episode.diagnosisRange).toEqual({ minMatches: 3, maxMatches: 6 });
    expect(episode.recurrenceRiskBp).toBe(4500);
    const lastEntry = result.snapshot.state.timeline.at(-1);
    expect(lastEntry?.kind).toBe('REHAB_CHOSEN');
    expect(lastEntry?.refId).toBe('INJ-1-3-1');
  });

  it('INJURY pending: rehabPlan이 없으면 REHAB_PLAN_REQUIRED다', () => {
    const pending = withPendingInjury(confirmedActiveSnapshot());
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision, { eventId: 'EVT-INJ-001' }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'REHAB_PLAN_REQUIRED' });
  });

  it('INJURY pending: pending.episodeId가 health.episodes에 없으면 EPISODE_NOT_FOUND다', () => {
    const active = confirmedActiveSnapshot();
    const state: DomainSnapshot['state'] = {
      ...active.state,
      health: { episodes: [] },
      pending: {
        kind: 'INJURY',
        step: active.state.currentStep,
        episodeId: 'INJ-missing',
        eventId: 'EVT-INJ-001',
        version: 1,
      },
    };
    const pending: DomainSnapshot = { ...active, state, stateHash: hashState(state) };
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision, {
        eventId: 'EVT-INJ-001',
        rehabPlan: 'STANDARD',
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'EPISODE_NOT_FOUND' });
  });

  it('EVENT pending에 rehabPlan을 보내면 PAYLOAD_KIND_MISMATCH다', () => {
    const pending = withPendingEvent(confirmedActiveSnapshot());
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision, { rehabPlan: 'STANDARD' }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'PAYLOAD_KIND_MISMATCH' });
  });

  it('EVENT pending에 callUp을 보내면 PAYLOAD_KIND_MISMATCH다', () => {
    const pending = withPendingEvent(confirmedActiveSnapshot());
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision, { callUp: 'ACCEPT' }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'PAYLOAD_KIND_MISMATCH' });
  });

  it('NATIONAL_TEAM pending: callUp이 없으면 CALL_UP_REQUIRED다', () => {
    const pending = withPendingNationalTeam(confirmedActiveSnapshot());
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision, { eventId: 'EVT-NAT-001' }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'CALL_UP_REQUIRED' });
  });

  it.each(['ACCEPT', 'CONDITIONAL'] as const)(
    'NATIONAL_TEAM pending: callUp=%s는 NATIONAL_TEAM_CALLED를 남긴다',
    (callUp) => {
      const pending = withPendingNationalTeam(confirmedActiveSnapshot());
      const result = simulate({
        ...baseInput(),
        snapshot: pending,
        command: resolveEventCommand(pending.revision, {
          eventId: 'EVT-NAT-001',
          choiceId: callUp === 'ACCEPT' ? 'A' : 'B',
          callUp,
          outcomes: [
            {
              id: callUp === 'ACCEPT' ? 'A1' : 'B1',
              kind: 'FIXED',
              weight: 100,
              effects: [],
            },
          ],
        }),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.pending).toBeNull();
      const lastEntry = result.snapshot.state.timeline.at(-1);
      expect(lastEntry?.kind).toBe('NATIONAL_TEAM_CALLED');
      expect(lastEntry?.refId).toBe('EVT-NAT-001');
      expect(result.snapshot.state.tags).toContain('대표팀_소집');
      expect(result.snapshot.state.tags).not.toContain('NATIONAL_TEAM_CALLED');
    },
  );

  it('NATIONAL_TEAM pending: callUp=DECLINE은 NATIONAL_TEAM_DECLINED를 남긴다', () => {
    const pending = withPendingNationalTeam(confirmedActiveSnapshot());
    const result = simulate({
      ...baseInput(),
      snapshot: pending,
      command: resolveEventCommand(pending.revision, {
        eventId: 'EVT-NAT-001',
        choiceId: 'C',
        callUp: 'DECLINE',
        outcomes: [{ id: 'C1', kind: 'FIXED', weight: 100, effects: [] }],
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lastEntry = result.snapshot.state.timeline.at(-1);
    expect(lastEntry?.kind).toBe('NATIONAL_TEAM_DECLINED');
    expect(result.snapshot.state.tags).not.toContain('대표팀_소집');
    expect(result.snapshot.state.tags).not.toContain('NATIONAL_TEAM_DECLINED');
  });
});

describe('verifySnapshot', () => {
  it('정상 snapshot은 ok다', () => {
    const active = confirmedActiveSnapshot();
    expect(verifySnapshot(active)).toEqual({ ok: true });
  });

  it('state.attributes.shooting을 +1 하면 변조를 감지한다', () => {
    const active = confirmedActiveSnapshot();
    const tampered: DomainSnapshot = {
      ...active,
      state: {
        ...active.state,
        attributes: { ...active.state.attributes, shooting: active.state.attributes.shooting + 1 },
      },
    };
    const result = verifySnapshot(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('STATE_HASH_MISMATCH');
  });

  it('timeline revision이 줄어들면 실패한다', () => {
    const active = confirmedActiveSnapshot();
    const badTimeline = [
      ...active.state.timeline,
      { ...active.state.timeline[0]!, revision: active.state.timeline[0]!.revision - 1 },
    ];
    const tampered: DomainSnapshot = {
      ...active,
      state: { ...active.state, timeline: badTimeline },
    };
    const rehashed: DomainSnapshot = { ...tampered, stateHash: hashState(tampered.state) };
    expect(verifySnapshot(rehashed)).toEqual({ ok: false, reason: 'TIMELINE_NOT_MONOTONIC' });
  });

  // T-2-001: ADVANCE 한 번이 여러 step을 지나갈 수 있어(RULE-TIME-002) 같은 revision에
  // STEP_PASSED 항목이 여럿 남을 수 있다. "단조 증가"가 아니라 "비감소"만 검사한다.
  it('timeline revision이 같은 값으로 이어지면(같은 ADVANCE 안의 여러 STEP_PASSED) 통과한다', () => {
    const active = confirmedActiveSnapshot();
    const sameRevisionTimeline = [
      ...active.state.timeline,
      { ...active.state.timeline[0]!, revision: active.state.timeline[0]!.revision },
    ];
    const tampered: DomainSnapshot = {
      ...active,
      state: { ...active.state, timeline: sameRevisionTimeline },
    };
    const rehashed: DomainSnapshot = { ...tampered, stateHash: hashState(tampered.state) };
    expect(verifySnapshot(rehashed)).toEqual({ ok: true });
  });

  it('DRAFT 상태에 pending이 있으면 정합성 위반이다', () => {
    const drafted = createDraftSnapshot();
    const tampered: DomainSnapshot = {
      ...drafted,
      state: { ...drafted.state, pending: { kind: 'EVENT', eventId: 'EVT-X', version: 1 } },
    };
    const rehashed: DomainSnapshot = { ...tampered, stateHash: hashState(tampered.state) };
    expect(verifySnapshot(rehashed)).toEqual({ ok: false, reason: 'PENDING_STATUS_MISMATCH' });
  });

  it('contract와 pending(OFFERS)이 함께 있으면 CONTRACT_OFFERS_CONFLICT다', () => {
    const active = withTags(confirmedActiveSnapshot(), ['진로_아카데미']);
    const offered = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, []),
    });
    if (!offered.ok) throw new Error('setup failed');
    const tampered: DomainSnapshot = {
      ...offered.snapshot,
      state: {
        ...offered.snapshot.state,
        contract: {
          id: 'CTR-x',
          offerId: 'OFR-x-0',
          teamId: 'hangang-u18',
          teamName: '한강 FC U18',
          leagueTier: 'YOUTH',
          lengthSeasons: 1,
          wageMinorPerWeek: 0,
          signingBonusMinor: 0,
          rolePromise: 'STARTER',
          shirtNumber: 9,
          signatureType: 'AUTO',
          signedAtRevision: offered.snapshot.revision,
          kind: 'PERMANENT',
          appearancePromise: { minutesShareBp: 0 },
          positionPlan: 'ST',
          suspended: false,
          loan: null,
          promiseBreaches: 0,
          signedSeasonIndex: 1,
        },
      },
    };
    const rehashed: DomainSnapshot = { ...tampered, stateHash: hashState(tampered.state) };
    expect(verifySnapshot(rehashed)).toEqual({ ok: false, reason: 'CONTRACT_OFFERS_CONFLICT' });
  });

  it('contract와 pending(EVENT)이 함께 있어도 정합성 위반이 아니다(Phase 2 시즌 중 이벤트)', () => {
    // 계약된 선수에게 시즌 중 이벤트가 pending으로 걸리는 것은 Phase 2부터의 정상 상태다.
    // contract·pending 동시 존재 자체가 아니라 pending이 OFFERS일 때만 위반이다.
    const active = withTags(confirmedActiveSnapshot(), ['진로_아카데미']);
    const offered = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, []),
    });
    if (!offered.ok || offered.snapshot.state.pending?.kind !== 'OFFERS')
      throw new Error('setup failed');
    const offerId = offered.snapshot.state.pending.offers[0]!.id;
    const accepted = simulate({
      ...baseInput(),
      snapshot: offered.snapshot,
      command: acceptOfferCommand(offered.snapshot.revision, offerId),
    });
    if (!accepted.ok) throw new Error('accept failed');

    const tampered: DomainSnapshot = {
      ...accepted.snapshot,
      state: {
        ...accepted.snapshot.state,
        pending: { kind: 'EVENT', eventId: 'EVT-SEASON', version: 1 },
      },
    };
    const rehashed: DomainSnapshot = { ...tampered, stateHash: hashState(tampered.state) };
    expect(verifySnapshot(rehashed)).toEqual({ ok: true });
  });
});

describe('결정론', () => {
  it('명령 순서를 바꾸면 hash가 달라진다', () => {
    const active = confirmedActiveSnapshot();

    function makeResolveCommand(
      eventId: string,
      effect: Effect,
      expectedRevision: number,
    ): EngineCommand {
      return {
        type: 'RESOLVE_EVENT',
        commandId: `cmd-${eventId}`,
        expectedRevision,
        payload: {
          eventId,
          definitionVersion: 1,
          choiceId: 'a',
          outcomes: [{ id: '1', kind: 'SUCCESS', weight: 1, effects: [effect] }],
        },
      };
    }

    function withPending(snapshot: DomainSnapshot, eventId: string): DomainSnapshot {
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: advanceCommand(snapshot.revision, [{ eventId, version: 1, weight: 10 }]),
      });
      if (!result.ok) throw new Error('unreachable');
      return result.snapshot;
    }

    function run(first: [string, Effect], second: [string, Effect]): string {
      const pending1 = withPending(active, first[0]);
      const step1 = simulate({
        ...baseInput(),
        snapshot: pending1,
        command: makeResolveCommand(first[0], first[1], pending1.revision),
      });
      if (!step1.ok) throw new Error('step1 failed');
      const pending2 = withPending(step1.snapshot, second[0]);
      const step2 = simulate({
        ...baseInput(),
        snapshot: pending2,
        command: makeResolveCommand(second[0], second[1], pending2.revision),
      });
      if (!step2.ok) throw new Error('step2 failed');
      return step2.snapshot.stateHash;
    }

    const effectA: Effect = {
      kind: 'PERMANENT',
      sourceId: 'EVT-X.a.1',
      target: 'shooting',
      delta: 1,
      clamp: { min: 0, max: 99 },
      appliesAt: { kind: 'IMMEDIATE' },
      expiresAt: null,
      stackingRule: 'SUM',
    };
    const effectB: Effect = {
      kind: 'PERMANENT',
      sourceId: 'EVT-Y.a.1',
      target: 'passing',
      delta: 1,
      clamp: { min: 0, max: 99 },
      appliesAt: { kind: 'IMMEDIATE' },
      expiresAt: null,
      stackingRule: 'SUM',
    };

    const hashXThenY = run(['EVT-X', effectA], ['EVT-Y', effectB]);
    const hashYThenX = run(['EVT-Y', effectB], ['EVT-X', effectA]);
    expect(hashXThenY).not.toBe(hashYThenX);
  });
});

describe('RULE-PLY-001: gender는 시뮬레이션 입력이 아니다', () => {
  function confirmedSnapshotWithGender(
    gender: 'FEMALE' | 'MALE' | 'UNSPECIFIED',
    seed?: string,
  ): DomainSnapshot {
    let snapshot = createDraftSnapshot(seed);
    const step1 = updateDraft(snapshot, { ...FULL_DRAFT_STEP_1, gender });
    if (!step1.ok) throw new Error('draft step1 failed');
    snapshot = step1.snapshot;
    const step2 = updateDraft(snapshot, FULL_DRAFT_STEP_2);
    if (!step2.ok) throw new Error('draft step2 failed');
    const result = simulate({
      ...baseInput(),
      snapshot: step2.snapshot,
      command: confirmPlayerCommand(step2.snapshot.revision),
    });
    if (!result.ok)
      throw new Error(`CONFIRM_PLAYER failed: ${result.error.code} ${result.error.message}`);
    return result.snapshot;
  }

  it('같은 seed·나머지 DRAFT에서 성별 세 값의 attributes·truePotential·Base OVR·RNG state가 같다', () => {
    const female = confirmedSnapshotWithGender('FEMALE');
    const male = confirmedSnapshotWithGender('MALE');
    const unspecified = confirmedSnapshotWithGender('UNSPECIFIED');

    for (const other of [male, unspecified]) {
      expect(other.state.attributes).toEqual(female.state.attributes);
      expect(other.state.player.profile?.truePotential).toBe(
        female.state.player.profile?.truePotential,
      );
      expect(other.state.player.profile?.baseOvr).toBe(female.state.player.profile?.baseOvr);
      expect(other.state.player.profile?.scoutedPotentialMin).toBe(
        female.state.player.profile?.scoutedPotentialMin,
      );
      expect(other.state.player.profile?.scoutedPotentialMax).toBe(
        female.state.player.profile?.scoutedPotentialMax,
      );
      expect(other.state.rngState).toEqual(female.state.rngState);
    }

    // 정체성 필드(gender)가 다르므로 전체 상태 hash는 다르다. RULE-PLY-001은 시뮬레이션 결과가
    // 같아야 한다는 규칙이지 상태 전체가 같아야 한다는 뜻이 아니다.
    expect(male.stateHash).not.toBe(female.stateHash);
  });

  it('생성 시 preferredPosition·primaryPosition이 선택한 포지션과 같다', () => {
    const snapshot = confirmedSnapshotWithGender('UNSPECIFIED');
    expect(snapshot.state.player.profile?.preferredPosition).toBe('W');
    expect(snapshot.state.player.profile?.primaryPosition).toBe('W');
  });

  it('primaryPosition이 바뀌어도 preferredPosition은 유지된다', () => {
    // Phase 1 도메인에는 아직 주포지션 전환 명령이 없다. RULE-PLY-001이 요구하는 "두 필드는
    // 서로 독립적으로 저장되고 preferredPosition은 전환으로 바뀌지 않는다"는 불변식을,
    // primaryPosition만 바꾼 상태를 직접 구성해 preferredPosition이 영향받지 않음을 확인한다.
    const snapshot = confirmedSnapshotWithGender('UNSPECIFIED');
    const profile = snapshot.state.player.profile;
    if (profile === null) throw new Error('unreachable');
    const switched = { ...profile, primaryPosition: 'ST' as const };
    expect(switched.preferredPosition).toBe('W');
    expect(switched.primaryPosition).toBe('ST');
  });

  it('같은 상태에서 성별만 달라도 제안 내용·계약이 같다', () => {
    function offerAndContractFor(gender: 'FEMALE' | 'MALE' | 'UNSPECIFIED') {
      const active = withTags(confirmedSnapshotWithGender(gender), ['진로_아카데미']);
      const advanced = simulate({
        ...baseInput(),
        snapshot: active,
        command: advanceCommand(active.revision, []),
      });
      if (!advanced.ok)
        throw new Error(`ADVANCE failed: ${advanced.error.code} ${advanced.error.message}`);
      if (advanced.snapshot.state.pending?.kind !== 'OFFERS') throw new Error('unreachable');
      const offer = advanced.snapshot.state.pending.offers[0]!;
      const accepted = simulate({
        ...baseInput(),
        snapshot: advanced.snapshot,
        command: acceptOfferCommand(advanced.snapshot.revision, offer.id),
      });
      if (!accepted.ok)
        throw new Error(`ACCEPT_OFFER failed: ${accepted.error.code} ${accepted.error.message}`);
      return { offer, contract: accepted.snapshot.state.contract };
    }

    const female = offerAndContractFor('FEMALE');
    const male = offerAndContractFor('MALE');
    expect(male.offer).toEqual(female.offer);
    expect(male.contract).toEqual(female.contract);
  });
});

describe('simulate — ADVANCE 3단계: 제안 생성(offerRules)', () => {
  function advanceWithTags(tags: string[], baseOvr?: number) {
    let active = confirmedActiveSnapshot();
    active = withTags(active, tags);
    if (baseOvr !== undefined) active = withBaseOvr(active, baseOvr);
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, []),
    });
    return { active, result };
  }

  it('academy 분기: hangang-u18 고정 1건, YOUTH', () => {
    const { active, result } = advanceWithTags(['진로_아카데미']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.pending).toEqual({
      kind: 'OFFERS',
      offers: [expect.objectContaining({ teamId: 'hangang-u18', leagueTier: 'YOUTH' })],
      market: {
        openedAtRevision: result.snapshot.revision,
        seasonIndex: 0,
        reason: 'FIRST_CONTRACT',
        safeOfferId: null,
      },
    });
    expect(result.snapshot.checkpoint).toBe('CHAPTER_DECISION');
    expect(result.nextAction).toBe('DECISION');
    expect(result.snapshot.revision).toBe(active.revision + 1);
    // 고정 팀은 팀 추출 roll을 생략한다 → 4회(lengthSeasons·rolePromise·shirtNumber·tacticalFitEstimate).
    expect(result.snapshot.state.rngState.draws).toBe(active.state.rngState.draws + 4);
  });

  it('lower-league 분기: 풀이 desiredCount보다 작으면 풀 크기만큼만, 비복원 추출(팀 중복 없음)', () => {
    const { result } = advanceWithTags([
      '진로_하부리그',
      '입단테스트_완료',
      '에이전트_계약',
      '주목받는_유망주',
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok || result.snapshot.state.pending?.kind !== 'OFFERS') return;
    const offers = result.snapshot.state.pending.offers;
    // desiredCount는 1+2=3(상한 3)이지만 tier 2~3 풀은 2팀뿐이다.
    expect(offers).toHaveLength(2);
    expect(new Set(offers.map((o) => o.teamId)).size).toBe(2);
    expect(offers.map((o) => o.teamId).sort()).toEqual(['busan-tier2', 'daejeon-tier3']);
    expect(offers.every((o) => o.leagueTier === 2 || o.leagueTier === 3)).toBe(true);
  });

  it('tryout-fail 분기: 고정 1건, tier 3. 비고정 팀 추출은 5회 소비한다', () => {
    const { active, result } = advanceWithTags(['진로_입단테스트', '테스트_실패']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.pending).toEqual({
      kind: 'OFFERS',
      offers: [expect.objectContaining({ teamId: 'daejeon-tier3', leagueTier: 3 })],
      market: {
        openedAtRevision: result.snapshot.revision,
        seasonIndex: 0,
        reason: 'FIRST_CONTRACT',
        safeOfferId: null,
      },
    });
    expect(result.snapshot.state.rngState.draws).toBe(active.state.rngState.draws + 5);
  });

  it('tryout-neutral 분기: tier 2~3 풀에서 뽑는다', () => {
    const { result } = advanceWithTags(['진로_입단테스트', '테스트_보통']);
    expect(result.ok).toBe(true);
    if (!result.ok || result.snapshot.state.pending?.kind !== 'OFFERS') return;
    expect(result.snapshot.state.pending.offers).toHaveLength(1);
    expect(['busan-tier2', 'daejeon-tier3']).toContain(
      result.snapshot.state.pending.offers[0]!.teamId,
    );
  });

  it('tryout-success 분기: baseOvr가 topTierMinOvr(60) 이상이면 첫 제안은 tier 1 팀으로 고정된다', () => {
    const { result } = advanceWithTags(['진로_입단테스트', '테스트_성공'], 60);
    expect(result.ok).toBe(true);
    if (!result.ok || result.snapshot.state.pending?.kind !== 'OFFERS') return;
    expect(result.snapshot.state.pending.offers[0]!.teamId).toBe('seoul-tier1');
  });

  it('tryout-success 분기: baseOvr가 topTierMinOvr(60) 미만(59)이면 tier 1 강제가 없다', () => {
    // 룰셋에 tier1 팀이 하나뿐이라 "강제 없음"은 offers.test.ts에서 같은 rng seed로 비교해
    // 엄밀히 검증한다. 여기서는 매 실행마다 항상 seoul-tier1로 고정되지는 않음만 스모크로 확인한다.
    const { result } = advanceWithTags(['진로_입단테스트', '테스트_성공'], 59);
    expect(result.ok).toBe(true);
    if (!result.ok || result.snapshot.state.pending?.kind !== 'OFFERS') return;
    expect(result.snapshot.state.pending.offers).toHaveLength(1);
    expect(['busan-tier2', 'daejeon-tier3', 'seoul-tier1']).toContain(
      result.snapshot.state.pending.offers[0]!.teamId,
    );
  });

  it('tryout-skipped 분기: 미응시(입단테스트_완료 없음)면 고정 1건, tier 3', () => {
    const { result } = advanceWithTags(['진로_입단테스트']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.pending).toEqual({
      kind: 'OFFERS',
      offers: [expect.objectContaining({ teamId: 'daejeon-tier3', leagueTier: 3 })],
      market: {
        openedAtRevision: result.snapshot.revision,
        seasonIndex: 0,
        reason: 'FIRST_CONTRACT',
        safeOfferId: null,
      },
    });
  });

  it('lower-league-skipped 분기: 미응시(입단테스트_완료 없음)면 고정 1건, tier 3', () => {
    const { result } = advanceWithTags(['진로_하부리그']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.pending).toEqual({
      kind: 'OFFERS',
      offers: [expect.objectContaining({ teamId: 'daejeon-tier3', leagueTier: 3 })],
      market: {
        openedAtRevision: result.snapshot.revision,
        seasonIndex: 0,
        reason: 'FIRST_CONTRACT',
        safeOfferId: null,
      },
    });
  });

  it('일치하는 분기가 없으면 offers를 만들지 않고 다음 단계(SETTLEMENT라 NOTHING_TO_ADVANCE)로 넘어간다', () => {
    // Phase 1은 CONFIRM_PLAYER 직후 seasonPhase가 이미 SETTLEMENT다(D-7) — 4단계는 STEP_BOUNDARY
    // 대신 5단계 NOTHING_TO_ADVANCE로 떨어진다. 여기서 검증하려는 것은 "분기 불일치 시 pending을
    // 만들지 않는다"는 3단계 자체의 동작이다.
    const { result } = advanceWithTags([]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOTHING_TO_ADVANCE' });
  });

  it('이미 contract가 있으면 분기를 다시 타지 않고 SETTLEMENT라 NOTHING_TO_ADVANCE다', () => {
    const active = withTags(confirmedActiveSnapshot(), ['진로_아카데미']);
    const offered = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, []),
    });
    if (!offered.ok || offered.snapshot.state.pending?.kind !== 'OFFERS')
      throw new Error('setup failed');
    const offerId = offered.snapshot.state.pending.offers[0]!.id;
    const accepted = simulate({
      ...baseInput(),
      snapshot: offered.snapshot,
      command: acceptOfferCommand(offered.snapshot.revision, offerId),
    });
    if (!accepted.ok) throw new Error('accept failed');
    const result = simulate({
      ...baseInput(),
      snapshot: accepted.snapshot,
      command: advanceCommand(accepted.snapshot.revision, []),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOTHING_TO_ADVANCE' });
  });
});

describe('simulate — ACCEPT_OFFER', () => {
  function offeredSnapshot(tags: string[], backgroundId = 'club-academy', baseOvr?: number) {
    let active = confirmedActiveSnapshotWithBackground(backgroundId);
    active = withTags(active, tags);
    if (baseOvr !== undefined) active = withBaseOvr(active, baseOvr);
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: advanceCommand(active.revision, []),
    });
    if (!result.ok || result.snapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('offeredSnapshot 설정 실패');
    }
    return result.snapshot;
  }

  it('같은 클럽(academy) 계약: stage는 YOUTH 유지, managerTrust는 그대로다', () => {
    const offered = offeredSnapshot(['진로_아카데미'], 'street');
    const pending = offered.state.pending;
    if (pending === null || pending.kind !== 'OFFERS') throw new Error('unreachable');
    const offer = pending.offers[0]!;
    const result = simulate({
      ...baseInput(),
      snapshot: offered,
      command: acceptOfferCommand(offered.revision, offer.id),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.stage).toBe('YOUTH');
    expect(result.snapshot.state.relationships.managerTrust).toBe(35); // street 배경 초기값 유지
    expect(result.snapshot.state.context.squadStatus).toBe(
      RULESET.contractRules.squadStatusByRole[offer.rolePromise],
    );
    expect(result.snapshot.state.context.tacticalFit).toBe(offer.tacticalFitEstimate);
    expect(result.snapshot.state.contract).toEqual({
      id: `CTR-${result.snapshot.revision}`,
      offerId: offer.id,
      teamId: offer.teamId,
      teamName: offer.teamName,
      leagueTier: offer.leagueTier,
      lengthSeasons: offer.lengthSeasons,
      wageMinorPerWeek: offer.wageMinorPerWeek,
      signingBonusMinor: offer.signingBonusMinor,
      rolePromise: offer.rolePromise,
      shirtNumber: offer.shirtNumber,
      signatureType: 'AUTO',
      signedAtRevision: result.snapshot.revision,
      kind: 'PERMANENT',
      appearancePromise: offer.appearancePromise,
      positionPlan: offer.positionPlan,
      suspended: false,
      loan: null,
      promiseBreaches: 0,
      signedSeasonIndex: 1,
    });
    expect(result.snapshot.state.clubHistory).toEqual([
      {
        teamId: offer.teamId,
        teamName: offer.teamName,
        leagueTier: offer.leagueTier,
        kind: 'PERMANENT',
        fromSeasonIndex: 1,
        toSeasonIndex: null,
        endReason: null,
        contractId: result.snapshot.state.contract!.id,
      },
    ]);
    expect(result.snapshot.state.pending).toBeNull();
    expect(result.snapshot.checkpoint).toBe('CONTRACT_CONFIRMED');
    expect(result.nextAction).toBe('SETTLEMENT');
    const lastEntry = result.snapshot.state.timeline.at(-1);
    expect(lastEntry).toEqual({
      revision: result.snapshot.revision,
      kind: 'CONTRACT_SIGNED',
      refId: result.snapshot.state.contract!.id,
      age: offered.state.age,
      step: offered.state.currentStep,
    });
    // ACCEPT_OFFER는 rng를 소비하지 않는다.
    expect(result.snapshot.state.rngState.draws).toBe(offered.state.rngState.draws);
  });

  it('새 클럽 계약: stage는 PRO, managerTrust는 newClubManagerTrust로 바뀐다', () => {
    const offered = offeredSnapshot(['진로_입단테스트', '테스트_성공'], 'street', 60);
    const pending = offered.state.pending;
    if (pending === null || pending.kind !== 'OFFERS') throw new Error('unreachable');
    const offer = pending.offers[0]!;
    expect(offer.teamId).not.toBe('hangang-u18'); // street 배경의 startTeamId
    const result = simulate({
      ...baseInput(),
      snapshot: offered,
      command: acceptOfferCommand(offered.revision, offer.id),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.stage).toBe('PRO');
    expect(result.snapshot.state.relationships.managerTrust).toBe(
      RULESET.contractRules.newClubManagerTrust,
    );
  });

  it('pending이 없으면 NO_PENDING_OFFERS다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: acceptOfferCommand(active.revision, 'OFR-does-not-exist'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NO_PENDING_OFFERS' });
  });

  it('pending이 EVENT면 NO_PENDING_OFFERS다', () => {
    const active = confirmedActiveSnapshot();
    const withEvent = withPendingEvent(active);
    const result = simulate({
      ...baseInput(),
      snapshot: withEvent,
      command: acceptOfferCommand(withEvent.revision, 'OFR-x-0'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NO_PENDING_OFFERS' });
  });

  it('제안 목록에 없는 offerId는 OFFER_NOT_FOUND다', () => {
    const offered = offeredSnapshot(['진로_아카데미']);
    const result = simulate({
      ...baseInput(),
      snapshot: offered,
      command: acceptOfferCommand(offered.revision, 'OFR-not-real-9'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'OFFER_NOT_FOUND' });
  });

  it('ACTIVE가 아니면 NOT_ACTIVE다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot,
      command: acceptOfferCommand(snapshot.revision, 'OFR-x-0'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOT_ACTIVE' });
  });
});

describe('simulate — RESOLVE_ROLE (T-2-002 D-34 CMD-SIM-004)', () => {
  function startSeasonCommand(
    expectedRevision: number,
    mode: 'FAST' | 'CHAPTER' = 'CHAPTER',
  ): EngineCommand {
    return {
      type: 'START_SEASON',
      commandId: `cmd-start-${expectedRevision}`,
      expectedRevision,
      payload: { simulationMode: mode, serviceSeasonId: 'svc-simtest' },
    };
  }

  function resolveRoleCommand(
    expectedRevision: number,
    decision: 'ACCEPT' | 'DECLINE',
  ): EngineCommand {
    return {
      type: 'RESOLVE_ROLE',
      commandId: `cmd-role-${expectedRevision}`,
      expectedRevision,
      payload: { decision },
    };
  }

  /** ACTIVE + 계약 + START_SEASON까지 진행해 ROLE_PROPOSAL pending을 연 snapshot(academy 계약: hangang-u18). */
  function activeSnapshotWithRolePending(): DomainSnapshot {
    const active = confirmedActiveSnapshotWithBackground('club-academy');
    const offered = simulate({
      ...baseInput(),
      snapshot: withTags(active, ['진로_아카데미']),
      command: advanceCommand(active.revision, []),
    });
    if (!offered.ok || offered.snapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('setup: OFFERS 실패');
    }
    const offer = offered.snapshot.state.pending.offers[0]!;
    const accepted = simulate({
      ...baseInput(),
      snapshot: offered.snapshot,
      command: acceptOfferCommand(offered.snapshot.revision, offer.id),
    });
    if (!accepted.ok) throw new Error('setup: ACCEPT_OFFER 실패');
    const started = simulate({
      ...baseInput(),
      snapshot: accepted.snapshot,
      command: startSeasonCommand(accepted.snapshot.revision),
    });
    if (!started.ok || started.snapshot.state.pending?.kind !== 'ROLE_PROPOSAL') {
      throw new Error('setup: START_SEASON 실패');
    }
    return started.snapshot;
  }

  /** pending.proposal만 주어진 값으로 바꿔치기한다(resolveRole은 저장된 proposal을 그대로 신뢰해 적용한다). */
  function withRoleProposal(
    snapshot: DomainSnapshot,
    proposal: Extract<DomainSnapshot['state']['pending'], { kind: 'ROLE_PROPOSAL' }>['proposal'],
  ): DomainSnapshot {
    const pending = snapshot.state.pending;
    if (pending === null || pending.kind !== 'ROLE_PROPOSAL')
      throw new Error('withRoleProposal: ROLE_PROPOSAL pending이 아니다');
    const state = { ...snapshot.state, pending: { ...pending, proposal } };
    return { ...snapshot, state, stateHash: hashState(state) };
  }

  const TRUST_DELTAS = RULESET.selectionRules.roleProposal;

  /**
   * resolveRole이 네 분기 공통으로 재산출하는 season.selection을 테스트에서 독립적으로 재현한다.
   * `overrides`로 넘긴 값만 각 분기가 실제로 바꾸는 필드(POSITION_CHANGE의 position/tacticalFit/
   * positionProficiency, ROLE_CHANGE의 squadStatus)에 반영하고 나머지는 resolve 전 snapshot 값을
   * 그대로 쓴다.
   */
  function expectedSelectionAfter(
    before: DomainSnapshot,
    managerTrust: number,
    overrides: {
      primaryPosition?: Position;
      tacticalFit?: number;
      positionProficiency?: number;
      squadStatus?: number;
    } = {},
  ) {
    const season = before.state.season!;
    const profile = before.state.player.profile!;
    const rules = RULESET.selectionRules;
    return rankPositionForPlayer({
      ruleset: RULESET,
      styleId: season.styleId,
      position: overrides.primaryPosition ?? profile.primaryPosition,
      playerName: profile.name,
      baseOvr: profile.baseOvr,
      tacticalFit: overrides.tacticalFit ?? before.state.context.tacticalFit,
      managerTrust,
      form: before.state.state.form,
      fitness: before.state.state.fitness,
      morale: before.state.state.morale,
      familiarity: familiarityOf(
        overrides.positionProficiency ?? before.state.context.positionProficiency,
        rules,
      ),
      squadStatus: overrides.squadStatus ?? before.state.context.squadStatus,
      competitors: season.squad.competitors,
    });
  }

  describe('KEEP', () => {
    function keepSnapshot(): DomainSnapshot {
      const base = activeSnapshotWithRolePending();
      return withRoleProposal(base, { type: 'KEEP', position: 'W', squadRole: 'STARTER' });
    }

    it('ACCEPT: managerTrust += keepConfirmTrustDelta, primaryPosition은 그대로, season.selection은 새 managerTrust로 재산출된다, pending은 닫힌다', () => {
      const snapshot = keepSnapshot();
      const trustBefore = snapshot.state.relationships.managerTrust;
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const trustAfter = trustBefore + TRUST_DELTAS.keepConfirmTrustDelta;
      const expectedSelection = expectedSelectionAfter(snapshot, trustAfter);
      expect(result.snapshot.state.relationships.managerTrust).toBe(trustAfter);
      expect(result.snapshot.state.season?.selection).toEqual(expectedSelection);
      // 브리프 D-26: season.squadRole은 항상 재산출된 season.selection에서 유도된다(squadRoleFromSelection
      // 이 유일한 유도 규칙) — proposal이 들고 있던 예측값을 그대로 옮기지 않는다.
      expect(result.snapshot.state.season?.squadRole).toBe(
        squadRoleFromSelection(result.snapshot.state.season!.selection),
      );
      expect(result.snapshot.state.player.profile?.primaryPosition).toBe('W');
      expect(result.snapshot.state.pending).toBeNull();
      expect(result.snapshot.checkpoint).toBe('STEP_BOUNDARY');
      expect(result.nextAction).toBe('ADVANCE');
      const lastEntry = result.snapshot.state.timeline.at(-1);
      expect(lastEntry).toEqual({
        revision: result.snapshot.revision,
        kind: 'ROLE_RESOLVED',
        refId: 'KEEP:ACCEPT',
        age: snapshot.state.age,
        step: snapshot.state.currentStep,
      });
    });

    it('DECLINE: managerTrust += declineTrustDelta, season.selection·squadRole도 그 새 managerTrust로 재산출된다', () => {
      const snapshot = keepSnapshot();
      const trustBefore = snapshot.state.relationships.managerTrust;
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'DECLINE'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const trustAfter = trustBefore + TRUST_DELTAS.declineTrustDelta;
      const expectedSelection = expectedSelectionAfter(snapshot, trustAfter);
      expect(result.snapshot.state.relationships.managerTrust).toBe(trustAfter);
      expect(result.snapshot.state.season?.selection).toEqual(expectedSelection);
      expect(result.snapshot.state.season?.squadRole).toBe(
        squadRoleFromSelection(result.snapshot.state.season!.selection),
      );
      expect(result.snapshot.state.pending).toBeNull();
      expect(result.snapshot.state.timeline.at(-1)).toMatchObject({
        kind: 'ROLE_RESOLVED',
        refId: 'KEEP:DECLINE',
      });
    });
  });

  describe('ROLE_CHANGE', () => {
    function roleChangeSnapshot(): DomainSnapshot {
      const base = activeSnapshotWithRolePending();
      return withRoleProposal(base, {
        type: 'ROLE_CHANGE',
        position: 'W',
        from: 'STARTER',
        to: 'ROTATION',
      });
    }

    // proposal.to('ROTATION')는 제안 계산 시점의 예측값일 뿐이다 — resolveRole은 이를 season.squadRole에
    // 그대로 옮기지 않고, context.squadStatus를 그 값 기준으로 재계산한 뒤 selection을 다시 산출해
    // squadRole을 유도한다(D-26). 이 fixture는 재산출해도 PLAYER가 여전히 선발권 안이라 결과가
    // 'STARTER'다 — proposal.to를 맹신했다면 'ROTATION'이 되어 실제와 어긋났을 것이다.
    it('ACCEPT: contract.rolePromise는 그대로, season.squadRole·selection은 재산출 결과에서 나온다', () => {
      const snapshot = roleChangeSnapshot();
      const trustBefore = snapshot.state.relationships.managerTrust;
      const rolePromiseBefore = snapshot.state.contract?.rolePromise;
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const trustAfter = trustBefore + TRUST_DELTAS.acceptTrustDelta;
      const squadStatusAfter = computeSquadStatus(
        { rolePromise: 'ROTATION', captaincy: 'NONE', lastRating: null },
        RULESET.selectionRules,
        RULESET.contractRules.squadStatusByRole,
      );
      const expectedSelection = expectedSelectionAfter(snapshot, trustAfter, {
        squadStatus: squadStatusAfter,
      });
      expect(result.snapshot.state.season?.selection).toEqual(expectedSelection);
      expect(result.snapshot.state.season?.squadRole).toBe(
        squadRoleFromSelection(result.snapshot.state.season!.selection),
      );
      expect(result.snapshot.state.contract?.rolePromise).toBe(rolePromiseBefore);
      expect(result.snapshot.state.relationships.managerTrust).toBe(trustAfter);
      expect(result.snapshot.state.pending).toBeNull();
      expect(result.snapshot.state.timeline.at(-1)).toMatchObject({
        kind: 'ROLE_RESOLVED',
        refId: 'ROLE_CHANGE:ACCEPT',
      });
    });

    it('DECLINE: contract.rolePromise·context.squadStatus는 그대로, season.selection·squadRole은 declineTrustDelta 반영 재산출 결과다', () => {
      const snapshot = roleChangeSnapshot();
      const squadStatusBefore = snapshot.state.context.squadStatus;
      const trustBefore = snapshot.state.relationships.managerTrust;
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'DECLINE'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const trustAfter = trustBefore + TRUST_DELTAS.declineTrustDelta;
      const expectedSelection = expectedSelectionAfter(snapshot, trustAfter);
      expect(result.snapshot.state.context.squadStatus).toBe(squadStatusBefore);
      expect(result.snapshot.state.season?.selection).toEqual(expectedSelection);
      expect(result.snapshot.state.season?.squadRole).toBe(
        squadRoleFromSelection(result.snapshot.state.season!.selection),
      );
      expect(result.snapshot.state.relationships.managerTrust).toBe(trustAfter);
    });

    // 브리프: "ROLE_CHANGE → … context.squadStatus 재계산". context.squadStatus는 proposal.to(제안된
    // 새 역할, 여기선 ROTATION) 기준으로 재계산한다 — 재산출된 season.squadRole이 실제로 무엇이
    // 되는지와는 무관하다(재산출 결과에 맞춰 순환 계산하면 피드백 루프가 생긴다).
    it('ACCEPT: context.squadStatus는 proposal.to(ROTATION) 기준으로 재계산된다', () => {
      const snapshot = roleChangeSnapshot();
      const expected = computeSquadStatus(
        { rolePromise: 'ROTATION', captaincy: 'NONE', lastRating: null },
        RULESET.selectionRules,
        RULESET.contractRules.squadStatusByRole,
      );
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.context.squadStatus).toBe(expected);
    });
  });

  // T-7-002 D-67(이슈 #140): 룰셋 1.4.0(roleProposal.acceptedRoleUpdatesPromise === true)이면
  // ROLE_CHANGE ACCEPT가 contract.rolePromise·appearancePromise도 proposal.to로 갱신한다. 1.3.0
  // 이하(키 없음)는 계약이 그대로라 다음 경기부터 옛 rolePromise 기준으로 squadStatus가 되돌아간다
  // (운영 QA 결함 1·7 재현) — 두 룰셋을 나란히 돌려 대조한다.
  describe('T-7-002 D-67: ROLE_CHANGE ACCEPT가 계약에 남는가(룰셋 1.4.0 대 1.3.0)', () => {
    const RULESET_1_4_0 = {
      ...RULESET,
      selectionRules: {
        ...RULESET.selectionRules,
        roleProposal: { ...RULESET.selectionRules.roleProposal, acceptedRoleUpdatesPromise: true, declineDowngradeTrustDelta: 0 },
      },
    };

    /** 계약 rolePromise를 BENCH로 강제한 뒤 BENCH→ROTATION ROLE_CHANGE 제안을 얹는다. */
    function benchToRotationSnapshot(): DomainSnapshot {
      const base = activeSnapshotWithRolePending();
      const bench: DomainSnapshot = {
        ...base,
        state: { ...base.state, contract: { ...base.state.contract!, rolePromise: 'BENCH' } },
      };
      return withRoleProposal(bench, { type: 'ROLE_CHANGE', position: 'W', from: 'BENCH', to: 'ROTATION' });
    }

    it('(a) 1.4.0: ACCEPT 즉시 contract.rolePromise·appearancePromise가 ROTATION으로 갱신되고, 경기 2회 이상 지나도 유지되며 squadStatus는 ROTATION 기준으로 재계산된다', () => {
      const snapshot = benchToRotationSnapshot();
      const accepted = simulate({
        ...baseInput(),
        ruleset: RULESET_1_4_0,
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
      });
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) return;
      expect(accepted.snapshot.state.contract?.rolePromise).toBe('ROTATION');
      expect(accepted.snapshot.state.contract?.appearancePromise).toEqual({
        minutesShareBp: RULESET.contractRules.promiseMinutesShareBp.ROTATION,
      });

      // 경기 2회 이상: FAST 계약 배경(academy)은 step 7 CONTRACT 결정 전까지도 이미 여러 경기를
      // 치른다 — 한 번의 ADVANCE로 season.matches.length가 2 이상이 되는지까지 함께 고정한다.
      const advanced = simulate({
        ...baseInput(),
        ruleset: RULESET_1_4_0,
        snapshot: accepted.snapshot,
        command: advanceCommand(accepted.snapshot.revision, []),
      });
      expect(advanced.ok).toBe(true);
      if (!advanced.ok) return;
      const state = advanced.snapshot.state;
      expect(state.season?.matches.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(state.contract?.rolePromise).toBe('ROTATION');
      // match.ts의 nextSquadStatus 공식 그대로: captaincy는 항상 'NONE'(캡틴 보너스는 이 축과
      // 별개), lastRating은 마지막 경기 평점.
      const lastRatingTenths = state.season?.lastRatingTenths ?? null;
      expect(state.context.squadStatus).toBe(
        computeSquadStatus(
          { rolePromise: 'ROTATION', captaincy: 'NONE', lastRating: lastRatingTenths === null ? null : lastRatingTenths / 10 },
          RULESET.selectionRules,
          RULESET.contractRules.squadStatusByRole,
        ),
      );
    });

    it('(b) 1.3.0(키 없음): ACCEPT해도 contract.rolePromise는 BENCH 그대로다 — 경기를 치른 뒤에도 계약이 바뀌지 않는다', () => {
      const snapshot = benchToRotationSnapshot();
      const accepted = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
      });
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) return;
      expect(accepted.snapshot.state.contract?.rolePromise).toBe('BENCH');

      const advanced = simulate({
        ...baseInput(),
        snapshot: accepted.snapshot,
        command: advanceCommand(accepted.snapshot.revision, []),
      });
      expect(advanced.ok).toBe(true);
      if (!advanced.ok) return;
      expect(advanced.snapshot.state.contract?.rolePromise).toBe('BENCH');
    });
  });

  // T-7-002 D-67: 하향 제안(제안된 역할이 현재 contract.rolePromise보다 나쁜 ROLE_CHANGE) 거절은
  // 1.4.0(declineDowngradeTrustDelta 정의)이면 그 값(0)을, 1.3.0 이하(키 없음)면 기존
  // declineTrustDelta(-8)를 쓴다. 상향 제안 거절은 두 룰셋 모두 declineTrustDelta 그대로다.
  describe('T-7-002 D-67: 하향 제안 DECLINE 무벌점(룰셋 1.4.0 대 1.3.0)', () => {
    const RULESET_1_4_0 = {
      ...RULESET,
      selectionRules: {
        ...RULESET.selectionRules,
        roleProposal: { ...RULESET.selectionRules.roleProposal, acceptedRoleUpdatesPromise: true, declineDowngradeTrustDelta: 0 },
      },
    };

    /** 계약 rolePromise를 STARTER로 강제한 뒤 STARTER→BENCH(하향) ROLE_CHANGE 제안을 얹는다. */
    function downgradeProposalSnapshot(): DomainSnapshot {
      const base = activeSnapshotWithRolePending();
      const starter: DomainSnapshot = {
        ...base,
        state: { ...base.state, contract: { ...base.state.contract!, rolePromise: 'STARTER' } },
      };
      return withRoleProposal(starter, { type: 'ROLE_CHANGE', position: 'W', from: 'STARTER', to: 'BENCH' });
    }

    it('(c) 1.4.0: 하향 제안 DECLINE은 managerTrust 변화가 0이다', () => {
      const snapshot = downgradeProposalSnapshot();
      const trustBefore = snapshot.state.relationships.managerTrust;
      const result = simulate({
        ...baseInput(),
        ruleset: RULESET_1_4_0,
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'DECLINE'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.relationships.managerTrust).toBe(trustBefore);
      expect(result.snapshot.state.contract?.rolePromise).toBe('STARTER');
    });

    it('(c) 1.3.0(키 없음): 같은 하향 제안 DECLINE은 declineTrustDelta(-8)를 그대로 쓴다', () => {
      const snapshot = downgradeProposalSnapshot();
      const trustBefore = snapshot.state.relationships.managerTrust;
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'DECLINE'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.relationships.managerTrust).toBe(
        trustBefore + TRUST_DELTAS.declineTrustDelta,
      );
    });

    it('1.4.0에서도 상향 제안 DECLINE은 declineTrustDelta 그대로다(무벌점 특례는 하향에만 적용)', () => {
      // roleChangeSnapshot()과 같은 상향 시나리오(STARTER→ROTATION 제안 계산 결과가 재산출에서
      // STARTER로 되돌아가는 fixture)를 재사용하지 않고, 여기서는 contract.rolePromise='BENCH'인
      // 채로 proposal.to='ROTATION'(상향)을 얹어 isSquadRoleBetter 분기가 반대로 갈리는지 본다.
      const base = activeSnapshotWithRolePending();
      const bench: DomainSnapshot = {
        ...base,
        state: { ...base.state, contract: { ...base.state.contract!, rolePromise: 'BENCH' } },
      };
      const snapshot = withRoleProposal(bench, { type: 'ROLE_CHANGE', position: 'W', from: 'BENCH', to: 'ROTATION' });
      const trustBefore = snapshot.state.relationships.managerTrust;
      const result = simulate({
        ...baseInput(),
        ruleset: RULESET_1_4_0,
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'DECLINE'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.relationships.managerTrust).toBe(
        trustBefore + TRUST_DELTAS.declineTrustDelta,
      );
    });
  });

  describe('POSITION_CHANGE', () => {
    function positionChangeSnapshot(): DomainSnapshot {
      const base = activeSnapshotWithRolePending();
      return withRoleProposal(base, {
        type: 'POSITION_CHANGE',
        from: 'W',
        to: 'AM',
        squadRoleAfter: 'STARTER',
        tacticalFitAfter: 88,
        proficiencyAfter: RULESET.selectionRules.proficiencyOnChange.adjacent,
      });
    }

    it('ACCEPT: primaryPosition·tacticalFit·positionProficiency·season.squadRole/selection이 제안대로 바뀐다', () => {
      const snapshot = positionChangeSnapshot();
      const trustBefore = snapshot.state.relationships.managerTrust;
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.player.profile?.primaryPosition).toBe('AM');
      expect(result.snapshot.state.context.tacticalFit).toBe(88);
      expect(result.snapshot.state.context.positionProficiency).toBe(
        RULESET.selectionRules.proficiencyOnChange.adjacent,
      );
      // squadRoleAfter('STARTER')는 제안 계산 시점의 값일 뿐이다 — resolveRole은 이를 그대로 믿지
      // 않고 재산출된 selection에서 다시 유도한다(아래 "재산출된 selection에서 유도된 값과 같다"
      // 테스트 참고). AM은 이 팀 전술의 slots가 0이라 재산출 결과는 ROTATION이다.
      expect(result.snapshot.state.season?.squadRole).toBe('ROTATION');
      expect(result.snapshot.state.season?.selection.position).toBe('AM');
      expect(
        result.snapshot.state.season?.selection.candidates.some((c) => c.id === 'PLAYER'),
      ).toBe(true);
      expect(result.snapshot.state.relationships.managerTrust).toBe(
        trustBefore + TRUST_DELTAS.acceptTrustDelta,
      );
      expect(result.snapshot.state.pending).toBeNull();
      expect(result.snapshot.state.timeline.at(-1)).toMatchObject({
        kind: 'ROLE_RESOLVED',
        refId: 'POSITION_CHANGE:ACCEPT',
      });
    });

    // season.squadRole은 항상 season.selection에서 유도된 값이어야 한다(squadRoleFromSelection이
    // 그 유일한 유도 규칙이다). accept가 managerTrust를 먼저 올린 뒤 selection을 그 새 managerTrust로
    // 재산출하므로, squadRole도 그 재산출된 selection에서 다시 유도해야 둘이 어긋나지 않는다 — 제안
    // 계산 시점(managerTrust 변경 전)의 squadRoleAfter를 그대로 쓰면 어긋날 수 있다.
    it('ACCEPT: season.squadRole은 재산출된 season.selection에서 유도된 값과 같다', () => {
      const snapshot = positionChangeSnapshot();
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const season = result.snapshot.state.season!;
      expect(season.squadRole).toBe(squadRoleFromSelection(season.selection));
    });

    it('DECLINE: primaryPosition은 그대로, season.selection·squadRole은 declineTrustDelta 반영 재산출 결과다', () => {
      const snapshot = positionChangeSnapshot();
      const positionBefore = snapshot.state.player.profile?.primaryPosition;
      const trustBefore = snapshot.state.relationships.managerTrust;
      const result = simulate({
        ...baseInput(),
        snapshot,
        command: resolveRoleCommand(snapshot.revision, 'DECLINE'),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const trustAfter = trustBefore + TRUST_DELTAS.declineTrustDelta;
      const expectedSelection = expectedSelectionAfter(snapshot, trustAfter);
      expect(result.snapshot.state.player.profile?.primaryPosition).toBe(positionBefore);
      expect(result.snapshot.state.season?.selection).toEqual(expectedSelection);
      expect(result.snapshot.state.season?.squadRole).toBe(
        squadRoleFromSelection(result.snapshot.state.season!.selection),
      );
      expect(result.snapshot.state.relationships.managerTrust).toBe(trustAfter);
    });
  });

  it('ROLE_PROPOSAL pending이 없으면 NO_ROLE_PROPOSAL이다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: resolveRoleCommand(active.revision, 'ACCEPT'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NO_ROLE_PROPOSAL' });
  });

  it('pending이 EVENT면 NO_ROLE_PROPOSAL이다', () => {
    const active = confirmedActiveSnapshot();
    const withEvent = withPendingEvent(active);
    const result = simulate({
      ...baseInput(),
      snapshot: withEvent,
      command: resolveRoleCommand(withEvent.revision, 'ACCEPT'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NO_ROLE_PROPOSAL' });
  });

  it('ACTIVE가 아니면 NOT_ACTIVE다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot,
      command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOT_ACTIVE' });
  });

  it('rng를 소비하지 않는다', () => {
    const snapshot = activeSnapshotWithRolePending();
    const result = simulate({
      ...baseInput(),
      snapshot,
      command: resolveRoleCommand(snapshot.revision, 'ACCEPT'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.rngState.draws).toBe(snapshot.state.rngState.draws);
  });
});

// T-2-005 D-39, 오케스트레이터 리뷰 2차(R2-1): DEFERRED 효과가 실제로는 한 번도 적용되지 않던 버그의
// 회귀 방지. 헬퍼(resolveDeferredEffects) 단위 테스트만으로는 startSeason/advanceInSeason이 season을
// 어떻게 조립하는지까지 검증할 수 없어(리뷰 지적 그대로) simulate() 수준으로 확인한다.
describe('DEFERRED 효과: 시즌 step 배정(오케스트레이터 리뷰 2차 R2-1)', () => {
  function resolveRoleCommand(
    expectedRevision: number,
    decision: 'ACCEPT' | 'DECLINE',
  ): EngineCommand {
    return {
      type: 'RESOLVE_ROLE',
      commandId: `cmd-role-${expectedRevision}`,
      expectedRevision,
      payload: { decision },
    };
  }

  function settleSeasonCommand(expectedRevision: number): EngineCommand {
    return {
      type: 'SETTLE_SEASON',
      commandId: `cmd-settle-${expectedRevision}`,
      expectedRevision,
      payload: {},
    };
  }

  function startSeasonFastCommand(
    expectedRevision: number,
    serviceSeasonId: string,
  ): EngineCommand {
    return {
      type: 'START_SEASON',
      commandId: `cmd-start-${expectedRevision}`,
      expectedRevision,
      payload: { simulationMode: 'FAST', serviceSeasonId },
    };
  }

  /** ACTIVE + 계약(academy) 상태에서 START_SEASON 직전까지(ACCEPT_OFFER 완료) 진행한 snapshot.
   * `activeSnapshotWithRolePending`과 같은 계약 경로를 START_SEASON 직전에서 멈춘 것뿐이다. */
  function preSeasonSnapshot(): DomainSnapshot {
    const active = confirmedActiveSnapshotWithBackground('club-academy');
    const offered = simulate({
      ...baseInput(),
      snapshot: withTags(active, ['진로_아카데미']),
      command: advanceCommand(active.revision, []),
    });
    if (!offered.ok || offered.snapshot.state.pending?.kind !== 'OFFERS')
      throw new Error('setup: OFFERS 실패');
    const offer = offered.snapshot.state.pending.offers[0]!;
    const accepted = simulate({
      ...baseInput(),
      snapshot: offered.snapshot,
      command: acceptOfferCommand(offered.snapshot.revision, offer.id),
    });
    if (!accepted.ok) throw new Error('setup: ACCEPT_OFFER 실패');
    return accepted.snapshot;
  }

  function deferredEffect(step: number, sourceId: string): Effect {
    return {
      kind: 'DEFERRED',
      sourceId,
      target: 'context.tacticalFit',
      delta: 6,
      clamp: { min: 0, max: 100 },
      appliesAt: { kind: 'NEXT_SEASON_STEP', step },
      expiresAt: null,
      stackingRule: 'SUM',
    };
  }

  /** withRoleProposal과 같은 패턴: pending 값만 바꿔치기하지 않고 deferredEffects에 하나 얹는다. */
  function withDeferredEffect(snapshot: DomainSnapshot, effect: Effect): DomainSnapshot {
    const state = {
      ...snapshot.state,
      deferredEffects: [...snapshot.state.deferredEffects, effect],
    };
    return { ...snapshot, state, stateHash: hashState(state) };
  }

  /** ROLE_PROPOSAL은 ACCEPT로, 그 외 pending은 ADVANCE로 자동 통과하며 SETTLEMENT까지 몬다(FAST
   * 모드는 시즌 중 EVENT 슬롯을 열지 않는다 — RULE-TIME-003). ADVANCE 한 번이 몇 step을 건너뛰는지는
   * (CONTRACT·INJURY·NATIONAL_TEAM 같은 auto-passable 슬롯이 몇 번 여는지에) 좌우되므로 정확한
   * step 수 대신 SETTLEMENT 도달까지 반복한다 — 그래도 각 ADVANCE 안에서 지나친 모든 step은
   * advanceEffectsThroughWalk가 하나씩 접어 처리하므로(walkToNextDecision이 한 번에 여러 step을
   * 건너뛰어도) step 5를 "지나침" 자체는 정확히 일어난다. */
  function driveToSettlement(snapshot: DomainSnapshot, inputBase = baseInput()): DomainSnapshot {
    let current = snapshot;
    for (let guard = 0; guard < 100; guard++) {
      const pending = current.state.pending;
      if (pending?.kind === 'SETTLEMENT') return current;
      const command: EngineCommand =
        pending?.kind === 'ROLE_PROPOSAL'
          ? resolveRoleCommand(current.revision, 'ACCEPT')
          : advanceCommand(current.revision, []);
      if (pending?.kind === 'INJURY') {
        const result = simulate({
          ...inputBase,
          snapshot: current,
          command: resolveEventCommand(current.revision, {
            eventId: pending.eventId,
            definitionVersion: pending.version,
            rehabPlan: 'STANDARD',
            outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
          }),
        });
        if (!result.ok) throw new Error(`driveToSettlement: RESOLVE_EVENT 실패: ${result.error.code} ${result.error.message}`);
        current = result.snapshot;
        continue;
      }
      const result = simulate({ ...inputBase, snapshot: current, command });
      if (!result.ok)
        throw new Error(
          `driveToSettlement: ${command.type} 실패: ${result.error.code} ${result.error.message}`,
        );
      current = result.snapshot;
    }
    throw new Error('driveToSettlement: 100회 안에 SETTLEMENT에 이르지 못했다(무한루프 의심).');
  }

  it('(a) season 배정 전(유스 구간)에 미룬 효과가 START_SEASON에서 이번 시즌 step에 정확히 적용된다', () => {
    const preSeason = preSeasonSnapshot();
    const withDeferred = withDeferredEffect(preSeason, deferredEffect(1, 'TEST-R2-1-A'));

    const baseline = simulate({
      ...baseInput(),
      snapshot: preSeason,
      command: startSeasonFastCommand(preSeason.revision, 'svc-r2-1-a-base'),
    });
    const withEffect = simulate({
      ...baseInput(),
      snapshot: withDeferred,
      command: startSeasonFastCommand(withDeferred.revision, 'svc-r2-1-a'),
    });
    if (!baseline.ok)
      throw new Error(
        `setup: baseline START_SEASON 실패: ${baseline.error.code} ${baseline.error.message}`,
      );
    if (!withEffect.ok)
      throw new Error(
        `setup: withEffect START_SEASON 실패: ${withEffect.error.code} ${withEffect.error.message}`,
      );

    // 리뷰 (a): walk 이후 context.tacticalFit이 +6, season.scheduledEffects 비어 있음, deferredEffects 비어 있음.
    expect(withEffect.snapshot.state.context.tacticalFit).toBe(
      baseline.snapshot.state.context.tacticalFit + 6,
    );
    expect(withEffect.snapshot.state.season?.scheduledEffects).toEqual([]);
    expect(withEffect.snapshot.state.deferredEffects).toEqual([]);

    const oldAttempt = simulate({ ...baseInput(), snapshot: preSeason, command: { type: 'REQUEST_CLUB_MEETING', commandId: 'old-meeting', expectedRevision: preSeason.revision, payload: { request: 'TRANSFER' } } });
    expect(oldAttempt.ok).toBe(false);
    expect(preSeason.state.clubMeeting).toBeUndefined();
    expect(preSeason.stateHash).toBe(hashState(preSeason.state));

    const ruleset160 = ruleset160Raw as unknown as Ruleset;
    const proTeam = ruleset160.teams.find((team) => team.leagueTier === 3)!;
    const contract160 = { ...preSeason.state.contract!, teamId: proTeam.id, teamName: proTeam.name, leagueTier: 3 as const, lengthSeasons: 3, rolePromise: 'BENCH' as const, appearancePromise: { minutesShareBp: ruleset160.contractRules.promiseMinutesShareBp.BENCH } };
    const eligibleState = { ...preSeason.state, stage: 'PRO' as const, rulesetVersion: '1.6.0', relationships: { ...preSeason.state.relationships, managerTrust: 45 }, contract: contract160, clubHistory: preSeason.state.clubHistory.map((stint) => ({ ...stint, teamId: proTeam.id, teamName: proTeam.name, leagueTier: 3 as const, contractId: contract160.id })) };
    const eligible: DomainSnapshot = { ...preSeason, state: eligibleState, rulesetVersion: '1.6.0', stateHash: hashState(eligibleState) };
    const input160 = baseInput({ ruleset: ruleset160, rulesetVersion: '1.6.0' });
    const met = simulate({ ...input160, snapshot: eligible, command: { type: 'REQUEST_CLUB_MEETING', commandId: 'meeting-accept', expectedRevision: eligible.revision, payload: { request: 'PLAYING_TIME' } } });
    expect(met.ok).toBe(true);
    if (!met.ok) return;
    expect(met.snapshot.state.clubMeeting).toMatchObject({ seasonIndex: 1, response: 'ACCEPTED', plannedRole: 'ROTATION' });
    expect(met.snapshot.state.contract?.rolePromise).toBe('ROTATION');
    const duplicate = simulate({ ...input160, snapshot: met.snapshot, command: { type: 'REQUEST_CLUB_MEETING', commandId: 'meeting-duplicate', expectedRevision: met.snapshot.revision, payload: { request: 'TRANSFER' } } });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe('COMMAND_ALREADY_RESOLVED');
    const guaranteedMeeting = { ...met.snapshot.state.clubMeeting!, goal: { ...met.snapshot.state.clubMeeting!.goal, targetMinutesShareBp: 0 } };
    const guaranteedState = { ...met.snapshot.state, clubMeeting: guaranteedMeeting };
    const guaranteed: DomainSnapshot = { ...met.snapshot, state: guaranteedState, stateHash: hashState(guaranteedState) };
    const started = simulate({ ...input160, snapshot: guaranteed, command: startSeasonFastCommand(guaranteed.revision, 'svc-meeting-met') });
    if (!started.ok) throw new Error('meeting START_SEASON failed');
    const atSettlement = driveToSettlement(started.snapshot, input160);
    const settled = simulate({ ...input160, snapshot: atSettlement, command: settleSeasonCommand(atSettlement.revision) });
    if (!settled.ok) throw new Error('meeting SETTLE_SEASON failed');
    const frozen = settled.snapshot.state.seasonHistory.at(-1)!.result;
    expect(frozen.clubMeetingGoal).toMatchObject({ status: 'MET', targetMinutesShareBp: 0, effect: { managerTrustDelta: 3, moraleDelta: 2 } });
    expect(frozen.hash).toBe(hashSeasonResult(frozen));
    expect(settled.snapshot.state.state.morale).toBe(frozen.stateDeltas.morale.after);
    const refusedState = { ...eligible.state, relationships: { ...eligible.state.relationships, managerTrust: 44 } };
    const refusedSnapshot: DomainSnapshot = { ...eligible, state: refusedState, stateHash: hashState(refusedState) };
    const refused = simulate({ ...input160, snapshot: refusedSnapshot, command: { type: 'REQUEST_CLUB_MEETING', commandId: 'meeting-refused', expectedRevision: refusedSnapshot.revision, payload: { request: 'PLAYING_TIME' } } });
    if (!refused.ok) throw new Error('meeting refusal failed');
    expect(refused.snapshot.state.clubMeeting).toMatchObject({ response: 'REFUSED', immediateEffect: { managerTrustDelta: 0, moraleDelta: -1 } });
    const missedMeeting = { ...refused.snapshot.state.clubMeeting!, goal: { ...refused.snapshot.state.clubMeeting!.goal, targetMinutesShareBp: 10000 } };
    const missedState = { ...refused.snapshot.state, clubMeeting: missedMeeting };
    const missedSnapshot: DomainSnapshot = { ...refused.snapshot, state: missedState, stateHash: hashState(missedState) };
    const missedStarted = simulate({ ...input160, snapshot: missedSnapshot, command: startSeasonFastCommand(missedSnapshot.revision, 'svc-meeting-missed') });
    if (!missedStarted.ok) throw new Error('missed START failed');
    const missedAtSettlement = driveToSettlement(missedStarted.snapshot, input160);
    const missedSettled = simulate({ ...input160, snapshot: missedAtSettlement, command: settleSeasonCommand(missedAtSettlement.revision) });
    if (!missedSettled.ok) throw new Error('missed settle failed');
    expect(missedSettled.snapshot.state.seasonHistory.at(-1)!.result.clubMeetingGoal).toMatchObject({ status: 'MISSED', effect: { managerTrustDelta: 0, moraleDelta: 0 } });
  });

  it('(b) 시즌 N 중에 미룬 NEXT_SEASON_STEP 5 효과는 시즌 N에는 적용되지 않고, 시즌 N+1에서 적용된다', () => {
    const preSeason = preSeasonSnapshot();
    const season1Started = simulate({
      ...baseInput(),
      snapshot: preSeason,
      command: startSeasonFastCommand(preSeason.revision, 'svc-r2-1-b-s1'),
    });
    if (!season1Started.ok || season1Started.snapshot.state.pending?.kind !== 'ROLE_PROPOSAL') {
      throw new Error('setup: 시즌 1 START_SEASON 실패');
    }
    const season1RoleAccepted = simulate({
      ...baseInput(),
      snapshot: season1Started.snapshot,
      command: resolveRoleCommand(season1Started.snapshot.revision, 'ACCEPT'),
    });
    if (!season1RoleAccepted.ok) throw new Error('setup: 시즌 1 RESOLVE_ROLE 실패');

    // "시즌 N step 2에서 미룬다": season이 이미 배정된 뒤라 이 효과는 season.scheduledEffects가 아니라
    // state.deferredEffects로 들어간다(이번 시즌 중 새로 미루는 효과의 대기열 — season 배정 시점엔
    // 이미 지나서, 다음 START_SEASON이 옮겨줄 때까지는 어느 season에도 속하지 않는다).
    const withDeferred = withDeferredEffect(
      season1RoleAccepted.snapshot,
      deferredEffect(5, 'TEST-R2-1-B'),
    );
    const tacticalFitBeforeSeason1 = withDeferred.state.context.tacticalFit;

    const season1Settled = driveToSettlement(withDeferred);
    // 리뷰 (b) 전반부: 시즌 N step 5를 지나도 적용되지 않는다.
    expect(season1Settled.state.context.tacticalFit).toBe(tacticalFitBeforeSeason1);
    expect(season1Settled.state.season?.scheduledEffects).toEqual([]);
    expect(season1Settled.state.deferredEffects).toEqual(withDeferred.state.deferredEffects);

    const settleResult = simulate({
      ...baseInput(),
      snapshot: season1Settled,
      command: settleSeasonCommand(season1Settled.revision),
    });
    if (!settleResult.ok)
      throw new Error(
        `setup: SETTLE_SEASON 실패: ${settleResult.error.code} ${settleResult.error.message}`,
      );
    expect(settleResult.snapshot.state.deferredEffects).toEqual(withDeferred.state.deferredEffects);

    const season2Started = simulate({
      ...baseInput(),
      snapshot: settleResult.snapshot,
      command: startSeasonFastCommand(settleResult.snapshot.revision, 'svc-r2-1-b-s2'),
    });
    if (!season2Started.ok || season2Started.snapshot.state.pending?.kind !== 'ROLE_PROPOSAL') {
      throw new Error('setup: 시즌 2 START_SEASON 실패');
    }
    expect(season2Started.snapshot.state.deferredEffects).toEqual([]);
    expect(season2Started.snapshot.state.season?.scheduledEffects).toEqual(
      withDeferred.state.deferredEffects,
    );

    const season2RoleAccepted = simulate({
      ...baseInput(),
      snapshot: season2Started.snapshot,
      command: resolveRoleCommand(season2Started.snapshot.revision, 'ACCEPT'),
    });
    if (!season2RoleAccepted.ok) throw new Error('setup: 시즌 2 RESOLVE_ROLE 실패');
    const tacticalFitBeforeSeason2 = season2RoleAccepted.snapshot.state.context.tacticalFit;

    const season2Settled = driveToSettlement(season2RoleAccepted.snapshot);
    // 리뷰 (b) 후반부: 시즌 N+1 step 5에서 적용된다.
    expect(season2Settled.state.context.tacticalFit).toBe(tacticalFitBeforeSeason2 + 6);
    expect(season2Settled.state.season?.scheduledEffects).toEqual([]);
    expect(season2Settled.state.deferredEffects).toEqual([]);
  });
});

describe('Command 타입', () => {
  it('type은 Phase 5의 15개 명령으로 고정된다', () => {
    expectTypeOf<Command['type']>().toEqualTypeOf<
      | 'CREATE_CAREER'
      | 'UPDATE_PLAYER_DRAFT'
      | 'CONFIRM_PLAYER'
      | 'START_SEASON'
      | 'ADVANCE'
      | 'SETTLE_SEASON'
      | 'RESOLVE_ROLE'
      | 'RESOLVE_EVENT'
      | 'RESOLVE_CHAPTER'
      | 'ACCEPT_OFFER'
      | 'NEGOTIATE'
      | 'REJECT_OFFER'
      | 'LOAN_RETURN'
      | 'RETIRE'
      | 'CAREER_EVENT'
      | 'REQUEST_CLUB_MEETING'
    >();
  });
});

// T-3-001: NEGOTIATE·REJECT_OFFER·LOAN_RETURN은 T-3-003 전까지 처리기가 없다 — throw 없이
// VALIDATION_FAILED를 돌려주는 것으로 고정한다(브리프 "명령" 인수 조건).
describe('simulate — NEGOTIATE/REJECT_OFFER/LOAN_RETURN(T-3-003 전까지 미구현)', () => {
  it('NEGOTIATE는 throw 없이 VALIDATION_FAILED다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: {
        type: 'NEGOTIATE',
        commandId: 'cmd-negotiate-1',
        expectedRevision: active.revision,
        payload: { offerId: 'OFR-x-0', ask: 'WAGE' },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('REJECT_OFFER는 throw 없이 VALIDATION_FAILED다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: {
        type: 'REJECT_OFFER',
        commandId: 'cmd-reject-1',
        expectedRevision: active.revision,
        payload: { offerId: null },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('LOAN_RETURN은 throw 없이 VALIDATION_FAILED다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({
      ...baseInput(),
      snapshot: active,
      command: {
        type: 'LOAN_RETURN',
        commandId: 'cmd-loan-return-1',
        expectedRevision: active.revision,
        payload: { decision: 'RETURN' },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });
});

// T-4-001 D-50: START_SEASON이 buildDefaultManager로 season.manager를 채우고 injuryCount를 0으로
// 시작하는지 배선 수준에서 확인한다(buildDefaultManager 자체의 단위 테스트는 manager.test.ts).
describe('simulate — START_SEASON은 season.manager·injuryCount를 채운다(T-4-001 D-50)', () => {
  it('첫 시즌: season.manager는 룰셋 managerRules 기반 기본값이고 injuryCount는 0이다', () => {
    const active = confirmedActiveSnapshotWithBackground('club-academy');
    const offered = simulate({
      ...baseInput(),
      snapshot: withTags(active, ['진로_아카데미']),
      command: advanceCommand(active.revision, []),
    });
    if (!offered.ok || offered.snapshot.state.pending?.kind !== 'OFFERS')
      throw new Error('setup: OFFERS 실패');
    const offer = offered.snapshot.state.pending.offers[0]!;
    const accepted = simulate({
      ...baseInput(),
      snapshot: offered.snapshot,
      command: acceptOfferCommand(offered.snapshot.revision, offer.id),
    });
    if (!accepted.ok) throw new Error('setup: ACCEPT_OFFER 실패');
    const started = simulate({
      ...baseInput(),
      snapshot: accepted.snapshot,
      command: {
        type: 'START_SEASON',
        commandId: 'cmd-start-mgr',
        expectedRevision: accepted.snapshot.revision,
        payload: { simulationMode: 'FAST', serviceSeasonId: 'svc-mgr-test' },
      },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const season = started.snapshot.state.season;
    expect(season).not.toBeNull();
    expect(season?.manager).not.toBeNull();
    expect(season?.manager?.id).toBe(`${season?.teamId}-mgr-1`);
    expect(RULESET.managerRules.names).toContain(season?.manager?.name);
    expect(season?.manager?.trustBase).toBe(RULESET.managerRules.trustBase);
    // seasonHistory가 비어있는 첫 시즌이라 tenureSeasons는 1이다.
    expect(season?.manager?.tenureSeasons).toBe(1);
    expect(season?.injuryCount).toBe(0);
  });

  it('같은 팀 2번째 시즌: season.manager.tenureSeasons는 2다(managerTenureSeasons 배선)', () => {
    let settled = runSettledFixture().snapshot;
    const teamId = settled.state.contract!.teamId;
    // T-3-003 §5: 결산 뒤 계약이 관심 조건에 걸리면 시장이 자동으로 열릴 수 있다 — 그러면 안전
    // 잔류(첫 제안)를 수락하고 START_SEASON을 이어간다(pending이 남아 있으면 MARKET_OPEN으로 막힌다).
    if (settled.state.pending?.kind === 'OFFERS') {
      const offerId = settled.state.pending.offers[0]!.id;
      const accepted = simulate({
        ...baseInput(),
        snapshot: settled,
        command: acceptOfferCommand(settled.revision, offerId),
      });
      if (!accepted.ok) throw new Error('setup: 결산 후 시장 ACCEPT_OFFER 실패');
      settled = accepted.snapshot;
    }
    expect(settled.state.pending).toBeNull();

    const nextSeason = simulate({
      ...baseInput(),
      snapshot: settled,
      command: {
        type: 'START_SEASON',
        commandId: 'cmd-start-season-2',
        expectedRevision: settled.revision,
        payload: { simulationMode: 'FAST', serviceSeasonId: 'svc-season-2' },
      },
    });
    expect(nextSeason.ok).toBe(true);
    if (!nextSeason.ok) return;
    const season = nextSeason.snapshot.state.season;
    expect(season?.teamId).toBe(teamId);
    expect(season?.manager?.id).toBe(`${teamId}-mgr-1`);
    expect(season?.manager?.tenureSeasons).toBe(2);
    expect(settled.state.nextManager?.id).toBe(
      settled.state.seasonHistory.at(-1)?.result.managerId,
    );
    expect(nextSeason.snapshot.state.relationships.managerTrust).toBe(
      settled.state.relationships.managerTrust,
    );
  });

  it('예약 감독의 팀 접두사가 현재 계약 팀과 다르면 폐기하고 현재 팀 기본 감독을 쓴다', () => {
    let settled = runSettledFixture().snapshot;
    if (settled.state.pending?.kind === 'OFFERS') {
      const offerId = settled.state.pending.offers[0]!.id;
      const accepted = simulate({
        ...baseInput(),
        snapshot: settled,
        command: acceptOfferCommand(settled.revision, offerId),
      });
      if (!accepted.ok) throw new Error('setup: 결산 후 시장 ACCEPT_OFFER 실패');
      settled = accepted.snapshot;
    }
    const teamId = settled.state.contract?.teamId;
    if (teamId === undefined) throw new Error('setup: contract.teamId가 없다.');
    const staleState = {
      ...settled.state,
      nextManager: {
        id: 'stale-other-team-mgr-9',
        name: RULESET.managerRules.names[0]!,
        preferredArchetypeIds: [],
        tenureSeasons: 7,
        trustBase: RULESET.managerRules.trustBase,
      },
    };
    const staleSnapshot: DomainSnapshot = {
      ...settled,
      state: staleState,
      stateHash: hashState(staleState),
    };
    const started = simulate({
      ...baseInput(),
      snapshot: staleSnapshot,
      command: {
        type: 'START_SEASON',
        commandId: 'cmd-start-stale-manager',
        expectedRevision: staleSnapshot.revision,
        payload: { simulationMode: 'FAST', serviceSeasonId: 'svc-stale-manager' },
      },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.snapshot.state.season?.manager?.id).toBe(`${teamId}-mgr-1`);
    expect(started.snapshot.state.season?.manager?.id.startsWith(`${teamId}-mgr-`)).toBe(true);
    expect(started.snapshot.state.nextManager).toBeNull();
  });

  it('실제 교체 예약만 START_SEASON에서 trustBase로 재설정한다', () => {
    let settled = runSettledFixture().snapshot;
    if (settled.state.pending?.kind === 'OFFERS') {
      const offerId = settled.state.pending.offers[0]!.id;
      const accepted = simulate({
        ...baseInput(),
        snapshot: settled,
        command: acceptOfferCommand(settled.revision, offerId),
      });
      if (!accepted.ok) throw new Error('setup: 결산 후 시장 ACCEPT_OFFER 실패');
      settled = accepted.snapshot;
    }
    const teamId = settled.state.contract?.teamId;
    if (teamId === undefined) throw new Error('setup: contract.teamId가 없다.');
    const replacementId = `${teamId}-mgr-99`;
    const replacementState = {
      ...settled.state,
      nextManager: {
        id: replacementId,
        name: RULESET.managerRules.names[1]!,
        preferredArchetypeIds: [],
        tenureSeasons: 1,
        trustBase: RULESET.managerRules.trustBase,
      },
      relationships: { ...settled.state.relationships, managerTrust: 97 },
    };
    const replacementSnapshot: DomainSnapshot = {
      ...settled,
      state: replacementState,
      stateHash: hashState(replacementState),
    };
    const started = simulate({
      ...baseInput(),
      snapshot: replacementSnapshot,
      command: {
        type: 'START_SEASON',
        commandId: 'cmd-start-manager-replacement',
        expectedRevision: replacementSnapshot.revision,
        payload: { simulationMode: 'FAST', serviceSeasonId: 'svc-manager-replacement' },
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.snapshot.state.season?.manager?.id).toBe(replacementId);
    expect(started.snapshot.state.relationships.managerTrust).toBe(RULESET.managerRules.trustBase);
    expect(started.snapshot.state.nextManager).toBeNull();
  });
});

describe('simulate — onMatchInjury 훅 호출 지점(T-4-001 D-49)', () => {
  it('injuredOff:true 경기가 있는 시즌(career-04-gk)에서 playStepMatches가 onMatchInjury를 호출한다', () => {
    const spy = vi.spyOn(injuryModule, 'onMatchInjury');
    const recurrenceSpy = vi.spyOn(injuryModule, 'onMatchRecurrence');
    try {
      const { beforeSettlement } = runGkFixture();
      // season-stats.ts의 injuries 카운터는 정확히 match.injuredOff===true일 때만 증가한다 —
      // playStepMatches는 신규 발생이면 onMatchInjury, 복귀 창 재발이면 onMatchRecurrence를 호출한다.
      expect(beforeSettlement.playerStats.injuries).toBeGreaterThan(0);
      expect(spy.mock.calls.length + recurrenceSpy.mock.calls.length).toBe(beforeSettlement.playerStats.injuries);
    } finally {
      spy.mockRestore();
      recurrenceSpy.mockRestore();
    }
  });

  it('legacy career-04는 RESOLVE_EVENT 없이 자동 처리되는 MINOR injury를 보존한다', () => {
    const { snapshot, beforeSettlement } = runGkFixture();
    expect(beforeSettlement.playerStats.injuries).toBe(1);
    expect(snapshot.state.health.episodes).toHaveLength(1);
    expect(snapshot.state.health.episodes[0]).toMatchObject({ severity: 'MINOR', status: 'RECOVERED', rehab: 'STANDARD' });
  });
});
