import { describe, expect, it } from 'vitest';
import { applyBalance } from './balance.js';
import { CARES, buyCare, careCost, careDepth, careKeep, careStatus, peakEndAge } from './care.js';
import { newGame } from './engine.js';
import { endSeason } from './season.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

function vet(o: { age?: number; money?: number; salary?: number } = {}): GameState {
  setActiveRng(createRng(11));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    11,
  );
  s.age = o.age ?? 32;
  s.money = o.money ?? 1e7;
  s.contract = o.salary == null ? null : { years: 2, salary: o.salary };
  return s;
}

describe('T-11-513 몸 관리', () => {
  it('정점을 넘기는 시즌부터 받을 수 있다', () => {
    const s = vet({ age: peakEndAge({ trait: 'normal', pos: 'FW' }) - 1 });
    expect(careStatus(s)).toBe('early');
    expect(buyCare(s, 1)).toBeNull();
    s.age++;
    expect(careDepth(s)).toBe(1);
    expect(careStatus(s)).toBe('open');
  });

  it('비용은 연봉 비례 · 최소 금액이고 하락이 깊을수록 절반씩 더하며 운영 배율을 곱한다', () => {
    const s = vet({ age: 30, salary: 100_000 });
    expect(careCost(s, CARES[0]!)).toBe(50_000);
    s.age = 32;
    expect(careCost(s, CARES[0]!)).toBe(100_000);
    const low = vet({ age: 30 });
    expect(careCost(low, CARES[2]!)).toBe(40_000);
    try {
      // newGame이 밸런스를 다시 적용하므로 선수를 만든 뒤에 바꾼다.
      applyBalance({ careCost: 2 });
      expect(careCost(low, CARES[2]!)).toBe(80_000);
    } finally {
      applyBalance();
    }
  });

  it('시즌마다 한 번, 자금이 모자라면 받지 않는다', () => {
    const poor = vet({ money: 100 });
    expect(buyCare(poor, 1)).toBeNull();
    expect(poor.care).toBeUndefined();
    const s = vet({ money: 1e7 });
    const r = buyCare(s, 3);
    expect(r).not.toBeNull();
    expect(s.money).toBe(1e7 - r!.cost);
    expect(s.care).toEqual({ y: s.year, t: 3, c: r!.cost });
    expect(careStatus(s)).toBe('done');
    expect(buyCare(s, 1)).toBeNull();
    expect(careKeep(s)).toBe(0.25);
  });

  it('받은 시즌 끝 하락이 줄고, 다음 시즌엔 다시 받을 수 있다', () => {
    const run = (t: 0 | 3) => {
      const s = vet({ age: 34 });
      if (t) buyCare(s, t);
      const before = { ...s.attrs };
      endSeason(s);
      const drop = (['pac', 'phy', 'sho', 'pas', 'dri', 'def'] as const).reduce(
        (a, k) => a + (before[k] - s.attrs[k]),
        0,
      );
      return { drop, careNext: careStatus(s) };
    };
    const plain = run(0);
    const cared = run(3);
    expect(cared.drop).toBeGreaterThan(0);
    expect(cared.drop).toBeLessThan(plain.drop * 0.5);
    // 다음 시즌엔 새로 받을 수 있다.
    expect(cared.careNext).toBe('open');
  });
});
