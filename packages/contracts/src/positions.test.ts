import { describe, expect, it } from 'vitest';
import { legendTerms, type LegendTotals } from './hof-rules.js';
import { DETAIL_GROUP, DETAIL_POSITIONS, DETAILS_OF, detailPosOpen } from './positions.js';

describe('세부 포지션 (T-10-091)', () => {
  it('세부 포지션 8종은 모두 큰 포지션 하나에 속하고, 큰 포지션 목록과 겹치지 않는다', () => {
    const listed = Object.values(DETAILS_OF).flat();
    expect([...listed].sort()).toEqual([...DETAIL_POSITIONS].sort());
    for (const [g, ds] of Object.entries(DETAILS_OF))
      for (const d of ds) expect(DETAIL_GROUP[d]).toBe(g);
  });

  it('시즌 1 개막(2026-10-06 0시 KST)부터 고를 수 있다', () => {
    expect(detailPosOpen('2026-10-05T14:59:59.999Z')).toBe(false);
    expect(detailPosOpen('2026-10-05T15:00:00.000Z')).toBe(true);
  });

  it('레전드 점수는 윙어·수비형 미드필더만 가중을 보정한다', () => {
    const t: LegendTotals = {
      goals: 100,
      assists: 100,
      cs: 0,
      apps: 0,
      trophies: 0,
      awards: 0,
      caps: 0,
      peak: 0,
      ballon: 0,
      ballonRankPoints: 0,
      worldCups: 0,
    };
    expect(legendTerms('FW', t, 'ST')).toEqual(legendTerms('FW', t));
    expect(legendTerms('FW', t, null)).toEqual(legendTerms('FW', t));
    expect(legendTerms('FW', t, 'W').assists).toBeGreaterThan(legendTerms('FW', t).assists);
    expect(legendTerms('MF', t, 'DM').goals).toBeGreaterThan(legendTerms('MF', t).goals);
  });
});
