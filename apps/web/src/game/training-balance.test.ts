import { describe, expect, it } from 'vitest';
import { newGame, balanceFactor, trainingDesc, TRAININGS, attackEdge, ATTACK_KNEE, BALANCE_MIN } from './engine.js';
import { createRng, setActiveRng } from './rng.js';

// T-10-042: 한 능력치 몰아주기 억제와 공격 우위 완만화.
const fw = () => {
  setActiveRng(createRng(3));
  return newGame({ name: '테스트', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' }, 3);
};
const sho = TRAININGS.find((t) => t.id === 'sho')!;

describe('훈련 치우침 억제 (T-10-042)', () => {
  it('고르게 키운 선수는 그대로, 한 능력치만 앞서면 성장이 줄고 화면에 알린다', () => {
    const s = fw();
    expect(balanceFactor(s, 'sho')).toBe(1);
    expect(trainingDesc(s, sho)).not.toContain('치우침');
    s.attrs.sho = 95;
    expect(balanceFactor(s, 'sho')).toBe(BALANCE_MIN);
    expect(trainingDesc(s, sho)).toContain(`치우침 · 성장 −${Math.round((1 - BALANCE_MIN) * 100)}%`);
    // 뒤처진 능력치(패스)를 키우는 건 줄지 않는다.
    expect(balanceFactor(s, 'pas')).toBe(1);
  });

  it('공격 우위는 기준까지 그대로, 넘는 몫은 줄여 반영한다', () => {
    expect(attackEdge(-4)).toBe(-4);
    expect(attackEdge(ATTACK_KNEE)).toBe(ATTACK_KNEE);
    expect(attackEdge(ATTACK_KNEE + 20)).toBeCloseTo(ATTACK_KNEE + 6, 10);
  });
});
