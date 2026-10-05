import { describe, expect, it } from 'vitest';
import { rnByLeague, rnClubName, rnDay } from './retiredWall.js';

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
