import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { monetization, storeKrwOn } from './kpi-money.ts';
import { viewOf } from './kpi-page.ts';

const view = (rows: KpiReport['rows']) =>
  viewOf({ generatedAt: '', days: ['2026-11-15', '2026-11-16'], rows, sources: [] });
const r = (day: string, metric: string, dim: string, value: number) => ({
  day,
  metric,
  dim,
  value,
});

describe('T-11-739 사용자당 매출 · 결제 전환', () => {
  it('스토어 매출에 멤버십 새 가입 · 갱신을 정가로 더한다', () => {
    const v = view([
      r('2026-11-15', 'iap_krw', 'apple', 10000),
      r('2026-11-15', 'members_new', 'apple', 1),
      r('2026-11-15', 'members_renewed', 'google', 1),
    ]);
    expect(storeKrwOn(v, '2026-11-15')).toBe(10000 + 2 * 4900);
    expect(storeKrwOn(v, '2026-11-16')).toBeNull();
  });

  it('DAU가 있는 날만 합으로 계산하고, GA4가 없으면 운영 DB 접속을 쓴다', () => {
    const v = view([
      r('2026-11-15', 'dau', 'ios', 800),
      r('2026-11-15', 'dau', 'android', 200),
      r('2026-11-15', 'iap_krw', 'apple', 50000),
      r('2026-11-15', 'iap_buyers', 'apple', 20),
      r('2026-11-15', 'ad_revenue_krw', 'ios', 30000),
      r('2026-11-16', 'active', 'app', 500),
      r('2026-11-16', 'iap_krw', 'google', 10000),
      r('2026-11-16', 'iap_buyers', 'google', 5),
    ]);
    const m = monetization(v);
    expect(m.arpdauStore).toEqual([50, 20]);
    expect(m.arpdauAd).toEqual([30, null]);
    expect(m.payerRate).toEqual([0.02, 0.01]);
    expect(m.period).toEqual({
      arpdau: 90000 / 1500,
      payerRate: 25 / 1500,
      arppu: 60000 / 25,
      days: 2,
    });
  });
});
