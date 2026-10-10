import { describe, expect, it } from 'vitest';
import {
  newGame,
  balanceFactor,
  trainingCard,
  TRAININGS,
  attackEdge,
  ATTACK_KNEE,
  BALANCE_MIN,
  atkOf,
  creOf,
  FW_ATTACK_ASSIST,
  trainingHelp,
  investCard,
  INVESTS,
  addAttr,
  snapshot,
  diffChips,
} from './engine.js';
import { FACE, syncFace } from './attributes.js';
import { createRng, setActiveRng } from './rng.js';

// T-10-042: 한 능력치 몰아주기 억제와 공격 우위 완만화.
const fw = () => {
  setActiveRng(createRng(3));
  return newGame(
    { name: '테스트', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    3,
  );
};
const sho = TRAININGS.find((t) => t.id === 'sho')!;

describe('훈련 치우침 억제 (T-10-042)', () => {
  it('고르게 키운 선수는 그대로, 한 능력치만 앞서면 성장이 줄고 화면에 알린다', () => {
    const s = fw();
    expect(balanceFactor(s, 'sho')).toBe(1);
    expect(trainingCard(s, sho).tag).not.toContain('너무 앞서');
    s.attrs.sho = 95;
    expect(balanceFactor(s, 'sho')).toBe(BALANCE_MIN);
    expect(trainingCard(s, sho).tag).toContain(
      `너무 앞서 성장 −${Math.round((1 - BALANCE_MIN) * 100)}%`,
    );
    // 뒤처진 능력치(패스)를 키우는 건 줄지 않는다.
    expect(balanceFactor(s, 'pas')).toBe(1);
  });

  it('공격 우위는 기준까지 그대로, 넘는 몫은 줄여 반영한다', () => {
    expect(attackEdge(-4)).toBe(-4);
    expect(attackEdge(ATTACK_KNEE)).toBe(ATTACK_KNEE);
    expect(attackEdge(ATTACK_KNEE + 20)).toBeCloseTo(ATTACK_KNEE + 6, 10);
  });

  it('공격수의 도움 능력치엔 공격 능력치가 섞이고, 다른 포지션은 패스·드리블만 본다', () => {
    const s = fw();
    Object.assign(s.attrs, { pas: 40, dri: 80, sho: 90, pac: 80 });
    const cre = 40 * 0.7 + 80 * 0.3;
    expect(creOf(s)).toBeCloseTo(cre * (1 - FW_ATTACK_ASSIST) + atkOf(s) * FW_ATTACK_ASSIST, 10);
    expect(creOf(s)).toBeGreaterThan(cre);
    s.pos = 'MF';
    expect(creOf(s)).toBeCloseTo(cre, 10);
  });
});

// T-11-183: 세부 능력치가 99에 닿은 능력치는 오를 것처럼 보이지 않게, 작은 성장도 칩에 남게.
describe('최고치 도달·소수 성장 칩 (T-11-183)', () => {
  const maxSho = (s: ReturnType<typeof fw>) => {
    for (const k of Object.keys(FACE.sho)) s.sub[k] = 99;
    syncFace(s);
  };
  it('세부 능력치가 모두 99면 성장 태그 대신 최고치 도달을 보여 준다', () => {
    const s = fw();
    expect(trainingCard(s, sho).tag).not.toContain('최고치');
    maxSho(s);
    const tag = trainingCard(s, sho).tag;
    expect(tag).toMatch(/^\S+ 최고치 도달$/);
    expect(tag).not.toContain('주력 성장');
    expect(trainingHelp(s, sho)).toContain('최고치(99)');
    const before = s.attrs.sho;
    addAttr(s, 'sho', 3);
    expect(s.attrs.sho).toBe(before);
  });

  it('일부만 99면 줄어드는 몫을 알린다', () => {
    const s = fw();
    const subs = Object.keys(FACE.sho);
    s.sub[subs[0]!] = 99;
    syncFace(s);
    expect(trainingCard(s, sho).tag).toMatch(/최고치에 닿아 성장 −\d+%/);
  });

  it('강점 특화 특훈이 다 찬 능력치를 고르면 카드에 알린다', () => {
    const s = fw();
    for (const k of Object.keys(s.sub)) s.sub[k] = 99;
    syncFace(s);
    const best = INVESTS.find((d) => d.id === 'best')!;
    expect(investCard(s, best).tag).toContain('최고치 도달');
  });

  it('1 미만으로 오른 능력치도 칩에 소수로 남는다', () => {
    const s = fw();
    s.attrs.sho = 70.4;
    const a = snapshot(s);
    s.attrs.sho = 70.8;
    const chip = diffChips(s, a, snapshot(s)).find((c) => c.label !== 'OVR');
    expect(chip?.d).toBe(0.4);
  });
});
