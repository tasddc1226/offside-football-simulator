import { describe, expect, it } from 'vitest';
import { attributeGroupOf, computeGrowth, type GrowthInput, type GrowthResult } from './growth.js';
import type { Archetype, GrowthRules, Ruleset } from './ruleset.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type TrainingFocus } from './types.js';

// T-2-005 D-39: computeGrowth 단위 테스트. 실제 콘텐츠 룰셋 대신 손으로 검증 가능한 최소
// Archetype/GrowthRules를 쓴다(밸런스 검증은 growth.balance.test.ts가 실제 룰셋으로 따로 한다).

function buildAttributes(base: number): Record<AttributeKey, number> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, base])) as Record<AttributeKey, number>;
}

function zeroCarry(): Record<AttributeKey, number> {
  return buildAttributes(0);
}

const testArchetype: Archetype = {
  id: 'test-archetype',
  position: 'ST',
  name: '테스트 아키타입',
  summary: 'growth.test.ts 전용',
  roleWeights: { shooting: 0.5, pace: 0.3, decisions: 0.2 },
  template: buildAttributes(50),
  potentialRange: { min: 50, max: 99 },
};

function baseGrowthRules(): GrowthRules {
  return {
    budgetCenti: { U21: 600, PRIME: 200, VETERAN: 0 },
    gapCap: 20,
    minutesFull: 2400,
    minutesFloorBp: 3000,
    experiencePerRatedMatchCenti: 4,
    experienceCapCenti: 120,
    goodRatingTenths: 75,
    goodRatingBonusCenti: 60,
    roleWeightScale: 8,
    baseShareBp: 1500,
    focusShareBp: 2500,
    seasonDeltaMin: -3,
    seasonDeltaMax: 4,
    ageCurves: {
      TECHNICAL: [
        { maxAge: 20, multBp: 8000 },
        { maxAge: 29, multBp: 10000 },
        { maxAge: 32, multBp: 5000 },
        { maxAge: 99, multBp: 0 },
      ],
      PHYSICAL: [
        { maxAge: 25, multBp: 10000 },
        { maxAge: 28, multBp: 5000 },
        { maxAge: 99, multBp: 0 },
      ],
      MENTAL: [
        { maxAge: 23, multBp: 7000 },
        { maxAge: 33, multBp: 10000 },
        { maxAge: 99, multBp: 3000 },
      ],
      GOALKEEPING: [
        { maxAge: 26, multBp: 8000 },
        { maxAge: 34, multBp: 10000 },
        { maxAge: 99, multBp: 3000 },
      ],
    },
    decline: {
      PHYSICAL: { startAge: 29, perYearCenti: 40 },
      TECHNICAL: { startAge: 32, perYearCenti: 25 },
      MENTAL: { startAge: 34, perYearCenti: 20 },
      GOALKEEPING: { startAge: 35, perYearCenti: 25 },
    },
  };
}

function testRuleset(growthRules: GrowthRules): Ruleset {
  return { archetypes: [testArchetype], growthRules } as unknown as Ruleset;
}

function baseInput(overrides: Partial<GrowthInput> = {}): GrowthInput {
  return {
    age: 25,
    attributes: buildAttributes(50),
    archetypeId: testArchetype.id,
    truePotential: 70,
    baseOvrBefore: 50,
    minutes: 2400,
    ratedMatches: 20,
    ratingSumTenths: 20 * 70,
    trainingFocus: 'ROLE',
    growthCarryCenti: zeroCarry(),
    ...overrides,
  };
}

function deltaOf(result: GrowthResult, key: AttributeKey): number {
  return result.attributeDeltas.find((entry) => entry.key === key)?.delta ?? 0;
}

function causesOf(result: GrowthResult, key: AttributeKey) {
  return result.attributeDeltas.find((entry) => entry.key === key)?.causes ?? [];
}

