import { describe, expect, expectTypeOf, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { buildMarketValueInput, computeMarketValueIndex, type MarketValueInput } from './market-value.js';
import type { CareerState } from './types.js';

const rules = rulesetProto.marketValueRules;

describe('computeMarketValueIndex', () => {
  it('D-41 가중치(35/20/15/10/10/5/5, bp 합 10000)로 각 성분·합계를 정확히 계산한다', () => {
    const input: MarketValueInput = {
      baseOvr: 70,
      scoutedPotentialMid: 80,
      age: 25,
      contractSeasonsRemaining: 2,
      leagueTier: 1,
      form: 60,
      popularityCenti: 5000,
    };
    const result = computeMarketValueIndex(input, rules);

    const weightSumBp = Object.values(rules.weightsBp).reduce((sum, bp) => sum + bp, 0);
    expect(weightSumBp).toBe(10000);

    expect(result.components).toEqual([
      { key: 'BASE_OVR', weightBp: 3500, valueCenti: 7000, contributionCenti: 2450 },
      { key: 'SCOUTED_POTENTIAL_MID', weightBp: 2000, valueCenti: 8000, contributionCenti: 1600 },
      { key: 'AGE_CURVE', weightBp: 1500, valueCenti: 10000, contributionCenti: 1500 },
      { key: 'CONTRACT', weightBp: 1000, valueCenti: 10000, contributionCenti: 1000 },
      { key: 'LEAGUE', weightBp: 1000, valueCenti: 10000, contributionCenti: 1000 },
      { key: 'FORM', weightBp: 500, valueCenti: 6000, contributionCenti: 300 },
      { key: 'POPULARITY', weightBp: 500, valueCenti: 5000, contributionCenti: 250 },
    ]);
    expect(result.indexCenti).toBe(2450 + 1600 + 1500 + 1000 + 1000 + 300 + 250);
  });

  it('같은 정찰 범위·다른 truePotential의 두 선수는 같은 시장가치를 낸다(정찰 범위 밖 정보 비노출)', () => {
    const input: MarketValueInput = {
      baseOvr: 70,
      scoutedPotentialMid: 75,
      age: 24,
      contractSeasonsRemaining: 1,
      leagueTier: 2,
      form: 55,
      popularityCenti: 5000,
    };
    // truePotential이 서로 다른 두 선수라도(타입에 없으므로 입력 자체가 같다) 결과가 같다.
    const a = computeMarketValueIndex(input, rules);
    const b = computeMarketValueIndex({ ...input }, rules);
    expect(a).toEqual(b);
  });

  describe('나이 구간 경계', () => {
    it.each([
      [21, 7000],
      [22, 10000],
      [25, 10000],
      [26, 9000],
      [29, 9000],
      [30, 6000],
      [32, 6000],
      [33, 3000],
      [99, 3000],
      [150, 3000],
    ])('age=%i → AGE_CURVE valueCenti=%i', (age, expected) => {
      const input: MarketValueInput = {
        baseOvr: 50, scoutedPotentialMid: 50, age, contractSeasonsRemaining: 2, leagueTier: 1, form: 50, popularityCenti: 5000,
      };
      const result = computeMarketValueIndex(input, rules);
      expect(result.components.find((c) => c.key === 'AGE_CURVE')?.valueCenti).toBe(expected);
    });
  });

  describe('계약 잔여 시즌 경계', () => {
    it.each([
      [0, 4000],
      [1, 7000],
      [2, 10000],
      [5, 10000],
    ])('contractSeasonsRemaining=%i → CONTRACT valueCenti=%i', (remaining, expected) => {
      const input: MarketValueInput = {
        baseOvr: 50, scoutedPotentialMid: 50, age: 25, contractSeasonsRemaining: remaining, leagueTier: 1, form: 50, popularityCenti: 5000,
      };
      const result = computeMarketValueIndex(input, rules);
      expect(result.components.find((c) => c.key === 'CONTRACT')?.valueCenti).toBe(expected);
    });
  });

  describe('리그 등급', () => {
    it.each([
      ['YOUTH' as const, 2000],
      [3 as const, 5000],
      [2 as const, 7500],
      [1 as const, 10000],
    ])('leagueTier=%s → LEAGUE valueCenti=%i', (leagueTier, expected) => {
      const input: MarketValueInput = {
        baseOvr: 50, scoutedPotentialMid: 50, age: 25, contractSeasonsRemaining: 2, leagueTier, form: 50, popularityCenti: 5000,
      };
      const result = computeMarketValueIndex(input, rules);
      expect(result.components.find((c) => c.key === 'LEAGUE')?.valueCenti).toBe(expected);
    });
  });

  describe('0~100 정규화 경계(BASE_OVR·SCOUTED_POTENTIAL_MID·FORM)', () => {
    it('0이면 valueCenti 0, 100이면 10000이다', () => {
      const zero = computeMarketValueIndex(
        { baseOvr: 0, scoutedPotentialMid: 0, age: 25, contractSeasonsRemaining: 2, leagueTier: 1, form: 0, popularityCenti: 5000 },
        rules,
      );
      expect(zero.components.find((c) => c.key === 'BASE_OVR')?.valueCenti).toBe(0);
      expect(zero.components.find((c) => c.key === 'SCOUTED_POTENTIAL_MID')?.valueCenti).toBe(0);
      expect(zero.components.find((c) => c.key === 'FORM')?.valueCenti).toBe(0);

      const hundred = computeMarketValueIndex(
        { baseOvr: 100, scoutedPotentialMid: 100, age: 25, contractSeasonsRemaining: 2, leagueTier: 1, form: 100, popularityCenti: 5000 },
        rules,
      );
      expect(hundred.components.find((c) => c.key === 'BASE_OVR')?.valueCenti).toBe(10000);
      expect(hundred.components.find((c) => c.key === 'SCOUTED_POTENTIAL_MID')?.valueCenti).toBe(10000);
      expect(hundred.components.find((c) => c.key === 'FORM')?.valueCenti).toBe(10000);
    });
  });

  it('MarketValueInput에는 truePotential 필드가 없다(타입 검사)', () => {
    expectTypeOf<MarketValueInput>().toEqualTypeOf<{
      baseOvr: number;
      scoutedPotentialMid: number;
      age: number;
      contractSeasonsRemaining: number;
      leagueTier: 'YOUTH' | 1 | 2 | 3;
      form: number;
      popularityCenti: number;
    }>();
  });
});

describe('buildMarketValueInput', () => {
  function stateWithContract(overrides: Partial<CareerState> = {}): CareerState {
    return {
      schemaVersion: 1,
      careerId: 'car_mv_test',
      status: 'ACTIVE',
      stage: 'PRO',
      age: 24,
      currentStep: 1,
      seasonPhase: 'PRESEASON',
      simulationMode: 'FAST',
      attributes: {
        shooting: 60, passing: 60, dribbling: 60, tackling: 60, firstTouch: 60, crossing: 60, goalkeeping: 10,
        pace: 60, acceleration: 60, agility: 60, jumping: 60, stamina: 60, strength: 60, durability: 60,
        decisions: 60, concentration: 60, composure: 60, positioning: 60, leadership: 60, consistency: 60,
      },
      growthCarryCenti: {
        shooting: 0, passing: 0, dribbling: 0, tackling: 0, firstTouch: 0, crossing: 0, goalkeeping: 0,
        pace: 0, acceleration: 0, agility: 0, jumping: 0, stamina: 0, strength: 0, durability: 0,
        decisions: 0, concentration: 0, composure: 0, positioning: 0, leadership: 0, consistency: 0,
      },
      state: { form: 55, fitness: 80, morale: 60 },
      context: { tacticalFit: 50, squadStatus: 50, positionProficiency: 100 },
      relationships: { managerTrust: 50, captain: 0, rival: 0, fans: 0, agent: 0 },
      tags: [],
      appliedSourceIds: [],
      activeEffects: [],
      deferredEffects: [],
      resolvedEventIds: [],
      resolvedChapterIds: [],
      careerTags: [],
      careerTagGrants: [],
      rngState: { s: [1, 2, 3, 4], draws: 0 },
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      player: {
        draft: { name: null, gender: null, nationalityCode: null, preferredFoot: null, position: null, archetypeId: null, backgroundId: null },
        profile: {
          name: '테스트', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'RIGHT',
          preferredPosition: 'ST', primaryPosition: 'ST', archetypeId: 'inside-forward', backgroundId: 'club-academy',
          truePotential: 90, scoutedPotentialMin: 70, scoutedPotentialMax: 84, baseOvr: 65,
        },
      },
      pending: null,
      contract: {
        id: 'CTR-1', offerId: 'OFR-1', teamId: 'team-1', teamName: '테스트 FC', leagueTier: 2,
        lengthSeasons: 3, wageMinorPerWeek: 1000000, signingBonusMinor: 0, rolePromise: 'STARTER',
        shirtNumber: 9, signatureType: 'AUTO', signedAtRevision: 5,
        kind: 'PERMANENT', appearancePromise: { minutesShareBp: 8000 }, positionPlan: 'ST',
        suspended: false, loan: null, promiseBreaches: 0, signedSeasonIndex: 1,
      },
      clubHistory: [],
      timeline: [],
      season: null,
      seasonHistory: [],
      ...overrides,
    };
  }

  it('scoutedPotentialMid는 정찰 범위 중간값이고, popularityCenti는 5000 고정이다', () => {
    const input = buildMarketValueInput(stateWithContract(), rulesetProto);
    expect(input.scoutedPotentialMid).toBe(Math.round((70 + 84) / 2));
    expect(input.popularityCenti).toBe(5000);
    expect(input.baseOvr).toBe(65);
    expect(input.age).toBe(24);
    expect(input.leagueTier).toBe(2);
    expect(input.form).toBe(55);
  });

  it('contractSeasonsRemaining은 계약 서명 이후 SEASON_STARTED 횟수를 lengthSeasons에서 뺀 값이다', () => {
    const state = stateWithContract({
      timeline: [
        { revision: 5, kind: 'CONTRACT_SIGNED', refId: 'CTR-1', age: 24, step: 1 },
        { revision: 6, kind: 'SEASON_STARTED', refId: null, age: 24, step: 1 },
        { revision: 20, kind: 'SEASON_STARTED', refId: null, age: 25, step: 1 },
      ],
    });
    const input = buildMarketValueInput(state, rulesetProto);
    expect(input.contractSeasonsRemaining).toBe(1); // lengthSeasons(3) - 2회 SEASON_STARTED
  });

  it('lengthSeasons를 넘는 SEASON_STARTED가 있어도 0 아래로 내려가지 않는다', () => {
    const state = stateWithContract({
      timeline: [1, 2, 3, 4].map((n) => ({ revision: 5 + n, kind: 'SEASON_STARTED' as const, refId: null, age: 24 + n, step: 1 })),
    });
    const input = buildMarketValueInput(state, rulesetProto);
    expect(input.contractSeasonsRemaining).toBe(0);
  });
});
