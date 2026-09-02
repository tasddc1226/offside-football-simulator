import { describe, expect, it } from 'vitest';
import { hashState } from './hash.js';
import { simulate, verifySnapshot, type Command } from './simulate.js';
import type { AttributeKey, DomainSnapshot, Effect } from './types.js';

const RULESET = '1.0.0';
const CONTENT_PACK = '0.1.0';

function makeAttributes(): Record<AttributeKey, number> {
  return {
    shooting: 60,
    passing: 54,
    dribbling: 66,
    tackling: 30,
    firstTouch: 62,
    crossing: 45,
    goalkeeping: 10,
    pace: 68,
    acceleration: 70,
    agility: 64,
    jumping: 50,
    stamina: 55,
    strength: 42,
    durability: 60,
    decisions: 52,
    concentration: 48,
    composure: 52,
    positioning: 60,
    leadership: 35,
    consistency: 45,
  };
}

function createCareerCommand(): Extract<Command, { type: 'CREATE_CAREER' }> & {
  commandId: string;
  expectedRevision: number;
} {
  return {
    type: 'CREATE_CAREER',
    commandId: 'cmd-create',
    expectedRevision: 0,
    payload: {
      careerId: 'car_test',
      seed: 'simulate-test-seed',
      stage: 'YOUTH',
      age: 17,
      attributes: makeAttributes(),
      state: { form: 50, fitness: 80, morale: 60 },
      context: { tacticalFit: 58, squadStatus: 40, positionProficiency: 100 },
      relationships: { managerTrust: 40, captain: 50, rival: 50, fans: 50, agent: 50 },
      simulationMode: 'CHAPTER',
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    },
  };
}

function createCareerSnapshot(): DomainSnapshot {
  const result = simulate({
    snapshot: null,
    command: createCareerCommand(),
    rulesetVersion: RULESET,
    contentPackVersion: CONTENT_PACK,
  });
  if (!result.ok) throw new Error('setup failed');
  return result.snapshot;
}

