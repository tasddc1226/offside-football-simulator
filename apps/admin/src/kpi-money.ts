// T-11-739 사용자당 매출 · 결제 전환. 모두 일일 수집(kpi_daily) 값으로 계산한다.
import { MEMBERSHIP_INTRO_CONTROL_PCT, MEMBERSHIP_PRICE_KRW } from '@offside/contracts/membership';
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

export type MemberIntroGroup = {
  store: 'google' | 'apple';
  key: 'offer' | 'control';
  /** 실험 시작 뒤 그 스토어에서 처음 구독한 사람. */
  joined: number;
  /** 두 군의 인원 비율(80:20)을 맞춘 가입 수. 할인군은 그대로, 대조군은 4배. */
  joinedScaled: number;
  /** 자동 갱신을 끈 가입. */
  off: number;
  /** 둘째 달 결제일이 지난 가입 · 그중 둘째 달을 결제한 가입. */
  due: number;
  kept: number;
  keptRate: number | null;
};

/**
 * T-11-774 멤버십 첫 달 할인 실험. `member_intro`는 지금까지의 합이라 기간 안에서 값이 있는 가장 최근 날을 읽는다.
 * 아직 수집된 날이 없으면 null. Android가 먼저다(대조군이 정상가로 결제하는 쪽).
 */
export function memberIntro(v: KpiView): { day: string; groups: MemberIntroGroup[] } | null {
  const day = v.days.findLast((d) => valueOn(v.idx, d, 'member_intro') !== null);
  if (!day) return null;
  const at = (dim: string) => valueOn(v.idx, day, 'member_intro', [dim]) ?? 0;
  const scale = (100 - MEMBERSHIP_INTRO_CONTROL_PCT) / MEMBERSHIP_INTRO_CONTROL_PCT;
  const groups = (['google', 'apple'] as const).flatMap((store) =>
    (['offer', 'control'] as const).map((key) => {
      const joined = at(`${store}_${key}_new`);
      const due = at(`${store}_${key}_due`);
      const kept = at(`${store}_${key}_kept`);
      return {
        store,
        key,
        joined,
        joinedScaled: key === 'control' ? joined * scale : joined,
        off: at(`${store}_${key}_off`),
        due,
        kept,
        keptRate: due ? kept / due : null,
      };
    }),
  );
  return { day, groups };
}
