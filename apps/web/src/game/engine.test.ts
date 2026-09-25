import { describe, expect, it } from 'vitest';
import { addStat, fameEff, fmtMoney } from './engine.js';
import type { GameState } from './types.js';

describe('fmtMoney', () => {
  it('만 단위와 억 단위를 천만 단위로 반올림해 표시한다', () => {
    expect(fmtMoney(1260)).toBe('1,260만');
    expect(fmtMoney(10000)).toBe('1억');
    expect(fmtMoney(135000)).toBe('13억 5,000만');
    expect(fmtMoney(22100)).toBe('2억 2,000만');
  });

  it('반올림이 1억이 되면 억으로 올린다', () => {
    expect(fmtMoney(189770)).toBe('19억');
    expect(fmtMoney(19600)).toBe('2억');
  });

  it('음수는 부호만 앞에 붙인다', () => {
    expect(fmtMoney(-15000)).toBe('-1억 5,000만');
    expect(fmtMoney(-3000)).toBe('-3,000만');
  });
});

describe('인기 (T-10-025)', () => {
  const st = (fame: number) => ({ fame, trait: '', age: 25 }) as unknown as GameState;

  it('상한 없이 100을 넘어 쌓이고, 0 아래로는 내려가지 않는다', () => {
    const s = st(95);
    for (let i = 0; i < 10; i++) addStat(s, 'fame', 20);
    expect(s.fame).toBeGreaterThan(200);
    addStat(s, 'fame', -1e6);
    expect(s.fame).toBe(0);
  });

  it('밸런스 공식에 쓰는 인기는 100까지만 반영한다', () => {
    expect(fameEff(st(40))).toBe(40);
    expect(fameEff(st(350))).toBe(100);
  });
});