describe('computeGrowth', () => {
  it('나이17·gap20·2400분·평점70이면 역할 능력 delta 합이 양수이고 OVR 변화가 1~4다', () => {
    const ruleset = testRuleset(baseGrowthRules());
    const result = computeGrowth(
      baseInput({ age: 17, truePotential: 70, baseOvrBefore: 50, minutes: 2400, ratedMatches: 20, ratingSumTenths: 20 * 70 }),
      ruleset,
    );

    const roleAttributeSum = deltaOf(result, 'shooting') + deltaOf(result, 'pace') + deltaOf(result, 'decisions');
    expect(roleAttributeSum).toBeGreaterThan(0);

    const ovrDelta = result.baseOvr.after - result.baseOvr.before;
    expect(ovrDelta).toBeGreaterThanOrEqual(1);
    expect(ovrDelta).toBeLessThanOrEqual(4);
  });

  it('0분 시즌은 MINUTES 원인이 음수이고, 훈련+MINUTES 합이 minutesFloorBp 비율만큼만 반영된다', () => {
    const rules = baseGrowthRules();
    const ruleset = testRuleset(rules);
    const result = computeGrowth(baseInput({ age: 17, truePotential: 70, baseOvrBefore: 50, minutes: 0 }), ruleset);

    const causes = causesOf(result, 'shooting');
    const trainingCause = causes.find((cause) => cause.cause === 'TRAINING');
    const minutesCause = causes.find((cause) => cause.cause === 'MINUTES');
    expect(trainingCause).toBeDefined();
    expect(minutesCause).toBeDefined();
    expect(minutesCause!.centi).toBeLessThan(0);

    const combined = trainingCause!.centi + minutesCause!.centi;
    expect(combined).toBe(Math.trunc((trainingCause!.centi * rules.minutesFloorBp) / 10000));
  });

  it('33세 PHYSICAL 키는 delta가 0 이하이고 AGE_DECLINE 원인이 있다', () => {
    const ruleset = testRuleset(baseGrowthRules());
    const result = computeGrowth(baseInput({ age: 33, truePotential: 70, baseOvrBefore: 50 }), ruleset);

    expect(attributeGroupOf('pace')).toBe('PHYSICAL');
    expect(deltaOf(result, 'pace')).toBeLessThanOrEqual(0);

    const declineCause = causesOf(result, 'pace').find((cause) => cause.cause === 'AGE_DECLINE');
    expect(declineCause).toBeDefined();
    expect(declineCause!.centi).toBeLessThan(0);
  });

  it('gap 0이고 무경기면 훈련·경험 원인이 전혀 없고, 하락만 적용된다', () => {
    const ruleset = testRuleset(baseGrowthRules());
    const result = computeGrowth(
      baseInput({ age: 33, truePotential: 50, baseOvrBefore: 50, minutes: 2400, ratedMatches: 0, ratingSumTenths: 0 }),
      ruleset,
    );

    for (const entry of result.attributeDeltas) {
      expect(entry.causes.some((cause) => cause.cause === 'TRAINING')).toBe(false);
      expect(entry.causes.some((cause) => cause.cause === 'EXPERIENCE')).toBe(false);
    }

    const paceDecline = causesOf(result, 'pace').find((cause) => cause.cause === 'AGE_DECLINE');
    expect(paceDecline).toBeDefined();
    expect(paceDecline!.centi).toBeLessThan(0);
    expect(deltaOf(result, 'pace')).toBeLessThanOrEqual(0);
  });

  it('truePotential이 baseOvr+1이면 결과 baseOvr이 truePotential을 넘지 않고 POTENTIAL_CAP 원인이 남는다', () => {
    const ruleset = testRuleset(baseGrowthRules());
    const heavyCarry: Record<AttributeKey, number> = { ...zeroCarry(), shooting: 500, pace: 500, decisions: 500 };
    const result = computeGrowth(
      baseInput({ age: 17, truePotential: 51, baseOvrBefore: 50, growthCarryCenti: heavyCarry }),
      ruleset,
    );

    expect(result.baseOvr.after).toBeLessThanOrEqual(51);
    expect(result.attributeDeltas.some((entry) => entry.causes.some((cause) => cause.cause === 'POTENTIAL_CAP'))).toBe(true);
  });

  it('두 시즌 연속: 첫 시즌의 이월(carry)이 둘째 시즌 delta에 반영된다', () => {
    const ruleset = testRuleset(baseGrowthRules());
    const seasonInput = {
      age: 25,
      attributes: buildAttributes(50),
      archetypeId: testArchetype.id,
      truePotential: 53,
      baseOvrBefore: 50,
      minutes: 2400,
      ratedMatches: 5,
      ratingSumTenths: 5 * 60,
      trainingFocus: 'ROLE' as TrainingFocus,
    };

    const season1 = computeGrowth({ ...seasonInput, growthCarryCenti: zeroCarry() }, ruleset);
    expect(season1.growthCarryCenti.shooting).not.toBe(0);

    const season2WithCarry = computeGrowth({ ...seasonInput, growthCarryCenti: season1.growthCarryCenti }, ruleset);
    const season2WithoutCarry = computeGrowth({ ...seasonInput, growthCarryCenti: zeroCarry() }, ruleset);

    expect(deltaOf(season2WithCarry, 'shooting')).toBeGreaterThan(deltaOf(season2WithoutCarry, 'shooting'));
  });

  it("trainingFocus 'PHYSICAL'이 'ROLE'보다 물리 능력 delta 합이 크거나 같다", () => {
    const ruleset = testRuleset(baseGrowthRules());
    const input = {
      age: 20,
      attributes: buildAttributes(50),
      archetypeId: testArchetype.id,
      truePotential: 70,
      baseOvrBefore: 50,
      minutes: 2400,
      ratedMatches: 30,
      ratingSumTenths: 30 * 70,
      growthCarryCenti: zeroCarry(),
    };

    const roleResult = computeGrowth({ ...input, trainingFocus: 'ROLE' }, ruleset);
    const physicalResult = computeGrowth({ ...input, trainingFocus: 'PHYSICAL' }, ruleset);

    const physicalKeys = ATTRIBUTE_KEYS.filter((key) => attributeGroupOf(key) === 'PHYSICAL');
    const sumFor = (result: GrowthResult) => physicalKeys.reduce((sum, key) => sum + deltaOf(result, key), 0);

    expect(sumFor(physicalResult)).toBeGreaterThanOrEqual(sumFor(roleResult));
    expect(sumFor(physicalResult)).toBeGreaterThan(sumFor(roleResult));
  });
});
