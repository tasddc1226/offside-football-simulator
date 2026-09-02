import { describe, expect, expectTypeOf, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { compareCodePoints } from './canonical.js';
import { hashState } from './hash.js';
import { rollRange } from './roll-range.js';
import { simulate, verifySnapshot, type Command, type SimulationInput } from './simulate.js';
import type { DomainSnapshot, Effect, PlayerProfile, TimelineEntry } from './types.js';

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK = '0.1.0';
const RULESET = rulesetProto;

type EngineCommand = Command & { commandId: string; expectedRevision: number };
type CreateCareerCommand = Extract<Command, { type: 'CREATE_CAREER' }> & {
  commandId: string;
  expectedRevision: number;
};

function baseInput(overrides: Partial<SimulationInput> = {}): Omit<SimulationInput, 'command' | 'snapshot'> {
  return {
    ruleset: RULESET,
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK,
    ...overrides,
  };
}

function createCareerCommand(overrides?: { careerId?: string; seed?: string }): CreateCareerCommand {
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

const FULL_DRAFT_STEP_1 = { name: '김서준', nationalityCode: 'KR', preferredFoot: 'LEFT' as const };
const FULL_DRAFT_STEP_2 = { position: 'W' as const, archetypeId: 'inside-forward', backgroundId: 'club-academy' };

/** DRAFT: CREATE_CAREER 뒤 6개 필드를 모두 채운 snapshot(아직 CONFIRM_PLAYER 전). */
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
  return { type: 'CONFIRM_PLAYER', commandId: `cmd-confirm-${expectedRevision}`, expectedRevision, payload: {} };
}

/** ACTIVE: 김서준 draft를 CONFIRM_PLAYER까지 마친 snapshot. */
function confirmedActiveSnapshot(seed?: string): DomainSnapshot {
  const drafted = fullyDraftedSnapshot(seed);
  const result = simulate({ ...baseInput(), snapshot: drafted, command: confirmPlayerCommand(drafted.revision) });
  if (!result.ok) throw new Error(`CONFIRM_PLAYER failed: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

function advanceCommand(
  expectedRevision: number,
  eligibleEvents: Array<{ eventId: string; version: number; weight: number }> = [],
): EngineCommand {
  return { type: 'ADVANCE', commandId: `cmd-advance-${expectedRevision}`, expectedRevision, payload: { eligibleEvents } };
}

function resolveEventCommand(
  expectedRevision: number,
  overrides?: Partial<{ eventId: string; definitionVersion: number; choiceId: string; outcomes: Array<{ id: string; weight: number; effects: Effect[]; addTags?: string[] }> }>,
): EngineCommand {
  const outcomes = overrides?.outcomes ?? [
    {
      id: 'success',
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
    },
  };
}

/** ACTIVE 스냅샷에 EVT-TEST를 pending으로 올려 둔다(단일 후보라 rng를 소비하지 않는다). */
function withPendingEvent(active: DomainSnapshot): DomainSnapshot {
  const result = simulate({
    ...baseInput(),
    snapshot: active,
    command: advanceCommand(active.revision, [{ eventId: 'EVT-TEST', version: 1, weight: 10 }]),
  });
  if (!result.ok) throw new Error('withPendingEvent failed');
  return result.snapshot;
}

/** ACTIVE: 배경을 골라 CONFIRM_PLAYER까지 마친 snapshot(관계 초기값이 배경마다 다름을 이용한 테스트용). */
function confirmedActiveSnapshotWithBackground(backgroundId: string, seed?: string): DomainSnapshot {
  let snapshot = createDraftSnapshot(seed);
  const step1 = updateDraft(snapshot, FULL_DRAFT_STEP_1);
  if (!step1.ok) throw new Error('draft step1 failed');
  snapshot = step1.snapshot;
  const step2 = updateDraft(snapshot, { position: 'W', archetypeId: 'inside-forward', backgroundId });
  if (!step2.ok) throw new Error('draft step2 failed');
  const result = simulate({ ...baseInput(), snapshot: step2.snapshot, command: confirmPlayerCommand(step2.snapshot.revision) });
  if (!result.ok) throw new Error(`CONFIRM_PLAYER failed: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

/** 제안 분기 테스트용으로 offerRules 태그만 강제로 덮어쓴다(정렬·중복 없이 이미 정렬된 태그를 준다). */
function withTags(snapshot: DomainSnapshot, tags: string[]): DomainSnapshot {
  return { ...snapshot, state: { ...snapshot.state, tags: [...tags].sort(compareCodePoints) } };
}

/** baseOvr 경계 테스트용으로 player.profile.baseOvr만 강제로 덮어쓴다. */
function withBaseOvr(snapshot: DomainSnapshot, baseOvr: number): DomainSnapshot {
  const profile = snapshot.state.player.profile as PlayerProfile;
  return { ...snapshot, state: { ...snapshot.state, player: { ...snapshot.state.player, profile: { ...profile, baseOvr } } } };
}

function acceptOfferCommand(expectedRevision: number, offerId: string): EngineCommand {
  return { type: 'ACCEPT_OFFER', commandId: `cmd-accept-${expectedRevision}`, expectedRevision, payload: { offerId } };
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
    expect(result.snapshot.state.timeline).toEqual([]);
    expect(result.snapshot.state.rngState.draws).toBe(0);
    expect(Object.values(result.snapshot.state.attributes).every((v) => v === 0)).toBe(true);
    expect(result.snapshot.stateHash).toBe(hashState(result.snapshot.state));
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
    expect(result.error.details).toEqual({ field: 'archetypeId', reason: 'ARCHETYPE_POSITION_MISMATCH' });
  });

  it('현재 저장된 position 기준으로 archetype만 바꿔도 불일치를 잡는다', () => {
    const snapshot = createDraftSnapshot();
    const withPosition = updateDraft(snapshot, { position: 'ST' });
    expect(withPosition.ok).toBe(true);
    if (!withPosition.ok) return;
    const result = updateDraft(withPosition.snapshot, { archetypeId: 'inside-forward' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: 'archetypeId', reason: 'ARCHETYPE_POSITION_MISMATCH' });
  });
});

