import { describe, expect, it } from 'vitest';
import { managerTrustScore, qualitativeScore, tacticalFitScore } from './qualitative-scale.js';

describe('qualitative score scale', () => {
  it('uses one deterministic 0..100 five-tier scale', () => {
    expect([0, 20, 40, 60, 80, 100].map((value) => qualitativeScore(value).label)).toEqual([
      '매우 낮음',
      '낮음',
      '보통',
      '높음',
      '매우 높음',
      '매우 높음',
    ]);
    expect(managerTrustScore(62)).toEqual(tacticalFitScore(62));
    expect(qualitativeScore(-4).value).toBe(0);
    expect(qualitativeScore(104).value).toBe(100);
  });
});
