import { describe, expect, it } from 'vitest';
import { applyEffects, expireAtSeasonEnd, expireEffects, resolveDeferredEffects, resolveDeferredKind } from './effects.js';
import { seedRng } from './rng.js';
import { initialSeasonPlayerStats } from './season-stats.js';
import { statGroupOf, type CareerState, type Effect, type FootballSeason } from './types.js';

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
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState: seedRng('effects-test'),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: null, gender: null, nationalityCode: null, preferredFoot: null, position: null, archetypeId: null, backgroundId: null },
      profile: null,
    },
    pending: null,
    contract: null,
    parentContract: null,
    clubHistory: [],
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

  // T-2-005 D-39, 오케스트레이터 리뷰 2차(R2-1): DEFERRED 효과는 시즌 step 번호로만 해석할 수 있으니
  // `state.deferredEffects`(season 없이 미룬 것들의 대기열)가 아니라 이번 시즌에 배정된
  // `state.season.scheduledEffects`를 읽고 쓴다. 나머지 season 필드는 이 함수가 건드리지 않으므로
  // 최소값으로 채운다.
  function baseSeason(scheduledEffects: Effect[]): FootballSeason {
    return {
      index: 1,
      serviceSeasonId: 'svc-test',
      simulationMode: 'FAST',
      calendarId: 'cal-test',
      currentStep: 1,
      phase: 'LEAGUE',
      steps: [],
      teamId: 'team-test',
      styleId: 'style-test',
      squadRole: 'ROTATION',
      squadRoleAtStart: 'ROTATION',
      trainingFocus: 'ROLE',
      competitions: [],
      schedule: [],
      matches: [],
      ageReferenceStep: 1,
      squad: { competitors: [] },
      selection: { position: 'W', slots: 1, benchSlots: 0, candidates: [], playerReason: null },
      playerStats: initialSeasonPlayerStats(statGroupOf('W')),
      availability: null,
      lastRatingTenths: null,
      yellowSuspensionCount: 0,
      matchRngState: seedRng('effects-test-season'),
      scheduledEffects,
      chapters: [],
    };
  }

  it('season이 없으면(유스 구간) no-op이다 — deferredEffects는 손대지 않는다', () => {
    const state = { ...baseState(), season: null, deferredEffects: [deferredEffect(3)] };
    const result = resolveDeferredEffects(state, 3);
    expect(result).toBe(state);
  });

  it('아직 그 step이 아니면 scheduledEffects도 값도 그대로다', () => {
    const state = { ...baseState(), season: baseSeason([deferredEffect(3)]) };
    const result = resolveDeferredEffects(state, 2);
    expect(result.season!.scheduledEffects).toEqual([deferredEffect(3)]);
    expect(result.state.fitness).toBe(state.state.fitness);
  });

  it('NEXT_SEASON_STEP 3 효과는 그 시즌 step 3에 적용되고 scheduledEffects에서 사라진다', () => {
    const state = { ...baseState(), season: baseSeason([deferredEffect(3)]) };
    const result = resolveDeferredEffects(state, 3);
    expect(result.season!.scheduledEffects).toEqual([]);
    expect(result.state.fitness).toBe(state.state.fitness + 5);
  });

  it('같은 step에 여러 개가 있어도 그 step 것만 풀리고 다른 step 것은 남는다', () => {
    const state = { ...baseState(), season: baseSeason([deferredEffect(3), deferredEffect(5)]) };
    const result = resolveDeferredEffects(state, 3);
    expect(result.season!.scheduledEffects).toEqual([deferredEffect(5)]);
    expect(result.state.fitness).toBe(state.state.fitness + 5);
  });
});

// T-2-014 D-40: 시즌 index만 있으면 되는 최소 season(effects.ts가 이 필드 외엔 안 읽는다).
function seasonWithIndex(index: number): FootballSeason {
  return {
    index,
    serviceSeasonId: 'svc-test',
    simulationMode: 'FAST',
    calendarId: 'cal-test',
    currentStep: 1,
    phase: 'LEAGUE',
    steps: [],
    teamId: 'team-test',
    styleId: 'style-test',
    squadRole: 'ROTATION',
    squadRoleAtStart: 'ROTATION',
    trainingFocus: 'ROLE',
    competitions: [],
    schedule: [],
    matches: [],
    ageReferenceStep: 1,
    squad: { competitors: [] },
    selection: { position: 'W', slots: 1, benchSlots: 0, candidates: [], playerReason: null },
    playerStats: initialSeasonPlayerStats(statGroupOf('W')),
    availability: null,
    lastRatingTenths: null,
    yellowSuspensionCount: 0,
    matchRngState: seedRng('effects-test-season-index'),
    scheduledEffects: [],
    chapters: [],
  };
}

