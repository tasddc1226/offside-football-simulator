import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { memberIntro, monetization, storeKrwOn } from './kpi-money.ts';
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

describe('T-11-774 멤버십 첫 달 할인 실험', () => {
  it('값이 있는 가장 최근 날의 합을 스토어 · 군별로 읽고, 대조군 가입은 인원 비율로 맞춘다', () => {
    const v = view([
      r('2026-11-15', 'member_intro', 'google_offer_new', 1),
      r('2026-11-16', 'member_intro', 'google_offer_new', 12),
      r('2026-11-16', 'member_intro', 'google_offer_off', 3),
      r('2026-11-16', 'member_intro', 'google_offer_due', 4),
      r('2026-11-16', 'member_intro', 'google_offer_kept', 3),
      r('2026-11-16', 'member_intro', 'google_control_new', 2),
      r('2026-11-16', 'member_intro', 'apple_offer_new', 30),
    ]);
    const m = memberIntro(v)!;
    expect(m.day).toBe('2026-11-16');
    expect(m.groups.map((g) => `${g.store}_${g.key}`)).toEqual([
      'google_offer',
      'google_control',
      'apple_offer',
      'apple_control',
    ]);
    expect(m.groups[0]).toEqual({
      store: 'google',
      key: 'offer',
      joined: 12,
      joinedScaled: 12,
      off: 3,
      due: 4,
      kept: 3,
      keptRate: 0.75,
    });
    expect(m.groups[1]).toMatchObject({ joined: 2, joinedScaled: 8, keptRate: null });
    expect(m.groups[2]).toMatchObject({ joined: 30 });
    expect(m.groups[3]).toMatchObject({ joined: 0, joinedScaled: 0 });
  });

  it('수집된 날이 없으면 null', () => {
    expect(memberIntro(view([r('2026-11-15', 'members_new', 'apple', 1)]))).toBeNull();
  });
});
