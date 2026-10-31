import {
  IAP_PRICE_KRW,
  REMOVE_ADS_PRICE_SQL,
  REMOVE_ADS_PRODUCT,
  type AdminRevenue,
} from '@offside/contracts';
import { SEASON_PASS_PRODUCT_ID, SEASON_PASS_PRICE_KRW } from '@offside/contracts/season-pass';
import { MEMBERSHIP_PRODUCT_ID, MEMBERSHIP_PRICE_KRW } from '@offside/contracts/membership';
import type { Db } from '../client.js';

// 정가 추정 매출. 아이템 · 패스는 구매 원장, 멤버십(가입 · 갱신 · 환불)과 광고 제거는
// 중복 방지된 스토어 알림을 사용한다. 알림에는 구매자가 없으며 기록 시작 전 판매는 복원하지 않는다.
// total/allTime/daily.krw는 광고 제거 제외(이전 앱의 합산 계약 유지), 상세 목록은 모든 상품이다.
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
// 같은 구매의 원장과 알림을 함께 세지 않는다. 멤버십 상태 행은 갱신 때 덮어쓰므로 매출 원장으로 쓰지 않는다.
const PURCHASES = `WITH purchases AS (
  SELECT store, product_id, profile_id, created_at, refunded_at,
    CASE WHEN refunded_at IS NULL THEN 1 ELSE 0 END count,
    CASE WHEN refunded_at IS NULL THEN ${PRICE_SQL} ELSE 0 END krw,
    ${PRICE_SQL} refund_krw
  FROM iap_purchases WHERE test = 0
  UNION ALL
  SELECT store, '${SEASON_PASS_PRODUCT_ID}', profile_id, created_at, refunded_at,
    CASE WHEN refunded_at IS NULL THEN 1 ELSE 0 END,
    CASE WHEN refunded_at IS NULL THEN ${SEASON_PASS_PRICE_KRW} ELSE 0 END,
    ${SEASON_PASS_PRICE_KRW}
  FROM season_passes WHERE test = 0
  UNION ALL
  SELECT store, product_id, NULL, created_at,
    CASE WHEN kind = 'refund' THEN created_at END,
    CASE WHEN kind = 'refund' THEN 0 ELSE 1 END,
    CASE WHEN kind = 'refund' THEN -${MEMBERSHIP_PRICE_KRW} ELSE ${MEMBERSHIP_PRICE_KRW} END,
    ${MEMBERSHIP_PRICE_KRW}
  FROM billing_alerts WHERE test = 0 AND product_id = '${MEMBERSHIP_PRODUCT_ID}'
    AND kind IN ('purchase', 'renewal', 'refund')
), ads AS (
  SELECT store, product_id, NULL profile_id, created_at,
    CASE WHEN kind = 'refund' THEN created_at END refunded_at,
    CASE WHEN kind = 'refund' THEN 0 ELSE 1 END count,
    CASE WHEN kind = 'refund' THEN -1 ELSE 1 END * ${REMOVE_ADS_PRICE_SQL} krw,
    ${REMOVE_ADS_PRICE_SQL} refund_krw
  FROM billing_alerts WHERE test = 0 AND product_id = '${REMOVE_ADS_PRODUCT}'
    AND kind IN ('purchase', 'refund')
), all_products AS (SELECT * FROM purchases UNION ALL SELECT * FROM ads)`;

