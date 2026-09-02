import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { computeBaseOvr } from './player.js';
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
