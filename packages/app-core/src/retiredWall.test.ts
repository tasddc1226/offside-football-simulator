import { describe, expect, it } from 'vitest';
import { rnByClub, rnClubName, rnDay, rnRecent } from './retiredWall.js';

const it_ = (clubId: string, number: number, seq: number) => ({ clubId, number, seq });

describe('영구결번 벽', () => {
  it('구단별: 결번 많은 구단 먼저, 같으면 먼저 결번을 낸 구단, 구단 안은 번호 순', () => {
    const groups = rnByClub([
      it_('b', 9, 2),
      it_('a', 10, 5),
      it_('c', 7, 1),
      it_('a', 3, 4),
      it_('b', 1, 6),
    ]);
    expect(groups.map((g) => g.map((x) => `${x.clubId}${x.number}`))).toEqual([
      ['b1', 'b9'],
      ['a3', 'a10'],
      ['c7'],
    ]);
  });

  it('빈 목록은 빈 묶음', () => {
    expect(rnByClub([])).toEqual([]);
    expect(rnRecent([])).toEqual([]);
  });

  it('최신순은 순번 큰 것 먼저이고 원본 순서는 그대로 둔다', () => {
    const items = [it_('a', 1, 1), it_('a', 2, 3), it_('b', 3, 2)];
    expect(rnRecent(items).map((x) => x.seq)).toEqual([3, 2, 1]);
    expect(items.map((x) => x.seq)).toEqual([1, 3, 2]);
  });

  it('구단 이름은 게임 기본 이름을 먼저 쓰고, 모르는 구단이면 기록된 이름', () => {
    expect(rnClubName({ clubId: 'zz-unknown', club: '내 구단' })).toBe('내 구단');
  });

  it('날짜는 연.월.일(앞자리 0 없음)', () => {
    expect(rnDay(new Date(2026, 0, 5, 12).toISOString())).toBe('2026.1.5');
  });
});
