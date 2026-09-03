import { describe, expect, it } from 'vitest';
import { applyEffects, expireEffects, resolveDeferredEffects, resolveDeferredKind } from './effects.js';
import { seedRng } from './rng.js';
import type { CareerState, Effect } from './types.js';

function baseState(): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_test',
    status: 'ACTIVE',
    stage: 'YOUTH',
    age: 17,
    currentStep: 1,
    seasonPhase: 'PRESEASON',
    simulationMode: 'CHAPTER',
    attributes: {
      shooting: 52,
      passing: 54,
      dribbling: 66,
      tackling: 30,
      firstTouch: 62,
      crossing: 45,
      goalkeeping: 1,
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
    },
    growthCarryCenti: {
      shooting: 0,
      passing: 0,
      dribbling: 0,
      tackling: 0,
      firstTouch: 0,
      crossing: 0,
      goalkeeping: 0,
      pace: 0,
      acceleration: 0,
      agility: 0,
      jumping: 0,
      stamina: 0,
      strength: 0,
      durability: 0,
      decisions: 0,
      concentration: 0,
      composure: 0,
      positioning: 0,
      leadership: 0,
      consistency: 0,
    },
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 58, squadStatus: 40, positionProficiency: 100 },
    relationships: { managerTrust: 40, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    rngState: seedRng('effects-test'),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: null, gender: null, nationalityCode: null, preferredFoot: null, position: null, archetypeId: null, backgroundId: null },
      profile: null,
    },
    pending: null,
    contract: null,
    timeline: [],
    season: null,
    seasonHistory: [],
  };
}

function makeEffect(overrides: Partial<Effect>): Effect {
  return {
    kind: 'PERMANENT',
    sourceId: 'EVT-TEST.A.1',
    target: 'shooting',
    delta: 1,
    clamp: { min: 0, max: 99 },
    appliesAt: { kind: 'IMMEDIATE' },
    expiresAt: null,
    stackingRule: 'SUM',
    ...overrides,
  };
}

describe('applyEffects', () => {
  it('PERMANENT은 attributes를 바꾼다', () => {
    const state = baseState();
    const effect = makeEffect({ kind: 'PERMANENT', target: 'shooting', delta: 2, stackingRule: 'SUM' });
    const result = applyEffects(state, [effect], { step: 1 });
    expect(result.state.attributes.shooting).toBe(54);
    expect(result.applied).toEqual([effect]);
    expect(result.rejected).toEqual([]);
  });

  it('RELATION이 attributes를 바꾸지 못한다', () => {
    const state = baseState();
    const effect = makeEffect({ kind: 'RELATION', target: 'shooting', delta: 5, stackingRule: 'SUM' });
    const result = applyEffects(state, [effect], { step: 1 });
    expect(result.state.attributes.shooting).toBe(state.attributes.shooting);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.effect).toBe(effect);
  });

  it('CONTEXT가 attributes를 바꾸지 못한다', () => {
    const state = baseState();
    const effect = makeEffect({ kind: 'CONTEXT', target: 'shooting', delta: 5, stackingRule: 'SUM' });
    const result = applyEffects(state, [effect], { step: 1 });
    expect(result.state.attributes.shooting).toBe(state.attributes.shooting);
    expect(result.rejected).toHaveLength(1);
  });

  it('ONCE_PER_SOURCE는 두 번째 적용이 reject된다', () => {
    const state = baseState();
    const effect = makeEffect({
      kind: 'RELATION',
      target: 'managerTrust',
      delta: 5,
      stackingRule: 'ONCE_PER_SOURCE',
      sourceId: 'EVT-P01.A.success',
    });
    const first = applyEffects(state, [effect], { step: 1 });
    expect(first.state.relationships.managerTrust).toBe(45);
    expect(first.applied).toHaveLength(1);

    const second = applyEffects(first.state, [effect], { step: 1 });
    expect(second.state.relationships.managerTrust).toBe(45);
    expect(second.rejected).toEqual([{ effect, reason: 'ONCE_PER_SOURCE_DUPLICATE' }]);
  });

  it('REPLACE는 대입하고 SUM은 합산한다', () => {
    const state = baseState();
    const replaceEffect = makeEffect({
      kind: 'CONTEXT',
      target: 'tacticalFit',
      delta: 72,
      stackingRule: 'REPLACE',
      sourceId: 'EVT-A.a.1',
    });
    const sumEffect = makeEffect({
      kind: 'CONTEXT',
      target: 'squadStatus',
      delta: 10,
      stackingRule: 'SUM',
      sourceId: 'EVT-A.a.2',
    });
    const result = applyEffects(state, [replaceEffect, sumEffect], { step: 1 });
    expect(result.state.context.tacticalFit).toBe(72);
    expect(result.state.context.squadStatus).toBe(50);
  });

  it('clamp 상한·하한을 자른다', () => {
    const state = baseState();
    const upper = makeEffect({ kind: 'PERMANENT', target: 'shooting', delta: 100, stackingRule: 'SUM' });
    const lower = makeEffect({
      kind: 'PERMANENT',
      target: 'tackling',
      delta: -100,
      stackingRule: 'SUM',
      sourceId: 'EVT-B.a.1',
    });
    const result = applyEffects(state, [upper, lower], { step: 1 });
    expect(result.state.attributes.shooting).toBe(99);
    expect(result.state.attributes.tackling).toBe(0);
  });

  it('DEFERRED는 deferredEffects에만 들어간다', () => {
    const state = baseState();
    const effect = makeEffect({
      kind: 'DEFERRED',
      target: 'tacticalFit',
      delta: 4,
      stackingRule: 'SUM',
      appliesAt: { kind: 'NEXT_SEASON_STEP', step: 1 },
    });
    const result = applyEffects(state, [effect], { step: 12 });
    expect(result.state.context.tacticalFit).toBe(state.context.tacticalFit);
    expect(result.state.deferredEffects).toEqual([effect]);
    expect(result.applied).toEqual([effect]);
  });

  it('STEPS_AFTER: 2가 두 step 뒤 되돌아온다', () => {
    const state = baseState();
    const effect = makeEffect({
      kind: 'CURRENT',
      target: 'fitness',
      delta: 10,
      stackingRule: 'SUM',
      expiresAt: { kind: 'STEPS_AFTER', steps: 2 },
    });
    const afterApply = applyEffects(state, [effect], { step: 4 });
    expect(afterApply.state.state.fitness).toBe(90);
    expect(afterApply.state.activeEffects).toEqual([{ ...effect, expiresAt: { kind: 'AT_STEP', step: 6 } }]);

    const stillActive = expireEffects(afterApply.state, 5);
    expect(stillActive.state.fitness).toBe(90);
    expect(stillActive.activeEffects).toHaveLength(1);

    const expired = expireEffects(afterApply.state, 6);
    expect(expired.state.fitness).toBe(80);
    expect(expired.activeEffects).toEqual([]);
  });

  it('입력 상태 객체를 바꾸지 않는다', () => {
    const state = baseState();
    const snapshot = baseState();
    applyEffects(state, [makeEffect({ delta: 5, stackingRule: 'SUM' })], { step: 1 });
    expect(state).toEqual(snapshot);
  });
});