export async function revenueReport(db: Db, now: Date, days: number): Promise<AdminRevenue> {
  const d1 = db.$client;
  const { start, days: dayList } = kstWindow(now, days);
  const query = (sql: string, ...bindings: (string | number)[]) =>
    d1.prepare(`${PURCHASES} ${sql}`).bind(...bindings);
  const [total, first, refunds, allTime, daily, products, stores, ads, adsSince, recent] =
    await d1.batch<Record<string, unknown>>([
      query(
        `SELECT sum(count) count, sum(krw) krw,
        count(DISTINCT CASE WHEN count > 0 THEN profile_id END) buyers
        FROM purchases WHERE created_at >= ?`,
        start,
      ),
      query(
        `SELECT count(*) n FROM (SELECT min(created_at) f FROM purchases
        WHERE profile_id IS NOT NULL GROUP BY profile_id) WHERE f >= ?`,
        start,
      ),
      query(
        `SELECT count(*) count, sum(refund_krw) krw FROM purchases WHERE refunded_at >= ?`,
        start,
      ),
      query(`SELECT sum(count) count, sum(krw) krw,
        count(DISTINCT CASE WHEN count > 0 THEN profile_id END) buyers FROM purchases`),
      query(
        `SELECT ${KST_DAY} day, sum(count) count, sum(krw) krw
        FROM purchases WHERE created_at >= ? GROUP BY 1`,
        start,
      ),
      query(
        `SELECT product_id productId, sum(count) count, sum(krw) krw,
        sum(refunded_at IS NOT NULL) refunded FROM all_products
        WHERE created_at >= ? GROUP BY 1 ORDER BY krw DESC`,
        start,
      ),
      query(
        `SELECT store, sum(count) count, sum(krw) krw FROM all_products
        WHERE created_at >= ? GROUP BY 1 ORDER BY krw DESC`,
        start,
      ),
      query(
        `SELECT store, CASE WHEN created_at >= ? THEN ${KST_DAY} ELSE '' END day,
        sum(count) count, sum(refunded_at IS NOT NULL) refunds, sum(krw) krw
        FROM ads GROUP BY 1, 2`,
        start,
      ),
      query(`SELECT min(created_at) since FROM ads`),
      query(
        `SELECT i.store, i.product_id productId, coalesce(i.profile_id, '') profileId,
        p.nickname,
        i.created_at createdAt, i.refunded_at refundedAt
        FROM all_products i LEFT JOIN profiles p ON p.id = i.profile_id
        ORDER BY i.created_at DESC LIMIT ?`,
        RECENT_LIMIT,
      ),
    ]);
  const num = (v: unknown) => Number(v ?? 0);
  const sum = (row: Record<string, unknown> | undefined): Sum => ({
    count: num(row?.count),
    krw: num(row?.krw),
  });
  const t = total!.results[0]!;
  const a = allTime!.results[0]!;
  const byDay = new Map(daily!.results.map((d) => [d.day as string, d]));
  const ad = { count: 0, refunds: 0, krw: 0 };
  const adAll = { ...ad };
  const adStores = new Map<string, typeof ad>();
  const adDays = new Map<string, Sum>();
  for (const row of ads!.results) {
    for (const key of ['count', 'refunds', 'krw'] as const) adAll[key] += num(row[key]);
    if (!row.day) continue;
    const store = row.store as string;
    const s = adStores.get(store) ?? { count: 0, refunds: 0, krw: 0 };
    for (const key of ['count', 'refunds', 'krw'] as const) {
      ad[key] += num(row[key]);
      s[key] += num(row[key]);
    }
    adStores.set(store, s);
    const day = row.day as string;
    const d = adDays.get(day) ?? { count: 0, krw: 0 };
    adDays.set(day, { count: d.count + num(row.count), krw: d.krw + num(row.krw) });
  }
  return {
    generatedAt: now.toISOString(),
    days,
    total: {
      ...sum(t),
      buyers: num(t.buyers),
      firstBuyers: num(first!.results[0]?.n),
      refunds: num(refunds!.results[0]?.count),
      refundKrw: num(refunds!.results[0]?.krw),
    },
    allTime: { ...sum(a), buyers: num(a.buyers) },
    daily: dayList.map((day) => ({
      day,
      ...sum(byDay.get(day)),
      adCount: adDays.get(day)?.count ?? 0,
      adKrw: adDays.get(day)?.krw ?? 0,
    })),
    products: products!.results.map((p) => ({
      productId: p.productId as string,
      ...sum(p),
      refunded: num(p.refunded),
    })),
    stores: stores!.results.map((s) => ({ store: s.store as string, ...sum(s) })),
    removeAds: {
      ...ad,
      since: (adsSince!.results[0]?.since as string | null) ?? null,
      allTime: adAll,
      stores: [...adStores].map(([store, s]) => ({ store, count: s.count, refunds: s.refunds })),
    },
    recent: recent!.results as AdminRevenue['recent'],
  };
}
