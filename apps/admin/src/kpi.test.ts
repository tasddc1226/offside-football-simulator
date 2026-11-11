import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import {
  dimTotals,
  EXPECTED_METRICS,
  laggingMetrics,
  lastDims,
  lastValue,
  periodTotal,
  retention,
  trendOf,
  viewOf,
} from './kpi-page.ts';
import {
  dimLabel,
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

  it('국가 코드 이름표 · 기간 나눔 합 · 재방문 가중 평균 (T-11-577)', () => {
    expect(dimLabel('jp')).toBe('일본');
    expect(dimLabel('ios')).toBe('iOS');
    const rep: KpiReport = {
      generatedAt: '2026-10-29T00:00:00.000Z',
      days: ['2026-10-26', '2026-10-27', '2026-10-28'],
      sources: [],
      rows: [
        { day: '2026-10-26', metric: 'ad_spend_country_krw', dim: 'jp', value: 100 },
        { day: '2026-10-27', metric: 'ad_spend_country_krw', dim: 'jp', value: 50 },
        { day: '2026-10-27', metric: 'ad_spend_country_krw', dim: 'kr', value: 200 },
        { day: '2026-10-26', metric: 'retention_cohort', dim: 'all', value: 100 },
        { day: '2026-10-26', metric: 'd1_retained', dim: 'all', value: 30 },
        { day: '2026-10-27', metric: 'retention_cohort', dim: 'all', value: 300 },
        { day: '2026-10-27', metric: 'd1_retained', dim: 'all', value: 30 },
      ],
    };
    const v = viewOf(rep);
    expect(dimTotals(v, 'ad_spend_country_krw')).toEqual([
      { dim: 'kr', value: 200 },
      { dim: 'jp', value: 150 },
    ]);
    // 날마다 비율 평균(20%)이 아니라 사람 수로 가중(60/400).
    expect(retention(v, 1)).toEqual({ rate: 0.15, cohorts: 2 });
    expect(retention(v, 7)).toEqual({ rate: null, cohorts: 0 });
  });
});

describe('지금 상태 지표 · 늦는 지표 (T-11-693)', () => {
  const span = [
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
    '2026-11-07',
    '2026-11-08',
    '2026-11-09',
    '2026-11-10',
  ];
  const row = (day: string, metric: string, dim: string, value: number) => ({
    day,
    metric,
    dim,
    value,
  });
  const make = (rows: KpiReport['rows']): KpiReport => ({
    generatedAt: '2026-11-11T00:00:00.000Z',
    days: span,
    rows,
    sources: [],
  });
  /** 모든 지표가 어제까지 들어온 상태에서 일부만 빼거나 늦춘다. */
  const fresh = (skip: (metric: string, dim: string) => string | null) =>
    make(
      EXPECTED_METRICS.flatMap((e) => {
        const dim = e.dim ?? 'all';
        const day = skip(e.metric, dim);
        return day ? [row(day, e.metric, dim, 1)] : [];
      }),
    );

  it('마지막으로 들어온 값과 그날의 나눔을 돌려준다', () => {
    const v = viewOf(
      make([
        row('2026-11-08', 'push_devices', 'ios:authorized', 10),
        row('2026-11-09', 'push_devices', 'ios:authorized', 12),
        row('2026-11-09', 'push_devices', 'ios:provisional', 30),
        row('2026-11-09', 'push_devices', 'android:authorized', 0),
        row('2026-11-05', 'push_clicked', 'match', 3),
        row('2026-11-06', 'push_clicked', 'cup', 4),
      ]),
    );
    expect(lastValue(v, 'push_devices', ['ios:authorized'])).toEqual({
      day: '2026-11-09',
      value: 12,
    });
    expect(lastValue(v, 'followers')).toBeNull();
    expect(lastDims(v, 'push_devices')).toEqual({
      day: '2026-11-09',
      items: [
        { dim: 'ios:provisional', value: 30 },
        { dim: 'ios:authorized', value: 12 },
      ],
    });
    expect(periodTotal(v, 'push_clicked')).toBe(7);
    expect(periodTotal(v, 'push_clicked', ['cup'])).toBe(4);
    expect(periodTotal(v, 'chat')).toBeNull();
    expect(trendOf(v, 'push_clicked')).toEqual([null, 3, 4, null, null, null, null]);
  });

  it('다 들어왔으면 비고, 원래 늦는 지표는 기다리는 날 수 안에서 넘어간다', () => {
    expect(laggingMetrics(viewOf(fresh(() => '2026-11-10')))).toEqual([]);
    // Play 설치는 5일까지 기다린다. 6일 밀리면 알린다.
    const waiting = fresh((m, d) =>
      m === 'store_installs' && d === 'android' ? '2026-11-05' : '2026-11-10',
    );
    expect(laggingMetrics(viewOf(waiting))).toEqual([]);
    const late = fresh((m, d) =>
      m === 'store_installs' && d === 'android' ? '2026-11-04' : '2026-11-10',
    );
    expect(laggingMetrics(viewOf(late))).toMatchObject([
      { metric: 'store_installs', dim: 'android', lastDay: '2026-11-04', lag: 6 },
    ]);
  });

  it('한 원천 안에서 지표 하나만 끊겨도, 기간 안에 한 번도 없어도 잡는다', () => {
    const v = viewOf(
      fresh((m, d) =>
        m === 'store_installs' && d === 'android'
          ? null
          : m === 'dau'
            ? '2026-11-09'
            : '2026-11-10',
      ),
    );
    expect(laggingMetrics(v).map((x) => [x.metric, x.dim ?? '', x.lag])).toEqual([
      ['dau', '', 1],
      ['store_installs', 'android', null],
    ]);
  });
});
