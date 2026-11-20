// T-11-739 사용자당 매출 · 결제 전환. 모두 일일 수집(kpi_daily) 값으로 계산한다.
import { MEMBERSHIP_PRICE_KRW } from '@offside/contracts/membership';
import { valueOn } from './kpi.ts';
import type { KpiView } from './kpi-page.ts';

/** 그날 스토어 매출(정가 추정) = 아이템 + 광고 제거 + 시즌 패스 + 첫 구매 묶음 + 멤버십(새 가입 · 갱신 × 정가). 하나도 없으면 null. */
export function storeKrwOn(v: KpiView, day: string) {
  const parts = ['iap_krw', 'ad_free_krw', 'pass_krw', 'starter_krw'].map((m) =>
    valueOn(v.idx, day, m),
  );
  const members = ['members_new', 'members_renewed'].map((m) => valueOn(v.idx, day, m));
  if ([...parts, ...members].every((x) => x === null)) return null;
  const sum = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
  return sum(parts) + sum(members) * MEMBERSHIP_PRICE_KRW;
}

/** DAU: GA4가 있으면 GA4, 없으면 운영 DB 접속 프로필(채널 합). */
export const dauOn = (v: KpiView, day: string) =>
  valueOn(v.idx, day, 'dau') ?? valueOn(v.idx, day, 'active');

export type Monetization = {
  /** 날짜별 DAU당 스토어 · 광고 매출(원). DAU가 없으면 null. */
  arpdauStore: (number | null)[];
  arpdauAd: (number | null)[];
  /** 날짜별 결제 전환(아이템 구매자 ÷ DAU). */
  payerRate: (number | null)[];
  /** 기간 합으로 낸 값(DAU가 있는 날만). */
  period: {
    arpdau: number | null;
    payerRate: number | null;
    /** 결제한 사람당 아이템 매출. */
    arppu: number | null;
    days: number;
  };
};

export function monetization(v: KpiView): Monetization {
  const arpdauStore: (number | null)[] = [];
  const arpdauAd: (number | null)[] = [];
  const payerRate: (number | null)[] = [];
  let dauSum = 0;
  let krwSum = 0;
  let buyerSum = 0;
  let iapSum = 0;
  let days = 0;
  for (const d of v.days) {
    const dau = dauOn(v, d);
    const store = storeKrwOn(v, d);
    const ad = valueOn(v.idx, d, 'ad_revenue_krw');
    const buyers = valueOn(v.idx, d, 'iap_buyers');
    if (!dau) {
      arpdauStore.push(null);
      arpdauAd.push(null);
      payerRate.push(null);
      continue;
    }
    arpdauStore.push(store === null ? null : store / dau);
    arpdauAd.push(ad === null ? null : ad / dau);
    payerRate.push((buyers ?? 0) / dau);
    dauSum += dau;
    krwSum += (store ?? 0) + (ad ?? 0);
    buyerSum += buyers ?? 0;
    iapSum += valueOn(v.idx, d, 'iap_krw') ?? 0;
    days++;
  }
  return {
    arpdauStore,
    arpdauAd,
    payerRate,
    period: {
      arpdau: dauSum ? krwSum / dauSum : null,
      payerRate: dauSum ? buyerSum / dauSum : null,
      arppu: buyerSum ? iapSum / buyerSum : null,
      days,
    },
  };
}
