import {
  IAP_PRICE_KRW,
  REMOVE_ADS_PRICE_SQL,
  REMOVE_ADS_PRODUCT,
  type AdminRevenue,
} from '@offside/contracts';
import { SEASON_PASS_PRODUCT_ID, SEASON_PASS_PRICE_KRW } from '@offside/contracts/season-pass';
import { MEMBERSHIP_PRODUCT_ID, MEMBERSHIP_PRICE_KRW } from '@offside/contracts/membership';
import type { Db } from '../client.js';

const RECENT_LIMIT = 30;
// 상품 id → 정가. 값은 코드 상수(숫자)라 SQL에 그대로 넣는다.
const PRICE_SQL = `CASE product_id ${Object.entries(IAP_PRICE_KRW)
  .map(([id, krw]) => `WHEN '${id}' THEN ${Math.trunc(krw)}`)
  .join(' ')} ELSE 0 END`;
const KST_DAY = `substr(datetime(created_at, '+9 hours'), 1, 10)`;

export type RevenueSumRow = { count: number | null; krw: number | null };
export type RevenueRows = [
  total: D1Result<RevenueSumRow & { buyers: number }>,
  first: D1Result<{ n: number }>,
  refunds: D1Result<RevenueSumRow>,
  allTime: D1Result<RevenueSumRow & { buyers: number }>,
  daily: D1Result<RevenueSumRow & { day: string }>,
  products: D1Result<RevenueSumRow & { productId: string; refunded: number }>,
  stores: D1Result<RevenueSumRow & { store: string }>,
  ads: D1Result<RevenueSumRow & { store: string; day: string; refunds: number }>,
  adsSince: D1Result<{ since: string | null }>,
  recent: D1Result<AdminRevenue['recent'][number]>,
];

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

/** One read-only batch; tuple order is paired with the unchanged SELECT list. */
export async function readRevenueRows(db: Db, start: string): Promise<RevenueRows> {
  const d1 = db.$client;
  const query = (sql: string, ...bindings: (string | number)[]) =>
    d1.prepare(`${PURCHASES} ${sql}`).bind(...bindings);
  const results = await d1.batch([
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
  // D1 batch exposes one generic row type for heterogeneous statements.
  // Keep the assertion at this SQL adapter boundary; consumers use named row types.
  return results as RevenueRows;
}