describe('resolveDeferredKind', () => {
  it('state.* → CURRENT, relationships.* → RELATION, context.* → CONTEXT, 그 외 → PERMANENT', () => {
    expect(resolveDeferredKind('state.fitness')).toEqual({ kind: 'CURRENT', target: 'fitness' });
    expect(resolveDeferredKind('relationships.fans')).toEqual({ kind: 'RELATION', target: 'fans' });
    expect(resolveDeferredKind('context.tacticalFit')).toEqual({ kind: 'CONTEXT', target: 'tacticalFit' });
    expect(resolveDeferredKind('shooting')).toEqual({ kind: 'PERMANENT', target: 'shooting' });
  });
});

describe('resolveDeferredEffects', () => {
  function deferredEffect(step: number): Effect {
    return makeEffect({
      kind: 'DEFERRED',
      target: 'state.fitness',
      delta: 5,
      clamp: { min: 0, max: 100 },
      stackingRule: 'SUM',
      sourceId: 'EVT-DEFERRED.a.1',
      appliesAt: { kind: 'NEXT_SEASON_STEP', step },
    });
  }

  it('아직 그 step이 아니면 deferredEffects도 값도 그대로다', () => {
    const state = { ...baseState(), deferredEffects: [deferredEffect(3)] };
    const result = resolveDeferredEffects(state, 2);
    expect(result.deferredEffects).toEqual([deferredEffect(3)]);
    expect(result.state.fitness).toBe(state.state.fitness);
  });

  it('NEXT_SEASON_STEP 3 효과는 다음 시즌 step 3에 적용되고 deferredEffects에서 사라진다', () => {
    const state = { ...baseState(), deferredEffects: [deferredEffect(3)] };
    const result = resolveDeferredEffects(state, 3);
    expect(result.deferredEffects).toEqual([]);
    expect(result.state.fitness).toBe(state.state.fitness + 5);
  });

  it('같은 step에 여러 개가 있어도 그 step 것만 풀리고 다른 step 것은 남는다', () => {
    const state = { ...baseState(), deferredEffects: [deferredEffect(3), deferredEffect(5)] };
    const result = resolveDeferredEffects(state, 3);
    expect(result.deferredEffects).toEqual([deferredEffect(5)]);
    expect(result.state.fitness).toBe(state.state.fitness + 5);
  });
});
