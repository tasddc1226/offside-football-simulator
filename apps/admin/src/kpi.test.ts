import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import {
  dimSeries,
  fmt,
  fmtChange,
  indexRows,
  nonEmpty,
  tableOf,
  tile,
  toCsv,
  totalOn,
  valueOn,
} from './kpi.ts';

const days = Array.from({ length: 8 }, (_, i) => `2026-10-${String(20 + i).padStart(2, '0')}`);
const report: KpiReport = {
  generatedAt: '2026-10-29T00:00:00.000Z',
  days,
  rows: [
    { day: '2026-10-20', metric: 'iap_krw', dim: 'google', value: 1000 },
    { day: '2026-10-27', metric: 'iap_krw', dim: 'google', value: 1100 },
    { day: '2026-10-27', metric: 'iap_krw', dim: 'apple', value: 400 },
    { day: '2026-10-27', metric: 'pass_krw', dim: 'apple', value: 9900 },
    { day: '2026-10-27', metric: 'signups', dim: 'all', value: 10 },
  ],
  sources: [],
};

describe('kpi 화면 모양 (T-11-572)', () => {
  const idx = indexRows(report);

  it('나눔을 골라 더하고, 기록이 없는 날은 0이 아니라 null', () => {
    expect(valueOn(idx, '2026-10-27', 'iap_krw')).toBe(1500);
    expect(valueOn(idx, '2026-10-27', 'iap_krw', ['apple'])).toBe(400);
    expect(valueOn(idx, '2026-10-21', 'iap_krw')).toBeNull();
    expect(totalOn(idx, '2026-10-27', ['iap_krw', 'pass_krw', 'ad_revenue_krw'])).toBe(11400);
    expect(totalOn(idx, '2026-10-21', ['iap_krw'])).toBeNull();
  });

  it('마지막 날을 7일 전 같은 요일과 비교한다', () => {
    const t = tile(days, (d) => valueOn(idx, d, 'iap_krw'));
    expect(t).toEqual({ value: 1500, prev: 1000, change: 0.5 });
    expect(fmtChange(t.change)).toBe('+50%');
    expect(tile(days.slice(1), (d) => valueOn(idx, d, 'iap_krw')).change).toBeNull();
  });

  it('빈 줄은 빼고, 표 · CSV는 날짜 × 지표|나눔', () => {
    const s = dimSeries(idx, days, 'iap_krw', [
      { dim: 'google', label: 'Android' },
      { dim: 'xsolla', label: '웹 결제' },
    ]);
    expect(nonEmpty(s).map((x) => x.key)).toEqual(['google']);
    expect(tableOf(report).cols).toEqual([
      'iap_krw|apple',
      'iap_krw|google',
      'pass_krw|apple',
      'signups|all',
    ]);
    expect(toCsv(report).split('\n')[8]).toBe('2026-10-27,400,1100,9900,10');
  });

  it('숫자 표기', () => {
    expect(fmt(null)).toBe('—');
    expect(fmt(12345, 'krw')).toBe('₩12,345');
    expect(fmt(0.123, 'pct')).toBe('12.3%');
  });
});
