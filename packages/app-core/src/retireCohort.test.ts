import { cohortPoints, type RetireCohort } from '@offside/contracts/retire-cohort';
import { describe, expect, it } from 'vitest';
import { cohortText, cohortTotalsOf, cohortView } from './retireCohort.js';

// T-11-675 은퇴 동기 비교 판정.
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const cohort: RetireCohort = {
  season: 2,
  asOf: '2026-11-09T18:30:00.000Z',
  pos: {
    FW: {
      n: 1000,
      m: {
        goals: cohortPoints(range(1000)),
        score: cohortPoints(range(1000).map((i) => i * 10)),
        // 트로피: 900명이 0개, 100명이 1개 — 1개면 상위 10%.
        trophies: cohortPoints(range(1000).map((i) => (i >= 900 ? 1 : 0))),
      },
    },
    GK: { n: 150, m: {} },
  },
};
const totals = (o: Partial<Record<string, number>>) =>
  cohortTotalsOf({
    score: o.score ?? 0,
    peak: 0,
    totals: {
      apps: 0,
      goals: o.goals ?? 0,
      assists: 0,
      trophies: o.trophies ?? 0,
      awards: 0,
      caps: 0,
      ballon: 0,
    },
  });

describe('cohortView', () => {
  it('상위 50% 안의 기록만 자리가 좋은 순으로, 지점 사이 값은 낮은 지점으로 읽는다', () => {
    const v = cohortView(cohort, 'FW', totals({ goals: 993, score: 3000, trophies: 1 }))!;
    // 993골은 990골 지점(1%)으로 읽는다(실제 0.7%보다 좋게 말하지 않는다). 점수 3000은 하위라 뺀다.
    expect(v.lines.map((l) => [l.metric, l.top])).toEqual([
      ['goals', '1'],
      ['trophies', '10'],
    ]);
    expect(v).toMatchObject({ season: 2, pos: 'FW', n: 1000 });
  });

  it('1% 안은 소수 한 자리, 기록 수는 max까지', () => {
    const v = cohortView(cohort, 'FW', totals({ goals: 999, score: 9990, trophies: 1 }), 2)!;
    expect(v.lines.map((l) => l.top)).toEqual(['0.1', '0.1']);
  });

  it('분포가 없거나 · 인원이 적거나 · 드는 기록이 없거나 · 0이면 null', () => {
    expect(cohortView(null, 'FW', totals({ goals: 999 }))).toBeNull();
    expect(cohortView(cohort, 'GK', totals({ goals: 999 }))).toBeNull();
    expect(cohortView(cohort, 'MF', totals({ goals: 999 }))).toBeNull();
    expect(cohortView(cohort, 'FW', totals({ goals: 100 }))).toBeNull();
    expect(cohortView(cohort, 'FW', totals({}))).toBeNull();
  });

  it('화면 문구', () => {
    const t = cohortText(cohortView(cohort, 'FW', totals({ goals: 993 }))!);
    expect(t.title).toBe('시즌 2에 은퇴한 공격수 1,000명 중에서');
    expect(t.lines).toEqual([{ metric: 'goals', label: '통산 골', value: '993', top: '상위 1%' }]);
  });
});
