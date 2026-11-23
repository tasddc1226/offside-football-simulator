import { describe, expect, it } from 'vitest';
import { CREST_PALETTE, CREST_VIEW, crestFx, crestStars } from './supporterCrest';

describe('T-11-819 서포터 휘장(별 방패)', () => {
  it('방패 위 별 개수가 단계를 나타낸다(1 없음 · 3 하나 · 6 둘 · 9 셋)', () => {
    expect(([1, 3, 6, 9] as const).map((t) => crestStars(t).length)).toEqual([0, 1, 2, 3]);
  });

  it('별은 그림 틀 안에 있고 단계마다 색이 다르다', () => {
    for (const t of [3, 6, 9] as const)
      for (const pts of crestStars(t))
        for (const xy of pts.split(' ')) {
          const [x, y] = xy.split(',').map(Number);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(CREST_VIEW.w);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(CREST_VIEW.h);
        }
    expect(new Set(Object.values(CREST_PALETTE).map((p) => p.base)).size).toBe(4);
  });

  it('효과는 단계가 오를수록 더해진다', () => {
    expect(crestFx(1)).toEqual({ shine: false, halo: false, spark: false, orbit: false });
    expect(crestFx(3)).toEqual({ shine: true, halo: false, spark: false, orbit: false });
    expect(crestFx(6)).toEqual({ shine: true, halo: true, spark: false, orbit: false });
    expect(crestFx(9)).toEqual({ shine: true, halo: true, spark: true, orbit: true });
  });
});
