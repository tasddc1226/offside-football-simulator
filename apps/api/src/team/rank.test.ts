import { rankPoints, ratingChange } from '@offside/contracts/owner-team';
import { describe, expect, it } from 'vitest';
import { matchRatingChange, nearestCandidates, pickCandidate } from './rank.js';

describe('T-11-510 랭크 경기 점수 · 자동 매칭', () => {
  it('시즌 1까지는 엘로, 시즌 2부터 RP(받은 쪽은 깎일 때 절반)', () => {
    const home = { rating: 1100, division: 2 };
    const away = { rating: 1150, division: 2 };
    expect(matchRatingChange(1, home, away, 1, 0)).toEqual(ratingChange(1100, 1150, 1, 0));
    expect(matchRatingChange(2, home, away, 1, 0)).toEqual({
      home: rankPoints(1100, 1150, 1, 2),
      away: rankPoints(1150, 1100, 0, 2, true),
    });
    const lost = matchRatingChange(2, home, away, 1, 0).away;
    // 세미프로 I 감점 15, 약한 상대에게 져 보정 −2 → −17, 받은 경기라 절반(−8.5 → −8).
    expect(lost).toBe(-8);
  });

  it('가까운 순은 |RP 차| + 2 × |OVR 차|, 같으면 id 순', () => {
    const list = [
      { id: 'c', rating: 1030, ovr: 80 },
      { id: 'a', rating: 1000, ovr: 90 },
      { id: 'b', rating: 1010, ovr: 80 },
      { id: 'd', rating: 1010, ovr: 80 },
    ];
    const near = nearestCandidates(list, { rating: 1000, ovr: 80 }, 3);
    expect(near.map((t) => t.id)).toEqual(['b', 'd', 'a']);
  });

  it('같은 시드면 같은 상대, 빈 후보면 없음', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(pickCandidate(list, 'p:1:0:0')).toBe(pickCandidate(list, 'p:1:0:0'));
    const picks = new Set([0, 1, 2, 3].map((n) => pickCandidate(list, `p:1:0:${n}`)));
    expect(picks.size).toBeGreaterThan(1);
    expect(pickCandidate([], 'x')).toBeUndefined();
  });
});
