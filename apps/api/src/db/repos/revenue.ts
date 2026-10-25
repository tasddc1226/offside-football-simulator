import { IAP_PRICE_KRW, REMOVE_ADS_PRODUCT, type AdminRevenue } from '@offside/contracts';
import type { Db } from '../client.js';

// T-11-263 운영 도구 매출. 소모성은 iap_purchases(테스트 결제 뺀), 광고 제거(비소모성)는 서버 구매 기록이 없어 스토어 알림
// (billing_alerts)으로 센다. 금액은 상품별 한국 정가(IAP_PRICE_KRW) 기준 추정이다(스토어 환산·수수료 전).
// T-11-484 광고 제거는 분석 동의한 구매만 서버 원장(iap_ad_free_purchases)에 남아 스토어 판매의 1%도 안 된다. 그래서
// 알림을 기간 · 날짜 · 스토어 · 전체 기간으로 나눠 따로 보인다(소모성 합과 섞지 않는다).

const RECENT_LIMIT = 30;
const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;

// 상품 id → 정가. 값은 코드 상수(숫자)라 SQL에 그대로 넣는다.
const PRICE_SQL = `CASE product_id ${Object.entries(IAP_PRICE_KRW)
  .map(([id, krw]) => `WHEN '${id}' THEN ${Math.trunc(krw)}`)
  .join(' ')} ELSE 0 END`;
const KST_DAY = `substr(datetime(created_at, '+9 hours'), 1, 10)`;

/** 오늘(KST)을 포함한 최근 days일의 KST 날짜와 시작 시각(UTC ISO). */
export function kstWindow(now: Date, days: number) {
  const todayKst = Math.floor((now.getTime() + KST_MS) / DAY_MS) * DAY_MS;
  const first = todayKst - (days - 1) * DAY_MS;
  return {
    start: new Date(first - KST_MS).toISOString(),
    days: Array.from({ length: days }, (_, i) =>
      new Date(first + i * DAY_MS).toISOString().slice(0, 10),
    ),
  };
}

type Sum = { count: number; krw: number };
const num = (v: unknown) => Number(v ?? 0);

type AdSum = { count: number; refunds: number };

/** 광고 제거 알림(스토어 · 종류 · 기간 안 KST 날짜별 건수, 기간 밖은 날짜 '')을 기간 · 전체 · 스토어 · 날짜로 모은다. */
function adSums(rows: Record<string, unknown>[]) {
  const window: AdSum = { count: 0, refunds: 0 };
  const allTime: AdSum = { count: 0, refunds: 0 };
  const stores = new Map<string, AdSum>();
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = row.kind === 'refund' ? 'refunds' : 'count';
    const n = num(row.n);
    const day = row.day as string;
    allTime[key] += n;
    if (!day) continue;
    window[key] += n;
    const store = row.store as string;
    const s = stores.get(store) ?? { count: 0, refunds: 0 };
    s[key] += n;
    stores.set(store, s);
    if (key === 'count') byDay.set(day, (byDay.get(day) ?? 0) + n);
  }
  return { window, allTime, stores, byDay };
}

