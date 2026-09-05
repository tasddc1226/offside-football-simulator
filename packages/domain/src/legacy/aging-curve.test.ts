import { describe, expect, it } from 'vitest';
import { computeGrowth, type GrowthInput, type GrowthResult } from '../growth.js';
import { rulesetProto } from '../__fixtures__/career-01.js';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../types.js';

function attributes(value: number): Record<AttributeKey, number> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, value])) as Record<
    AttributeKey,
    number
  >;
}

function input(age: number, archetypeId: string): GrowthInput {
  return {
    age,
    attributes: attributes(50),
    archetypeId,
    truePotential: 90,
    baseOvrBefore: 50,
    minutes: 2400,
    ratedMatches: 20,
    ratingSumTenths: 20 * 70,
    trainingFocus: 'ROLE',
    growthCarryCenti: attributes(0),
  };
}

function delta(result: GrowthResult, key: AttributeKey): number {
  return result.attributes[key] - 50;
}

describe('Phase 5 age-curve golden regression (ruleset 1.0.0)', () => {
  it('fixes representative growth/decline values across every position group and boundary', () => {
    const cases = [
      ['GK', 'gk-shot-stopper'],
      ['DF', 'cb-stopper'],
      ['MF', 'am-playmaker'],
      ['FW', 'st-poacher'],
    ] as const;
    const expected = {
      'gk-shot-stopper': {
        20: [1, 0, 2, 4],
        21: [1, 1, 2, 4],
        22: [0, 0, 1, 2],
        29: [0, 0, 1, 2],
        30: [0, 0, 0, 0],
        35: [-2, 0, 0, 0],
        40: [-3, -2, -1, -1],
        45: [-3, -3, -2, -2],
      },
      'cb-stopper': {
        20: [1, 0, 2, 0],
        21: [1, 1, 2, 0],
        22: [0, 0, 1, 0],
        29: [0, 0, 1, 0],
        30: [0, 0, 0, 0],
        35: [-2, 0, 0, 0],
        40: [-3, -2, -1, -1],
        45: [-3, -3, -2, -2],
      },
      'am-playmaker': {
        20: [1, 4, 4, 0],
        21: [1, 4, 4, 0],
        22: [0, 2, 1, 0],
        29: [0, 2, 2, 0],
        30: [0, 0, 0, 0],
        35: [-2, 0, 0, 0],
        40: [-3, -2, 0, -1],
        45: [-3, -3, -1, -2],
      },
      'st-poacher': {
        20: [1, 4, 3, 0],
        21: [1, 4, 3, 0],
        22: [0, 2, 1, 0],
        29: [0, 2, 2, 0],
        30: [0, 0, 0, 0],
        35: [-2, 0, 0, 0],
        40: [-3, -2, -1, -1],
        45: [-3, -3, -2, -2],
      },
    } as const;
    const ages = [20, 21, 22, 29, 30, 35, 40, 45] as const;

    // These are explicit outputs of the existing computeGrowth formula and the checked-in
    // ruleset 1.0.0 ageCurves/decline coefficients. They are regression fixtures, not a
    // new operating-balance approval. No separate Phase 5 golden curve is being invented here.
    for (const [, archetypeId] of cases) {
      for (const age of ages) {
        const result = computeGrowth(input(age, archetypeId), rulesetProto);
        const [pace, shooting, decisions, goalkeeping] = expected[archetypeId][age];
        expect({
          pace: delta(result, 'pace'),
          shooting: delta(result, 'shooting'),
          decisions: delta(result, 'decisions'),
          goalkeeping: delta(result, 'goalkeeping'),
        }).toEqual({ pace, shooting, decisions, goalkeeping });
      }
    }
  });

  it('applies each ruleset decline coefficient once, without a second Phase 5 decrement', () => {
    const result = computeGrowth(input(40, 'gk-shot-stopper'), rulesetProto);
    const expectedDecline = {
      pace: -440,
      shooting: -200,
      decisions: -120,
      goalkeeping: -125,
    } as const;
    for (const [key, centi] of Object.entries(expectedDecline) as Array<[AttributeKey, number]>) {
      const entry = result.attributeDeltas.find((candidate) => candidate.key === key);
      expect(entry?.causes.filter((cause) => cause.cause === 'AGE_DECLINE')).toEqual([
        { cause: 'AGE_DECLINE', centi },
      ]);
    }
  });
});
