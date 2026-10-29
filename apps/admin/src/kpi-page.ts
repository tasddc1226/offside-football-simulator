// T-11-577 kpi_daily(일일 수집) 화면 공용: 보고서 색인 · 나눔별 계열.
import type { KpiReport } from '@offside/contracts';
import { dimSeries, dimsOf, indexRows, nonEmpty, valueOn, type Index } from './kpi.ts';

export type KpiView = { report: KpiReport; idx: Index; days: string[] };
export const viewOf = (report: KpiReport): KpiView => ({
  report,
  idx: indexRows(report),
  days: report.days,
});

/** 나눔(dim)별로 쌓은 계열. 값이 없으면 빈 배열(차트가 빈 글을 보인다). */
export const byDim = (v: KpiView, metric: string) =>
  nonEmpty(dimSeries(v.idx, v.days, metric, dimsOf(v.report, metric)));

/** 기간 안 나눔별 합(큰 순). 값이 한 번도 없는 나눔은 빠진다. */
export const dimTotals = (v: KpiView, metric: string) =>
  dimsOf(v.report, metric)
    .map(({ dim }) => ({
      dim,
      value: v.days.reduce((s, d) => s + (valueOn(v.idx, d, metric, [dim]) ?? 0), 0),
    }))
    .sort((a, b) => b.value - a.value);

/**
 * 기간 재방문(가중 평균) = 돌아온 사람 합 ÷ 그 코호트(첫 방문) 합. 값은 코호트 날짜(가입한 날)에 있어 D7은 일주일 늦게 찬다.
 * cohorts는 셀 수 있었던 코호트 날 수.
 */
export function retention(v: KpiView, n: 1 | 7) {
  let back = 0;
  let base = 0;
  let cohorts = 0;
  for (const d of v.days) {
    const r = valueOn(v.idx, d, `d${n}_retained`);
    const c = valueOn(v.idx, d, 'retention_cohort');
    if (r === null || !c) continue;
    back += r;
    base += c;
    cohorts++;
  }
  return { rate: base ? back / base : null, cohorts };
}
