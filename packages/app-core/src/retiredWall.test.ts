import { describe, expect, it } from 'vitest';
import { rnByLeague, rnClubName, rnDay, rnFreeNumbers } from './retiredWall.js';

describe('영구결번 벽', () => {
  it('구단 이름은 게임 기본 이름을 먼저 쓰고, 모르는 구단이면 기록된 이름', () => {
    expect(rnClubName({ clubId: 'zz-unknown', club: '내 구단' })).toBe('내 구단');
  });

  it('날짜는 연.월.일(앞자리 0 없음)', () => {
    expect(rnDay(new Date(2026, 0, 5, 12).toISOString())).toBe('2026.1.5');
  });
});

describe('rnByLeague (T-11-101)', () => {
  it('결번이 많은 리그 먼저, 리그 안에서는 받은 순서, 모르는 구단은 기타', () => {
    const groups = rnByLeague([
      { clubId: 'pl-0', count: 5 },
      { clubId: 'll-0', count: 4 },
      { clubId: 'll-1', count: 3 },
      { clubId: 'pl-1', count: 1 },
      { clubId: 'zz-0', count: 1 },
    ]);
    expect(groups.map((g) => [g.count, g.clubs.map((c) => c.clubId)])).toEqual([
      [7, ['ll-0', 'll-1']],
      [6, ['pl-0', 'pl-1']],
      [1, ['zz-0']],
    ]);
    expect(groups.at(-1)!.league).toBe('기타');
  });
});

describe('rnFreeNumbers (T-11-356)', () => {
  it('결번이 없으면 1~99 전부', () => {
    const free = rnFreeNumbers([]);
    expect(free).toHaveLength(99);
    expect([free[0], free.at(-1)]).toEqual([1, 99]);
  });
  it('결번을 빼고 작은 번호 먼저, 범위 밖 번호는 무시', () => {
    const free = rnFreeNumbers([{ number: 7 }, { number: 1 }, { number: 0 }, { number: 7 }]);
    expect(free).toHaveLength(97);
    expect(free.slice(0, 6)).toEqual([2, 3, 4, 5, 6, 8]);
  });
  it('모두 결번이면 빈 목록', () => {
    expect(rnFreeNumbers(Array.from({ length: 99 }, (_, i) => ({ number: i + 1 })))).toEqual([]);
  });
});
