import { describe, expect, it } from 'vitest';
import { rankSlideSpan } from './resultTour';

const rows = (ranks: (number | null)[], me: number) =>
  ranks.map((r) => (r === null ? {} : { rank: r, me: r === me }));

describe('rankSlideSpan', () => {
  it('오른 순위: 이전 순위 자리(아래)에서 지금 자리로', () => {
    expect(rankSlideSpan(rows([1, 2, 3, 4, 5, 6], 2), 5, 2)).toEqual({ me: 1, from: 4, up: true });
  });
  it('내린 순위: 이전 순위 자리(위)에서 지금 자리로', () => {
    expect(rankSlideSpan(rows([1, 2, 3, 4, 5, 6], 5), 2, 5)).toEqual({ me: 4, from: 1, up: false });
  });
  it('접힌 표에서는 보이는 줄 안에서 이전 순위에 가장 가까운 자리까지', () => {
    // 1 2 3 ⋯ 10 11 [12] — 2위에서 12위로
    expect(rankSlideSpan(rows([1, 2, 3, null, 10, 11, 12], 12), 2, 12)).toEqual({
      me: 6,
      from: 1,
      up: false,
    });
  });
  it('변동이 없거나 내 팀이 없으면 null', () => {
    expect(rankSlideSpan(rows([1, 2, 3], 2), 2, 2)).toBeNull();
    expect(rankSlideSpan(rows([1, 2, 3], 9), 3, 1)).toBeNull();
  });
});