describe('simulate — CREATE_CAREER', () => {
  it('첫 Snapshot을 revision 1로 만든다', () => {
    const result = simulate({
      snapshot: null,
      command: createCareerCommand(),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.revision).toBe(1);
    expect(result.snapshot.checkpoint).toBe('CAREER_CREATED');
    expect(result.snapshot.state.status).toBe('ACTIVE');
    expect(result.snapshot.stateHash).toBe(hashState(result.snapshot.state));
  });

  it('버전 불일치는 VERSION_MISMATCH다', () => {
    const command = createCareerCommand();
    command.payload.rulesetVersion = '9.9.9';
    const result = simulate({ snapshot: null, command, rulesetVersion: RULESET, contentPackVersion: CONTENT_PACK });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VERSION_MISMATCH');
  });

  it('기존 snapshot이 있으면 VALIDATION_FAILED다', () => {
    const snapshot = createCareerSnapshot();
    const result = simulate({
      snapshot,
      command: createCareerCommand(),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('simulate — RESOLVE_EVENT', () => {
  function resolveCommand(
    overrides?: { commandId?: string; expectedRevision?: number },
  ): Command & { commandId: string; expectedRevision: number } {
    const outcomes = [
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
      commandId: 'cmd-resolve',
      expectedRevision: 1,
      payload: { eventId: 'EVT-TEST', definitionVersion: 1, choiceId: 'A', outcomes },
      ...overrides,
    };
  }

  it('roll 하나로 outcome을 고르고 revision을 올린다', () => {
    const snapshot = createCareerSnapshot();
    const result = simulate({
      snapshot,
      command: resolveCommand(),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.revision).toBe(2);
    expect(result.snapshot.checkpoint).toBe('EVENT_RESOLVED');
    expect(['success', 'neutral']).toContain(result.outcomeId);
    expect(typeof result.roll).toBe('number');
    expect(result.snapshot.state.resolvedEventIds).toEqual(['EVT-TEST']);
    expect(result.snapshot.state.rngState.draws).toBe(snapshot.state.rngState.draws + 1);
  });

  it('같은 eventId 재제출은 COMMAND_ALREADY_RESOLVED다', () => {
    const snapshot = createCareerSnapshot();
    const first = simulate({
      snapshot,
      command: resolveCommand(),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = simulate({
      snapshot: first.snapshot,
      command: resolveCommand({ expectedRevision: 2 }),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('COMMAND_ALREADY_RESOLVED');
  });

  it('revision 불일치는 CAREER_REVISION_CONFLICT다', () => {
    const snapshot = createCareerSnapshot();
    const result = simulate({
      snapshot,
      command: resolveCommand({ expectedRevision: 99 }),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CAREER_REVISION_CONFLICT');
  });

  it('RETIRED 상태에서는 VALIDATION_FAILED다', () => {
    const snapshot = createCareerSnapshot();
    const retiredSnapshot: DomainSnapshot = {
      ...snapshot,
      state: { ...snapshot.state, status: 'RETIRED' },
    };
    const result = simulate({
      snapshot: retiredSnapshot,
      command: resolveCommand(),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('outcome 가중치 합이 정수가 아니면 throw하지 않고 VALIDATION_FAILED를 돌려준다', () => {
    const snapshot = createCareerSnapshot();
    const command = resolveCommand();
    if (command.type !== 'RESOLVE_EVENT') throw new Error('unreachable');
    command.payload.outcomes[0]!.weight = 33.3;
    expect(() =>
      simulate({ snapshot, command, rulesetVersion: RULESET, contentPackVersion: CONTENT_PACK }),
    ).not.toThrow();
    const result = simulate({ snapshot, command, rulesetVersion: RULESET, contentPackVersion: CONTENT_PACK });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('outcome 가중치 합이 2^32를 넘으면 throw하지 않고 VALIDATION_FAILED를 돌려준다', () => {
    const snapshot = createCareerSnapshot();
    const command = resolveCommand();
    if (command.type !== 'RESOLVE_EVENT') throw new Error('unreachable');
    command.payload.outcomes[0]!.weight = 0x100000000;
    expect(() =>
      simulate({ snapshot, command, rulesetVersion: RULESET, contentPackVersion: CONTENT_PACK }),
    ).not.toThrow();
    const result = simulate({ snapshot, command, rulesetVersion: RULESET, contentPackVersion: CONTENT_PACK });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('simulate — ADVANCE_STEP', () => {
  const advanceCommand = (expectedRevision: number): Command & { commandId: string; expectedRevision: number } => ({
    type: 'ADVANCE_STEP',
    commandId: 'cmd-advance',
    expectedRevision,
    payload: {},
  });

  it('currentStep을 1 늘리고 nextAction을 DECISION으로 돌려준다', () => {
    const snapshot = createCareerSnapshot();
    const result = simulate({
      snapshot,
      command: advanceCommand(1),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.state.currentStep).toBe(1);
    expect(result.snapshot.checkpoint).toBe('STEP_BOUNDARY');
    expect(result.nextAction).toBe('DECISION');
  });

  it('step 12에서는 VALIDATION_FAILED다', () => {
    let snapshot = createCareerSnapshot();
    for (let i = 1; i <= 12; i++) {
      const result = simulate({
        snapshot,
        command: advanceCommand(snapshot.revision),
        rulesetVersion: RULESET,
        contentPackVersion: CONTENT_PACK,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      snapshot = result.snapshot;
    }
    expect(snapshot.state.currentStep).toBe(12);

    const overStep = simulate({
      snapshot,
      command: advanceCommand(snapshot.revision),
      rulesetVersion: RULESET,
      contentPackVersion: CONTENT_PACK,
    });
    expect(overStep.ok).toBe(false);
    if (overStep.ok) return;
    expect(overStep.error.code).toBe('VALIDATION_FAILED');
  });

  it('step 12에 도달하면 nextAction은 SETTLEMENT다', () => {
    let snapshot = createCareerSnapshot();
    let lastResult;
    for (let i = 1; i <= 12; i++) {
      lastResult = simulate({
        snapshot,
        command: advanceCommand(snapshot.revision),
        rulesetVersion: RULESET,
        contentPackVersion: CONTENT_PACK,
      });
      expect(lastResult.ok).toBe(true);
      if (!lastResult.ok) return;
      snapshot = lastResult.snapshot;
    }
    expect(lastResult?.ok).toBe(true);
    if (!lastResult?.ok) return;
    expect(lastResult.nextAction).toBe('SETTLEMENT');
  });

  it('currentStep은 절대 감소하지 않는다(property)', () => {
    let snapshot = createCareerSnapshot();
    let previousStep = snapshot.state.currentStep;
    for (let i = 0; i < 11; i++) {
      const result = simulate({
        snapshot,
        command: advanceCommand(snapshot.revision),
        rulesetVersion: RULESET,
        contentPackVersion: CONTENT_PACK,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.currentStep).toBeGreaterThanOrEqual(previousStep);
      previousStep = result.snapshot.state.currentStep;
      snapshot = result.snapshot;
    }
  });
});

describe('verifySnapshot', () => {
  it('정상 snapshot은 ok다', () => {
    const snapshot = createCareerSnapshot();
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('state.attributes.shooting을 +1 하면 변조를 감지한다', () => {
    const snapshot = createCareerSnapshot();
    const tampered: DomainSnapshot = {
      ...snapshot,
      state: { ...snapshot.state, attributes: { ...snapshot.state.attributes, shooting: snapshot.state.attributes.shooting + 1 } },
    };
    const result = verifySnapshot(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('STATE_HASH_MISMATCH');
  });
});

describe('결정론', () => {
  it('명령 순서를 바꾸면 hash가 달라진다', () => {
    const snapshot = createCareerSnapshot();

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

    function makeResolveCommand(
      eventId: string,
      effect: Effect,
      expectedRevision: number,
    ): Command & { commandId: string; expectedRevision: number } {
      return {
        type: 'RESOLVE_EVENT',
        commandId: `cmd-${eventId}`,
        expectedRevision,
        payload: { eventId, definitionVersion: 1, choiceId: 'a', outcomes: [{ id: '1', weight: 1, effects: [effect] }] },
      };
    }

    function run(first: [string, Effect], second: [string, Effect]): string {
      const step1 = simulate({
        snapshot,
        command: makeResolveCommand(first[0], first[1], 1),
        rulesetVersion: RULESET,
        contentPackVersion: CONTENT_PACK,
      });
      if (!step1.ok) throw new Error('step1 failed');
      const step2 = simulate({
        snapshot: step1.snapshot,
        command: makeResolveCommand(second[0], second[1], 2),
        rulesetVersion: RULESET,
        contentPackVersion: CONTENT_PACK,
      });
      if (!step2.ok) throw new Error('step2 failed');
      return step2.snapshot.stateHash;
    }

    const hashXThenY = run(['EVT-X', effectA], ['EVT-Y', effectB]);
    const hashYThenX = run(['EVT-Y', effectB], ['EVT-X', effectA]);
    expect(hashXThenY).not.toBe(hashYThenX);
  });
});
