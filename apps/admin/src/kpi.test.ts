import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import {
  dimSeries,
  fmt,
  fmtChange,
  indexRows,
  nonEmpty,
  periodSum,
  productLabel,
  ratio,
  sourceLag,
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

describe('이름표 (T-11-577)', () => {
  it('상품 id를 아이템 · 수량으로 읽는다', () => {
    expect(productLabel('com.offsidelab.app.reroll_40')).toBe('리롤권 ×40');
    expect(productLabel('com.offsidelab.app.remove_ads')).toBe('광고 제거');
    expect(productLabel('com.offsidelab.app.mystery_1')).toBe('mystery_1');
  });
  it('비율은 분모가 0이면 비교하지 않는다', () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(1, 0)).toBeNull();
  });
});

describe('빠진 날 (T-11-577)', () => {
  it('기간 합은 빠진 날 수를 같이 주고, 하루도 없으면 0이 아니라 null', () => {
    const v: Record<string, number | null> = { a: 3, b: null, c: 0 };
    expect(periodSum(['a', 'b', 'c'], (d) => v[d] ?? null)).toEqual({ sum: 3, missing: 1 });
    expect(periodSum(['b'], () => null)).toEqual({ sum: null, missing: 1 });
  });
  it('0만 들어온 계열은 빈 계열이 아니다', () => {
    expect(nonEmpty([{ key: 'z', label: 'z', values: [0, null] }])).toHaveLength(1);
    expect(nonEmpty([{ key: 'n', label: 'n', values: [null, null] }])).toHaveLength(0);
  });
  it('원천 지연은 어제와 마지막 행의 날짜 차이', () => {
    expect(sourceLag('2026-10-28', '2026-10-28')).toBe(0);
    expect(sourceLag('2026-10-26', '2026-10-28')).toBe(2);
    expect(sourceLag(undefined, '2026-10-28')).toBeNull();
  });
});
