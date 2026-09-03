import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { computeBaseOvr, generatePlayerProfile } from './player.js';
import { seedRng } from './rng.js';
import type { AttributeKey } from './types.js';

// 프로토타입 김서준의 세부 능력(docs/content/prototype/season-01-inside-forward.md).
const PROTOTYPE_ATTRIBUTES: Record<AttributeKey, number> = {
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

const INSIDE_FORWARD_ROLE_WEIGHTS = rulesetProto.archetypes.find((a) => a.id === 'inside-forward')!.roleWeights;

describe('computeBaseOvr', () => {
  it('프로토타입 능력 × 인사이드 포워드 가중치는 59다(합 59.30)', () => {
    expect(computeBaseOvr(PROTOTYPE_ATTRIBUTES, INSIDE_FORWARD_ROLE_WEIGHTS)).toBe(59);
  });

  it('roleWeights 합이 1이 아니면 throw한다', () => {
    const badWeights = { ...INSIDE_FORWARD_ROLE_WEIGHTS, shooting: 0.5 };
    expect(() => computeBaseOvr(PROTOTYPE_ATTRIBUTES, badWeights)).toThrow(RangeError);
  });

  it('가중치에 없는 키는 0으로 취급한다', () => {
    const ovr = computeBaseOvr(PROTOTYPE_ATTRIBUTES, { shooting: 1 });
    expect(ovr).toBe(60);
  });
});

/**
 * T-2-011 10번(a), decision-log 2026-09-03 후속 기록: attributes jitter와 truePotential roll을
 * 독립으로 굴리면 표본의 약 7%가 `baseOvr > truePotential`로 나온다(성장 여지가 없거나 음수). 모든
 * archetype × 배경 200개 seed(총 3400 표본, 실제로 관측된 7% 발생률을 여유 있게 덮는 크기)를 훑어
 * `truePotential >= baseOvr + 1` 불변식이 예외 없이 성립하는지 확인한다.
 */
describe('generatePlayerProfile — truePotential ≥ baseOvr + 1 불변식(T-2-011 10번 a)', () => {
  it('모든 archetype·배경 조합에서 200개 seed 전부 truePotential이 baseOvr보다 최소 1 크다', () => {
    let sampleCount = 0;
    for (const archetype of rulesetProto.archetypes) {
      for (const background of rulesetProto.backgrounds) {
        for (let i = 0; i < 200; i++) {
          const draft = {
            name: '표본',
            gender: 'UNSPECIFIED' as const,
            nationalityCode: 'KR',
            preferredFoot: 'RIGHT' as const,
            position: archetype.position,
            archetypeId: archetype.id,
            backgroundId: background.id,
          };
          const generated = generatePlayerProfile(draft, rulesetProto, seedRng(`truepotential-invariant-${archetype.id}-${background.id}-${i}`));
          sampleCount += 1;
          expect(
            generated.profile.truePotential,
            `${archetype.id}/${background.id}#${i}: baseOvr=${generated.profile.baseOvr}`,
          ).toBeGreaterThanOrEqual(generated.profile.baseOvr + 1);
        }
      }
    }
    expect(sampleCount).toBeGreaterThan(1000);
  });
});
