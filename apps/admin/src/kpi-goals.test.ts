import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { goalWeeks, weekStart } from './kpi-goals.ts';
import { viewOf } from './kpi-page.ts';

const range = (from: string, to: string) => {
  const out: string[] = [];
  for (let ms = Date.parse(from); ms <= Date.parse(to); ms += 86_400_000)
    out.push(new Date(ms).toISOString().slice(0, 10));
  return out;
};
const view = (days: string[], rows: KpiReport['rows']) =>
  viewOf({ generatedAt: '', days, rows, sources: [] });
const r = (day: string, metric: string, dim: string, value: number) => ({
  day,
  metric,
  dim,
  value,
});

describe('T-11-793 60일 목표 주간 표', () => {
  it('주는 월요일에 시작한다', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16');
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
    // 달 · 해를 넘는 주
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
  });

  it('월~일로 묶어 최근 주부터 돌려주고, 앞이 잘린 첫 주는 뺀다', () => {
    // 11-05(목)부터 11-22(일)까지: 11-05~08은 잘린 주라 빠진다.
    const v = view(range('2026-11-05', '2026-11-22'), [
      r('2026-11-06', 'iap_krw', 'apple', 99999),
      r('2026-11-09', 'iap_krw', 'apple', 1000),
      r('2026-11-15', 'ad_free_krw', 'google', 2000),
      r('2026-11-16', 'iap_krw', 'google', 500),
      r('2026-11-22', 'pass_krw', 'apple', 700),
    ]);
    const weeks = goalWeeks(v);
    expect(weeks.map((w) => [w.start, w.end, w.days, w.open, w.storeKrw])).toEqual([
      ['2026-11-16', '2026-11-22', 7, false, 1200],
      ['2026-11-09', '2026-11-15', 7, false, 3000],
    ]);
  });

  it('스토어 매출은 멤버십을 정가로 더하고, 광고 수익 · 새 가입 · 가입을 따로 더한다', () => {
    const days = range('2026-11-09', '2026-11-15');
    const v = view(days, [
      ...days.map((d) => r(d, 'iap_krw', 'apple', 1000)),
      ...days.map((d) => r(d, 'ad_revenue_krw', 'ios', 300)),
      ...days.map((d) => r(d, 'signups', 'all', 100)),
      ...days.map((d) => r(d, 'signups', 'linked', 40)),
      r('2026-11-10', 'members_new', 'apple', 2),
      r('2026-11-11', 'members_new', 'google', 1),
      r('2026-11-12', 'members_renewed', 'apple', 1),
    ]);
    expect(goalWeeks(v)).toEqual([
      {
        start: '2026-11-09',
        end: '2026-11-15',
        days: 7,
        open: false,
        storeKrw: 7000 + 4 * 4900,
        adKrw: 2100,
        membersNew: 3,
        signups: 700,
        missing: { store: 0, ad: 0 },
      },
    ]);
  });

  it('값이 없는 날을 세고, 하루도 없으면 합은 null', () => {
    const v = view(range('2026-11-09', '2026-11-15'), [
      r('2026-11-09', 'iap_krw', 'apple', 1000),
      r('2026-11-10', 'iap_krw', 'apple', 0),
      r('2026-11-12', 'ad_revenue_krw', 'ios', 300),
    ]);
    const [w] = goalWeeks(v);
    expect(w).toMatchObject({
      storeKrw: 1000,
      adKrw: 300,
      membersNew: null,
      signups: null,
      missing: { store: 5, ad: 6 },
    });
  });

  it('끝나지 않은 주는 지난 날만 세고 open으로 표시한다', () => {
    // 11-19(목)까지 수집됐다.
    const v = view(range('2026-11-09', '2026-11-19'), [
      r('2026-11-16', 'iap_krw', 'apple', 1000),
      r('2026-11-17', 'iap_krw', 'apple', 1000),
      r('2026-11-19', 'iap_krw', 'apple', 1000),
    ]);
    const [open, done] = goalWeeks(v);
    expect(open).toMatchObject({
      start: '2026-11-16',
      end: '2026-11-22',
      days: 4,
      open: true,
      storeKrw: 3000,
      missing: { store: 1, ad: 4 },
    });
    expect(done).toMatchObject({ start: '2026-11-09', days: 7, open: false, storeKrw: null });
  });

  it('날짜가 없으면 빈 배열', () => {
    expect(goalWeeks(view([], []))).toEqual([]);
  });
});
