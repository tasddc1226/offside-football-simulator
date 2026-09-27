import { describe, expect, it } from 'vitest';
import { potFogged, potGrade, potLabel, potReveal } from './stats.js';
import type { GameState } from './types.js';

// T-10-073 잠재력은 흐리게: 재평가 전엔 스카우트 평가가 범위로만 보이고, 은퇴 때 실제 잠재력을 공개한다.
const st = (pot: number, rescout?: number, bloom = 0, potBonus?: number) =>
  ({ pot, bloom, flags: { rescout, potBonus } }) as unknown as GameState;

describe('잠재력 표시 (T-10-073)', () => {
  it('재평가 전(고교~20세)엔 ±4 범위로, 21세 재평가 뒤엔 ±2, 24세 재평가 뒤엔 한 등급으로 보인다', () => {
    expect(potLabel(st(81))).toBe('C~A'); // 77~85
    expect(potLabel(st(81, 1))).toBe('B'); // 79~83
    expect(potLabel(st(79, 1))).toBe('C~B'); // 77~81
    expect(potLabel(st(79, 2))).toBe('B');
    expect(potLabel(st(95))).toBe('S'); // 범위가 한 등급 안이면 한 글자
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
    expect(potReveal(st(82, 2, 9))).toEqual({ real: 'S', scout: 'B' });
    expect(potReveal(st(82, 2, -6))).toEqual({ real: 'C', scout: 'B' });
  });
});
