import { describe, expect, it } from 'vitest';
import { groupByYear, showClub } from './trophyYears.js';

describe('groupByYear', () => {
  it('최근 해부터, 같은 해는 한 묶음으로(나중에 받은 것 먼저)', () => {
    const list = [
      { year: 2031, t: 'a' },
      { year: 2032, t: 'b' },
      { year: 2032, t: 'c' },
      { year: 2032, t: 'd' },
      { year: 2034, t: 'e' },
    ];
    expect(groupByYear(list)).toEqual([
      { year: 2034, items: [{ year: 2034, t: 'e' }] },
      {
        year: 2032,
        items: [
          { year: 2032, t: 'd' },
          { year: 2032, t: 'c' },
          { year: 2032, t: 'b' },
        ],
      },
      { year: 2031, items: [{ year: 2031, t: 'a' }] },
    ]);
  });
  it('빈 목록은 빈 묶음', () => {
    expect(groupByYear([])).toEqual([]);
  });
  it('같은 구단이 이어지면 구단 이름은 처음 한 번만', () => {
    const items = [{ club: 'A' }, { club: 'A' }, { club: 'B' }];
    expect(items.map((_, i) => showClub(items, i))).toEqual([true, false, true]);
  });
});