// T-2-014 D-40 규칙 2: ONCE_PER_SEASON.
describe('ONCE_PER_SEASON', () => {
  it('같은 시즌에 두 번째 적용은 reject되고, 다음 시즌에는 다시 적용된다', () => {
    const season1 = { ...baseState(), season: seasonWithIndex(1) };
    const effect = makeEffect({
      kind: 'RELATION',
      target: 'managerTrust',
      delta: 5,
      stackingRule: 'ONCE_PER_SEASON',
      sourceId: 'EVT-SEASONAL.a.1',
    });

    const first = applyEffects(season1, [effect], { step: 1 });
    expect(first.state.relationships.managerTrust).toBe(45);
    expect(first.state.appliedSourceIds).toEqual(['season:1:EVT-SEASONAL.a.1']);

    const second = applyEffects(first.state, [effect], { step: 2 });
    expect(second.state.relationships.managerTrust).toBe(45);
    expect(second.rejected).toEqual([{ effect, reason: 'ONCE_PER_SEASON_DUPLICATE' }]);

    // seasonBoundaryReset이 `season:` 접두 항목을 지운 뒤 시즌 2로 넘어간 상태를 흉내낸다.
    const nextSeasonState = { ...second.state, appliedSourceIds: [], season: seasonWithIndex(2) };
    const third = applyEffects(nextSeasonState, [effect], { step: 1 });
    expect(third.state.relationships.managerTrust).toBe(50);
    expect(third.rejected).toEqual([]);
  });
});

