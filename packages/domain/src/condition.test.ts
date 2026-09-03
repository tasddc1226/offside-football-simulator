import { describe, expect, it } from 'vitest';
import { applyCondition, type ConditionState } from './condition.js';
import type { ConditionRules } from './ruleset.js';
import type { MatchRecord } from './types.js';

// T-2-005 D-39: applyCondition 단위 테스트. 손으로 검증 가능한 로컬 상수를 쓴다(값 자체는
// packages/content 소유 — 실제 값 검증은 골든 fixture가 한다).

function testRules(): ConditionRules {
  return {
    formPivotTenths: 65,
    formDivisorTenths: 5,
    formStepMax: 4,
    formDriftPerStep: 3,
    fitnessRecoveryPerStep: 4,
    fitnessCostMinutes: 30,
    injuryFitnessCost: 10,
    moraleWin: 3,
    moraleLoss: 3,
    moraleStart: 1,
    moraleNotSelected: 2,
    moraleUnusedSub: 1,
    moraleStepMax: 5,
  };
}

const BOUNDARY_RESET_FORM = 50;

function buildMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: 'MATCH-1',
    step: 3,
    order: 1,
    competitionId: 'LEAGUE',
    kind: 'LEAGUE',
    round: null,
    opponent: { id: 'OPP-1', name: '상대팀', strength: 60 },
    home: true,
    result: { goalsFor: 1, goalsAgainst: 1, outcome: 'DRAW' },
    appearance: 'START',
    outReason: null,
    minutes: 90,
    involvement: 1,
    stats: { group: 'MF', assists: 0, chancesCreated: 0, progressivePasses: 0, passesAttempted: 0, passesCompleted: 0, ballRecoveries: 0 },
    ratingTenths: 70,
    cards: { yellow: 0, red: false },
    injuredOff: false,
    chapterId: null,
    ...overrides,
  };
}

const baseState: ConditionState = { form: 50, fitness: 80, morale: 50 };

describe('applyCondition', () => {
  it('평점 80 매치 한 건이면 form이 오른다', () => {
    const result = applyCondition(baseState, [buildMatch({ ratingTenths: 80 })], testRules(), BOUNDARY_RESET_FORM);
    expect(result.form).toBeGreaterThan(baseState.form);
    expect(result.form).toBe(53); // trunc((80-65)/5)=3
  });

  it('평점 55 매치 한 건이면 form이 내려간다', () => {
    const result = applyCondition(baseState, [buildMatch({ ratingTenths: 55 })], testRules(), BOUNDARY_RESET_FORM);
    expect(result.form).toBeLessThan(baseState.form);
    expect(result.form).toBe(48); // trunc((55-65)/5)=-2
  });

  it('경기가 없는(또는 평점 없는) step은 시즌 경계 회귀값 쪽으로 drift한다', () => {
    const below: ConditionState = { ...baseState, form: 30 };
    const result = applyCondition(below, [], testRules(), 50);
    expect(result.form).toBe(33); // moveToward(30,50,3)

    const overshoot: ConditionState = { ...baseState, form: 49 };
    const nearTarget = applyCondition(overshoot, [], testRules(), 50);
    expect(nearTarget.form).toBe(50); // 49+3은 target을 넘으므로 target에서 멈춘다

    // 0분 출전(줄부상 등으로 ratingTenths가 null)도 "평점 있는 경기"로 치지 않는다.
    const zeroMinute = applyCondition(below, [buildMatch({ minutes: 0, ratingTenths: null })], testRules(), 50);
    expect(zeroMinute.form).toBe(33);
  });

  it('90분 경기 두 건이면 체력 순변화가 -2다', () => {
    const rules = testRules();
    const result = applyCondition(
      baseState,
      [buildMatch({ id: 'M1', minutes: 90 }), buildMatch({ id: 'M2', minutes: 90 })],
      rules,
      BOUNDARY_RESET_FORM,
    );
    // fitnessRecoveryPerStep(4) - 2*trunc(90/30)(6) = -2
    expect(result.fitness).toBe(baseState.fitness - 2);
  });

  it('NOT_SELECTED이면 사기가 내려간다', () => {
    const result = applyCondition(
      baseState,
      [buildMatch({ appearance: 'OUT', outReason: 'NOT_SELECTED', minutes: 0, ratingTenths: null, result: { goalsFor: 1, goalsAgainst: 1, outcome: 'DRAW' } })],
      testRules(),
      BOUNDARY_RESET_FORM,
    );
    expect(result.morale).toBe(baseState.morale - 2);
  });

  it('한 step의 사기 변화 합은 moraleStepMax로 clamp된다', () => {
    const rules = testRules();
    const threeWins = [
      buildMatch({ id: 'M1', appearance: 'START', result: { goalsFor: 2, goalsAgainst: 0, outcome: 'WIN' } }),
      buildMatch({ id: 'M2', appearance: 'START', result: { goalsFor: 2, goalsAgainst: 0, outcome: 'WIN' } }),
      buildMatch({ id: 'M3', appearance: 'START', result: { goalsFor: 2, goalsAgainst: 0, outcome: 'WIN' } }),
    ];
    // 원시 합: WIN 3*3 + START 3*1 = 12 > moraleStepMax(5) → 5로 clamp된다.
    const result = applyCondition(baseState, threeWins, rules, BOUNDARY_RESET_FORM);
    expect(result.morale).toBe(baseState.morale + rules.moraleStepMax);
  });

  it('결과 값은 항상 [0,100] 정수로 clamp된다', () => {
    const nearFull: ConditionState = { form: 99, fitness: 2, morale: 98 };
    const heavyMinutes = [buildMatch({ id: 'M1', minutes: 90 }), buildMatch({ id: 'M2', minutes: 90 }), buildMatch({ id: 'M3', minutes: 90 })];
    const threeWins = heavyMinutes.map((match) => ({ ...match, result: { goalsFor: 2, goalsAgainst: 0, outcome: 'WIN' as const } }));

    const result = applyCondition(nearFull, threeWins, testRules(), BOUNDARY_RESET_FORM);
    expect(result.fitness).toBe(0); // 회복보다 소모가 훨씬 커서 하한 clamp
    expect(result.morale).toBe(100); // 상한 clamp
    expect(Number.isInteger(result.form)).toBe(true);
    expect(Number.isInteger(result.fitness)).toBe(true);
    expect(Number.isInteger(result.morale)).toBe(true);
    expect(result.form).toBeGreaterThanOrEqual(0);
    expect(result.form).toBeLessThanOrEqual(100);
  });
});