describe('simulate — CONFIRM_PLAYER', () => {
  it('draft 필드가 비어 있으면 missing 목록과 함께 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({ ...baseInput(), snapshot, command: confirmPlayerCommand(snapshot.revision) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({
      missing: ['name', 'nationalityCode', 'preferredFoot', 'position', 'archetypeId', 'backgroundId'],
    });
  });

  it('DRAFT가 아닌 상태에서는 VALIDATION_FAILED다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({ ...baseInput(), snapshot: active, command: confirmPlayerCommand(active.revision) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOT_DRAFT' });
  });

  it('rng를 정확히 23회 소비하고 status·currentStep·seasonPhase를 확정한다', () => {
    const drafted = fullyDraftedSnapshot();
    const result = simulate({ ...baseInput(), snapshot: drafted, command: confirmPlayerCommand(drafted.revision) });
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
    expect(active.state.context).toEqual({ tacticalFit: 58, squadStatus: 40, positionProficiency: 100 });
    expect(active.state.relationships).toEqual({ managerTrust: 40, captain: 50, rival: 50, fans: 50, agent: 50 });
  });

  it('CAREER_CONFIRMED 타임라인 항목을 남긴다', () => {
    const active = confirmedActiveSnapshot();
    expect(active.state.timeline).toEqual([
      { revision: active.revision, kind: 'CAREER_CONFIRMED', refId: null, age: 17, step: 12 } satisfies TimelineEntry,
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
    const result = simulate({ ...baseInput(), snapshot, command: advanceCommand(snapshot.revision) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('DRAFT 상태에서 RESOLVE_EVENT는 VALIDATION_FAILED다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({ ...baseInput(), snapshot, command: resolveEventCommand(snapshot.revision) });
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
      const result = simulate({ ...baseInput(), snapshot: active, command: advanceCommand(active.revision, events) });
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
      expect(atBoundary.snapshot.state.pending).toEqual({ kind: 'EVENT', eventId: 'EVT-A', version: 1 });
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
      expect(pastBoundary.snapshot.state.pending).toEqual({ kind: 'EVENT', eventId: 'EVT-B', version: 1 });
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
    const result = simulate({ ...baseInput(), snapshot: withPending, command: advanceCommand(withPending.revision) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'PENDING_DECISION' });
  });

  it('eligibleEvents가 비어 있고 SETTLEMENT면 NOTHING_TO_ADVANCE다', () => {
    const active = confirmedActiveSnapshot();
    const result = simulate({ ...baseInput(), snapshot: active, command: advanceCommand(active.revision, []) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOTHING_TO_ADVANCE' });
  });

  it('ACTIVE가 아니면 NOT_ACTIVE로 거부한다', () => {
    const snapshot = createDraftSnapshot();
    const result = simulate({ ...baseInput(), snapshot, command: advanceCommand(snapshot.revision) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOT_ACTIVE' });
  });
});

describe('simulate — RESOLVE_EVENT', () => {
  it('pending과 일치하면 roll 하나로 outcome을 고르고 pending을 비운다', () => {
    const active = confirmedActiveSnapshot();
    const pending = withPendingEvent(active);
    const result = simulate({ ...baseInput(), snapshot: pending, command: resolveEventCommand(pending.revision) });
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
    const result = simulate({ ...baseInput(), snapshot: active, command: resolveEventCommand(active.revision) });
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
      state: { ...active.state, attributes: { ...active.state.attributes, shooting: active.state.attributes.shooting + 1 } },
    };
    const result = verifySnapshot(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('STATE_HASH_MISMATCH');
  });

  it('timeline revision이 단조 증가하지 않으면 실패한다', () => {
    const active = confirmedActiveSnapshot();
    const badTimeline = [...active.state.timeline, { ...active.state.timeline[0]!, revision: active.state.timeline[0]!.revision }];
    const tampered: DomainSnapshot = { ...active, state: { ...active.state, timeline: badTimeline } };
    const rehashed: DomainSnapshot = { ...tampered, stateHash: hashState(tampered.state) };
    expect(verifySnapshot(rehashed)).toEqual({ ok: false, reason: 'TIMELINE_NOT_MONOTONIC' });
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

  it('contract와 pending이 둘 다 있으면 정합성 위반이다', () => {
    const active = withTags(confirmedActiveSnapshot(), ['진로_아카데미']);
    const offered = simulate({ ...baseInput(), snapshot: active, command: advanceCommand(active.revision, []) });
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
        },
      },
    };
    const rehashed: DomainSnapshot = { ...tampered, stateHash: hashState(tampered.state) };
    expect(verifySnapshot(rehashed)).toEqual({ ok: false, reason: 'CONTRACT_PENDING_CONFLICT' });
  });
});

describe('결정론', () => {
  it('명령 순서를 바꾸면 hash가 달라진다', () => {
    const active = confirmedActiveSnapshot();

    function makeResolveCommand(eventId: string, effect: Effect, expectedRevision: number): EngineCommand {
      return {
        type: 'RESOLVE_EVENT',
        commandId: `cmd-${eventId}`,
        expectedRevision,
        payload: { eventId, definitionVersion: 1, choiceId: 'a', outcomes: [{ id: '1', weight: 1, effects: [effect] }] },
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

describe('simulate — ADVANCE 3단계: 제안 생성(offerRules)', () => {
  function advanceWithTags(tags: string[], baseOvr?: number) {
    let active = confirmedActiveSnapshot();
    active = withTags(active, tags);
    if (baseOvr !== undefined) active = withBaseOvr(active, baseOvr);
    const result = simulate({ ...baseInput(), snapshot: active, command: advanceCommand(active.revision, []) });
    return { active, result };
  }

  it('academy 분기: hangang-u18 고정 1건, YOUTH', () => {
    const { active, result } = advanceWithTags(['진로_아카데미']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.pending).toEqual({
      kind: 'OFFERS',
      offers: [expect.objectContaining({ teamId: 'hangang-u18', leagueTier: 'YOUTH' })],
    });
    expect(result.snapshot.checkpoint).toBe('CHAPTER_DECISION');
    expect(result.nextAction).toBe('DECISION');
    expect(result.snapshot.revision).toBe(active.revision + 1);
    // 고정 팀은 팀 추출 roll을 생략한다 → 4회(lengthSeasons·rolePromise·shirtNumber·tacticalFitEstimate).
    expect(result.snapshot.state.rngState.draws).toBe(active.state.rngState.draws + 4);
  });

  it('lower-league 분기: 풀이 desiredCount보다 작으면 풀 크기만큼만, 비복원 추출(팀 중복 없음)', () => {
    const { result } = advanceWithTags(['진로_하부리그', '입단테스트_완료', '에이전트_계약', '주목받는_유망주']);
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
    });
    expect(result.snapshot.state.rngState.draws).toBe(active.state.rngState.draws + 5);
  });

  it('tryout-neutral 분기: tier 2~3 풀에서 뽑는다', () => {
    const { result } = advanceWithTags(['진로_입단테스트', '테스트_보통']);
    expect(result.ok).toBe(true);
    if (!result.ok || result.snapshot.state.pending?.kind !== 'OFFERS') return;
    expect(result.snapshot.state.pending.offers).toHaveLength(1);
    expect(['busan-tier2', 'daejeon-tier3']).toContain(result.snapshot.state.pending.offers[0]!.teamId);
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
    expect(['busan-tier2', 'daejeon-tier3', 'seoul-tier1']).toContain(result.snapshot.state.pending.offers[0]!.teamId);
  });

  it('tryout-skipped 분기: 미응시(입단테스트_완료 없음)면 고정 1건, tier 3', () => {
    const { result } = advanceWithTags(['진로_입단테스트']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.pending).toEqual({
      kind: 'OFFERS',
      offers: [expect.objectContaining({ teamId: 'daejeon-tier3', leagueTier: 3 })],
    });
  });

  it('lower-league-skipped 분기: 미응시(입단테스트_완료 없음)면 고정 1건, tier 3', () => {
    const { result } = advanceWithTags(['진로_하부리그']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.pending).toEqual({
      kind: 'OFFERS',
      offers: [expect.objectContaining({ teamId: 'daejeon-tier3', leagueTier: 3 })],
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
    const offered = simulate({ ...baseInput(), snapshot: active, command: advanceCommand(active.revision, []) });
    if (!offered.ok || offered.snapshot.state.pending?.kind !== 'OFFERS') throw new Error('setup failed');
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
    const result = simulate({ ...baseInput(), snapshot: active, command: advanceCommand(active.revision, []) });
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
    expect(result.snapshot.state.context.squadStatus).toBe(RULESET.contractRules.squadStatusByRole[offer.rolePromise]);
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
    });
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
    expect(result.snapshot.state.relationships.managerTrust).toBe(RULESET.contractRules.newClubManagerTrust);
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

describe('Command 타입', () => {
  it('type은 6개 명령으로 고정된다', () => {
    expectTypeOf<Command['type']>().toEqualTypeOf<
      'CREATE_CAREER' | 'UPDATE_PLAYER_DRAFT' | 'CONFIRM_PLAYER' | 'ADVANCE' | 'RESOLVE_EVENT' | 'ACCEPT_OFFER'
    >();
  });
});