export async function revenueReport(db: Db, now: Date, days: number): Promise<AdminRevenue> {
  const d1 = db.$client;
  const { start, days: dayList } = kstWindow(now, days);
  const live = `test = 0 AND refunded_at IS NULL`;
  const [total, first, refunds, allTime, daily, products, stores, ads, adsSince, recent] =
    await d1.batch<Record<string, unknown>>([
      d1
        .prepare(
          `SELECT count(*) count, coalesce(sum(${PRICE_SQL}), 0) krw, count(DISTINCT profile_id) buyers
           FROM iap_purchases WHERE ${live} AND created_at >= ?`,
        )
        .bind(start),
      d1
        .prepare(
          `SELECT count(*) n FROM (SELECT min(created_at) f FROM iap_purchases WHERE test = 0 GROUP BY profile_id)
          WHERE f >= ?`,
        )
        .bind(start),
      d1
        .prepare(
          `SELECT count(*) count, coalesce(sum(${PRICE_SQL}), 0) krw FROM iap_purchases
          WHERE test = 0 AND refunded_at >= ?`,
        )
        .bind(start),
      d1.prepare(
        `SELECT count(*) count, coalesce(sum(${PRICE_SQL}), 0) krw, count(DISTINCT profile_id) buyers
         FROM iap_purchases WHERE ${live}`,
      ),
      d1
        .prepare(
          `SELECT ${KST_DAY} day, count(*) count, sum(${PRICE_SQL}) krw FROM iap_purchases
          WHERE ${live} AND created_at >= ? GROUP BY 1`,
        )
        .bind(start),
      d1
        .prepare(
          `SELECT product_id productId, coalesce(sum(refunded_at IS NULL), 0) count,
                coalesce(sum(CASE WHEN refunded_at IS NULL THEN ${PRICE_SQL} END), 0) krw,
                coalesce(sum(refunded_at IS NOT NULL), 0) refunded
           FROM iap_purchases WHERE test = 0 AND created_at >= ? GROUP BY 1 ORDER BY krw DESC`,
        )
        .bind(start),
      d1
        .prepare(
          `SELECT store, count(*) count, sum(${PRICE_SQL}) krw FROM iap_purchases
          WHERE ${live} AND created_at >= ? GROUP BY 1 ORDER BY krw DESC`,
        )
        .bind(start),
      d1
        .prepare(
          `SELECT store, kind, CASE WHEN created_at >= ?2 THEN ${KST_DAY} ELSE '' END day, count(*) n
           FROM billing_alerts WHERE test = 0 AND product_id = ?1 AND kind IN ('purchase', 'refund')
          GROUP BY 1, 2, 3`,
        )
        .bind(REMOVE_ADS_PRODUCT, start),
      d1.prepare(`SELECT min(created_at) since FROM billing_alerts WHERE test = 0`),
      d1
        .prepare(
          `SELECT i.store, i.product_id productId, i.profile_id profileId, p.nickname, i.created_at createdAt,
                i.refunded_at refundedAt
           FROM iap_purchases i LEFT JOIN profiles p ON p.id = i.profile_id
          WHERE i.test = 0 ORDER BY i.created_at DESC LIMIT ?`,
        )
        .bind(RECENT_LIMIT),
    ]);
  const t = total!.results[0]!;
  const r = refunds!.results[0]!;
  const a = allTime!.results[0]!;
  const byDay = new Map(daily!.results.map((d) => [d.day as string, d]));
  const sum = (row: Record<string, unknown> | undefined): Sum => ({
    count: num(row?.count),
    krw: num(row?.krw),
  });
  const ad = adSums(ads!.results);
  const adPrice = IAP_PRICE_KRW[REMOVE_ADS_PRODUCT];
  const adKrw = (s: AdSum) => Math.max(0, s.count - s.refunds) * adPrice;
  return {
    generatedAt: now.toISOString(),
    days,
    total: {
      ...sum(t),
      buyers: num(t.buyers),
      firstBuyers: num(first!.results[0]?.n),
      refunds: num(r.count),
      refundKrw: num(r.krw),
    },
    allTime: { ...sum(a), buyers: num(a.buyers) },
    daily: dayList.map((day) => {
      const adCount = ad.byDay.get(day) ?? 0;
      return { day, ...sum(byDay.get(day)), adCount, adKrw: adCount * adPrice };
    }),
    products: products!.results.map((p) => ({
      productId: p.productId as string,
      ...sum(p),
      refunded: num(p.refunded),
    })),
    stores: stores!.results.map((s) => ({ store: s.store as string, ...sum(s) })),
    removeAds: {
      ...ad.window,
      krw: adKrw(ad.window),
      since: (adsSince!.results[0]?.since as string | null) ?? null,
      allTime: { ...ad.allTime, krw: adKrw(ad.allTime) },
      stores: [...ad.stores].map(([store, s]) => ({ store, ...s })),
    },
    recent: recent!.results as AdminRevenue['recent'],
  };
}
