import { describe, expect, it } from 'vitest';
import {
  bloomTick,
  potAchText,
  potFogged,
  potGrade,
  potLabel,
  potReveal,
  potScouted,
} from './stats.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-10-073 잠재력은 흐리게: 재평가 전엔 스카우트 평가가 범위로만 보이고, 은퇴 때 실제 잠재력을 공개한다.
const st = (pot: number, rescout?: number, bloom = 0, potBonus?: number, peak = 80) =>
  ({ pot, bloom, peak, flags: { rescout, potBonus } }) as unknown as GameState;

describe('잠재력 표시 (T-10-073)', () => {
  it('재평가 전(고교~20세)엔 ±4 범위로, 21세 재평가 뒤엔 ±2, 24세 재평가 뒤엔 한 등급으로 보인다', () => {
    expect(potLabel(st(81))).toBe('C~A'); // 77~85
    expect(potLabel(st(81, 1))).toBe('B'); // 79~83
    expect(potLabel(st(79, 1))).toBe('C~B'); // 77~81
    expect(potLabel(st(79, 2))).toBe('B');
    expect(potLabel(st(95))).toBe('S'); // 범위가 한 등급 안이면 한 글자
  });

  it('T-10-112 고3 첫 시즌을 마치기 전에는 스카우트 평가가 없다', () => {
    expect(potScouted({ ...st(80), career: [] } as GameState)).toBe(false);
    expect(potScouted({ ...st(80), career: [{}] } as unknown as GameState)).toBe(true);
  });

  it('남은 재평가가 있는 동안만 흐리다', () => {
    expect([undefined, 0, 1, 2, 3].map((n) => potFogged(st(80, n)))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('이벤트 보너스는 평가에 더해지고, 숨은 성장(bloom)은 은퇴 공개에만 보인다', () => {
    expect(potGrade(st(82, 2, 0, 3))).toBe('A');
    expect(potLabel(st(82, 2, 0, 3))).toBe('A');
    expect(potReveal(st(82, 2, 9))).toMatchObject({ real: 'S', scout: 'B' });
    expect(potReveal(st(82, 2, -6))).toMatchObject({ real: 'C', scout: 'B' });
  });

  it('T-10-075 달성도 = 최고 OVR ÷ 실제 잠재력', () => {
    expect(potReveal(st(80, 2, 0, 0, 78)).ach).toBe(98);
    expect(potReveal(st(76, 2, 2, 2, 84)).ach).toBe(105);
    expect(potAchText(105)).toMatch(/넘어섰/);
    expect(potAchText(98)).toMatch(/끌어냈/);
    expect(potAchText(94)).toMatch(/남겨/);
    expect(potAchText(80)).toMatch(/피우지 못한/);
  });

  it('재평가 로그도 화면과 같은 흐린 평가로 알린다', () => {
    setActiveRng(createRng(1));
    const s = { ...st(81, 0, 4), age: 30, year: 2030, phase: 0, log: [] } as unknown as GameState;
    // 나이 30이라 bloom은 더 흔들리지 않는다 — k = round(4 × 0.5) = 2, 스카우트 83.
    expect(bloomTick(s)).toBe('스카우트 재평가 · 잠재력 C~A → B~A');
    expect(s.log[0]!.kind).toBe('good');
  });
});
