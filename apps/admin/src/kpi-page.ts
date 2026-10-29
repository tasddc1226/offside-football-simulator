// T-11-577 kpi_daily(일일 수집) 화면 공용: 보고서 색인 · 나눔별 계열.
import type { KpiReport } from '@offside/contracts';
import { dimSeries, dimsOf, indexRows, nonEmpty, type Index } from './kpi.ts';

export type KpiView = { report: KpiReport; idx: Index; days: string[] };
export const viewOf = (report: KpiReport): KpiView => ({
  report,
  idx: indexRows(report),
  days: report.days,
});

/** 나눔(dim)별로 쌓은 계열. 값이 없으면 빈 배열(차트가 빈 글을 보인다). */
export const byDim = (v: KpiView, metric: string) =>
  nonEmpty(dimSeries(v.idx, v.days, metric, dimsOf(v.report, metric)));