// T-2-014 D-40 규칙 3: AT_SEASON_END·SEASONS_AFTER(저장 시 AT_SEASON_INDEX)·시즌 넘는 AT_STEP 강제 만료.
describe('expireAtSeasonEnd', () => {
  it('AT_SEASON_END 효과는 expireEffects(step)로는 안 지워지고 expireAtSeasonEnd로만 되돌아온다', () => {
    const state = { ...baseState(), season: seasonWithIndex(1) };
    const effect = makeEffect({
      kind: 'CURRENT',
      target: 'morale',
      delta: 8,
      stackingRule: 'SUM',
      expiresAt: { kind: 'AT_SEASON_END' },
    });
    const applied = applyEffects(state, [effect], { step: 3 }).state;
    expect(applied.state.morale).toBe(68);
    expect(applied.activeEffects).toEqual([{ ...effect, expiresAt: { kind: 'AT_SEASON_END' } }]);

    const stillActive = expireEffects(applied, 12);
    expect(stillActive.state.morale).toBe(68);
    expect(stillActive.activeEffects).toHaveLength(1);

    const expired = expireAtSeasonEnd(applied, 1);
    expect(expired.state.morale).toBe(60);
    expect(expired.activeEffects).toEqual([]);
  });

  it('SEASONS_AFTER 2는 저장 시 AT_SEASON_INDEX 3으로 치환되고, 그 시즌 결산에서만 되돌아온다', () => {
    const state = { ...baseState(), season: seasonWithIndex(1) };
    const effect = makeEffect({
      kind: 'CURRENT',
      target: 'form',
      delta: 6,
      stackingRule: 'SUM',
      expiresAt: { kind: 'SEASONS_AFTER', seasons: 2 },
    });
    const applied = applyEffects(state, [effect], { step: 3 }).state;
    expect(applied.state.form).toBe(56);
    expect(applied.activeEffects).toEqual([{ ...effect, expiresAt: { kind: 'AT_SEASON_INDEX', index: 3 } }]);

    // 아직 대상 시즌(3)이 아니면 되돌리지 않는다.
    const notYet = expireAtSeasonEnd(applied, 2);
    expect(notYet.state.form).toBe(56);
    expect(notYet.activeEffects).toHaveLength(1);

    const expired = expireAtSeasonEnd(applied, 3);
    expect(expired.state.form).toBe(50);
    expect(expired.activeEffects).toEqual([]);
  });

  // T-2-014 R2-1: AT_SEASON_INDEX 비교는 `===`가 아니라 `<=`다 — 유스 구간(season: null)에서
  // SEASONS_AFTER 0으로 적용된 효과는 AT_SEASON_INDEX 0으로 저장되는데, `===`였다면 실제 시즌 index가
  // 1부터 시작해 영원히 만료되지 않았을 것이다.
  it('유스 구간에서 SEASONS_AFTER 0으로 저장된 AT_SEASON_INDEX 0 효과는 첫 시즌 결산에서 만료된다', () => {
    const state = { ...baseState(), season: null };
    const effect = makeEffect({
      kind: 'RELATION',
      target: 'fans',
      delta: 7,
      stackingRule: 'SUM',
      expiresAt: { kind: 'SEASONS_AFTER', seasons: 0 },
    });
    const applied = applyEffects(state, [effect], { step: 1 }).state;
    expect(applied.relationships.fans).toBe(7);
    expect(applied.activeEffects).toEqual([{ ...effect, expiresAt: { kind: 'AT_SEASON_INDEX', index: 0 } }]);

    const expired = expireAtSeasonEnd(applied, 1);
    expect(expired.relationships.fans).toBe(0);
    expect(expired.activeEffects).toEqual([]);
  });

  it('시즌을 넘긴 AT_STEP은 다음 시즌 같은 step을 기다리지 않고 결산 시 강제로 되돌아온다', () => {
    const state = { ...baseState(), season: seasonWithIndex(1) };
    const effect = makeEffect({
      kind: 'CURRENT',
      target: 'fitness',
      delta: 10,
      stackingRule: 'SUM',
      expiresAt: { kind: 'STEPS_AFTER', steps: 5 },
    });
    // step 10에 적용 → AT_STEP 15로 저장되지만 이 시즌은 step 12에서 끝난다.
    const applied = applyEffects(state, [effect], { step: 10 }).state;
    expect(applied.activeEffects).toEqual([{ ...effect, expiresAt: { kind: 'AT_STEP', step: 15 } }]);

    const expired = expireAtSeasonEnd(applied, 1);
    expect(expired.state.fitness).toBe(80);
    expect(expired.activeEffects).toEqual([]);
  });

  it('REPLACE + expiresAt: 만료 시 −delta가 아니라 적용 전 원래 값(restoreTo)으로 복원한다', () => {
    const state = { ...baseState(), season: seasonWithIndex(1) };
    const effect = makeEffect({
      kind: 'CONTEXT',
      target: 'tacticalFit',
      delta: 90,
      stackingRule: 'REPLACE',
      expiresAt: { kind: 'AT_SEASON_END' },
    });
    const applied = applyEffects(state, [effect], { step: 1 }).state;
    expect(applied.context.tacticalFit).toBe(90);
    expect(applied.activeEffects).toEqual([{ ...effect, expiresAt: { kind: 'AT_SEASON_END' }, restoreTo: 58 }]);

    const expired = expireAtSeasonEnd(applied, 1);
    // −delta(90)였다면 음수로 clamp돼 0이 됐을 것이다 — restoreTo(58)로 정확히 되돌아온다.
    expect(expired.context.tacticalFit).toBe(58);
  });
});

// T-2-014 D-40 규칙 6: reasonTag는 그대로 보존된다(effects.ts가 손대지 않는 통과 필드).
describe('reasonTag', () => {
  it('applyEffects가 activeEffects·applied에 reasonTag를 그대로 남긴다', () => {
    const state = { ...baseState(), season: seasonWithIndex(1) };
    const effect = makeEffect({
      kind: 'CURRENT',
      target: 'morale',
      delta: 3,
      stackingRule: 'SUM',
      expiresAt: { kind: 'AT_SEASON_END' },
      reasonTag: 'EVT-MORALE.win',
    });
    const result = applyEffects(state, [effect], { step: 1 });
    expect(result.applied[0]?.reasonTag).toBe('EVT-MORALE.win');
    expect(result.state.activeEffects[0]?.reasonTag).toBe('EVT-MORALE.win');
  });
});
