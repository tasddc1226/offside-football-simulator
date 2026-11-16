import { describe, expect, it } from 'vitest';
import { peakEndAge } from './care.js';
import { PRIME_MAX, primeAdLeft, primeChance, primeCost, primeStatus, tryPrime } from './prime.js';
import { newGame } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

function vet(age: number, money = 1e7): GameState {
  setActiveRng(createRng(11));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    11,
  );
  s.age = age;
  s.money = money;
  return s;
}

describe('T-11-733 전성기 연장', () => {
  it('정점 나이 1년 전부터 열린다', () => {
    const s = vet(20);
    expect(primeStatus(s)).toBe('early');
    s.age = peakEndAge(s) - 1;
    expect(primeStatus(s)).toBe('ready');
  });

  it('성공하면 정점 나이가 늦어지고 시즌마다 한 번만 시도한다', () => {
    const s = vet(29);
    s.age = peakEndAge(s) - 1;
    const before = peakEndAge(s);
    const money = s.money;
    const r = tryPrime(s)!;
    expect(r).not.toBeNull();
    expect(s.money).toBe(money - r.cost);
    expect(peakEndAge(s)).toBe(before + (r.great ? 2 : r.ok ? 1 : 0));
    expect(primeStatus(s)).toBe(r.lv >= PRIME_MAX ? 'max' : 'done');
    expect(tryPrime(s)).toBeNull();
  });

  it('실패하면 다음 확률이 오른다', () => {
    const s = vet(30);
    s.age = peakEndAge(s);
    s.prime = { lv: 0, fails: 2, log: [] };
    expect(primeChance(s)).toBe(50);
  });

  it('자금이 모자라면 광고로 커리어 합계 두 번까지 시도한다', () => {
    const s = vet(30, 0);
    s.age = peakEndAge(s);
    expect(primeStatus(s)).toBe('short');
    expect(tryPrime(s)).toBeNull();
    expect(primeAdLeft(s)).toBe(2);
    tryPrime(s, 'ad');
    s.year++;
    if (primeStatus(s) === 'short') {
      tryPrime(s, 'ad');
      s.year++;
      expect(primeAdLeft(s)).toBe(0);
    }
    expect(primeCost(s)).toBeGreaterThan(0);
  });

  it('시도하지 않으면 정점 나이가 그대로다', () => {
    const s = vet(25);
    const before = peakEndAge(s);
    s.prime = { lv: 0, fails: 0, log: [] };
    expect(peakEndAge(s)).toBe(before);
    s.prime.lv = 2;
    expect(peakEndAge(s)).toBe(before + 2);
  });
});
