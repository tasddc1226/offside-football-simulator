import { describe, expect, it } from 'vitest';
import {
  newGame,
  applyInvest,
  investCard,
  investCost,
  investTarget,
  investDef,
  INVESTS,
} from './engine.js';
import { createRng, rnd, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-11-012: 자기 투자 — 비용·효과·자금 부족·기존 저장 호환.
const fw = (): GameState => {
  setActiveRng(createRng(7));
  const s = newGame(
    { name: '테스트', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    3,
  );
  s.cond = 50;
  s.morale = 50;
  s.money = 1_000_000;
  return s;
};
const inv = (id: string) => INVESTS.find((d) => d.id === id)!;

describe('자기 투자 (T-11-012)', () => {
  it('비용은 연봉 비례, 계약이 없으면 최소 금액', () => {
    const s = fw();
    expect(s.contract).toBeNull();
    expect(investCost(s, inv('weak'))).toBe(300);
    expect(investCost(s, inv('medical'))).toBe(200);
    expect(investCost(s, inv('mental'))).toBe(150);
    expect(investCost(s, inv('none'))).toBe(0);
    s.contract = { years: 2, salary: 50_000 };
    expect(investCost(s, inv('weak'))).toBe(5_000);
    expect(investCost(s, inv('medical'))).toBe(3_000);
  });

  it('고르지 않은 커리어(옛 저장)는 아무것도 바꾸지 않고 RNG도 쓰지 않는다', () => {
    const s = fw();
    expect(investDef(s).id).toBe('none');
    const before = JSON.stringify(s);
    applyInvest(s);
    expect(JSON.stringify(s)).toBe(before);
    const next = rnd();
    fw();
    expect(rnd()).toBe(next);
  });

  it('약점 보강은 가장 낮은 핵심 능력치를 올리고 자금을 쓴다', () => {
    const s = fw();
    const k = investTarget(s, 'weak');
    const a = s.attrs[k];
    s.invest = 'weak';
    applyInvest(s);
    expect(s.attrs[k]).toBeGreaterThan(a);
    expect(s.money).toBe(1_000_000 - 300);
    expect(s.cond).toBe(47);
    expect(investCard(s, inv('weak')).effect[0]).toContain('▲');
  });

  it('강점 특화는 가장 높은 핵심 능력치를 겨눈다', () => {
    const s = fw();
    const w = investTarget(s, 'weak');
    const b = investTarget(s, 'best');
    expect(s.attrs[b]).toBeGreaterThanOrEqual(s.attrs[w]);
  });

  it('메디컬은 컨디션을 올리고 결장을 줄인다, 멘탈은 사기를 올린다', () => {
    const s = fw();
    s.injury = 5;
    s.invest = 'medical';
    applyInvest(s);
    expect(s.cond).toBe(65);
    expect(s.injury).toBe(2);
    s.invest = 'mental';
    applyInvest(s);
    expect(s.morale).toBe(60);
  });

  it('자금이 모자라면 건너뛰고 투자 안 함으로 돌린다', () => {
    const s = fw();
    s.money = 100;
    s.invest = 'weak';
    const attrs = { ...s.attrs };
    applyInvest(s);
    expect(s.money).toBe(100);
    expect(s.attrs).toEqual(attrs);
    expect(s.invest).toBe('none');
    expect(s.log[0]!.text).toContain('자금이 부족');
    expect(investCard(s, inv('medical'))).toMatchObject({ affordable: false, tag: '자금 부족' });
    expect(investCard(s, inv('none')).affordable).toBe(true);
  });
});
