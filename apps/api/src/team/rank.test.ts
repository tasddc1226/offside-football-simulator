import { rankPoints, ratingChange } from '@offside/contracts/owner-team';
import { describe, expect, it } from 'vitest';
import { matchRatingChange, nearestCandidates, pickCandidate } from './rank.js';

describe('T-11-510 랭크 경기 점수 · 자동 매칭', () => {
  it('시즌 1까지는 엘로, 시즌 2부터 RP(받은 쪽은 깎일 때 절반)', () => {
    const home = { rating: 1100, division: 2 };
    const away = { rating: 1150, division: 2 };
    expect(matchRatingChange(1, home, away, 1, 0, 0.75)).toEqual(ratingChange(1100, 1150, 1, 0));
    expect(matchRatingChange(2, home, away, 1, 0, 0.75)).toEqual({
      home: rankPoints(1100, 1150, 1, 2),
      away: rankPoints(1150, 1100, 0, 2, true),
    });
    const lost = matchRatingChange(2, home, away, 1, 0, 0.75).away;
    // 세미프로 I 감점 15, 약한 상대에게 져 보정 −2 → −17, 받은 경기라 절반(−8.5 → −8).
    expect(lost).toBe(-8);
  });

  it('T-11-807 시즌 3부터 받은 쪽 패배는 밸런스 배율, 무승부는 절반 그대로', () => {
    const home = { rating: 1100, division: 2 };
    const away = { rating: 1150, division: 2 };
    // 같은 경기(−17)를 시즌 2는 절반(−8), 시즌 3은 0.75배(−12.75 → −13).
    expect(matchRatingChange(3, home, away, 1, 0, 0.75).away).toBe(-13);
    expect(matchRatingChange(3, home, away, 1, 0, 1).away).toBe(-17);
    expect(matchRatingChange(3, home, away, 1, 0, 0.5).away).toBe(-8);
    // 이긴 쪽 · 건 쪽은 그대로다.
    expect(matchRatingChange(3, home, away, 1, 0, 0.75).home).toBe(rankPoints(1100, 1150, 1, 2));
    expect(matchRatingChange(3, home, away, 0, 0, 0.75)).toEqual({
      home: rankPoints(1100, 1150, 0, 2),
      away: rankPoints(1150, 1100, 1, 2, true),
    });
    // 받은 쪽 무승부는 시즌 3에도 절반이라 RP가 크게 높아도 잃지 않는다(−1 × 0.5 → 0).
    const high = { rating: 1400, division: 3 };
    expect(matchRatingChange(3, home, high, 0.5, 0, 1).away).toBe(0);
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
