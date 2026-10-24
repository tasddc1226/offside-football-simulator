import {
  ACQUISITION_CONSENT_VERSION,
  type AcquisitionStoreBreakdown,
  type AcquisitionPurchases,
  type AcquisitionRefunds,
  type AcquisitionCoverage,
  type AcquisitionUnattributedReason,
} from '@offside/contracts/acquisition';
const ALL_IAP = `all_iap AS (
 SELECT store, transaction_id, profile_id, product_id, test, created_at, purchased_at, price_milliunits, currency, storefront, refunded_at, first_touch_id, last_touch_id FROM iap_purchases
 UNION ALL
 SELECT store, transaction_id, profile_id, product_id, test, created_at, purchased_at, price_milliunits, currency, storefront, refunded_at, first_touch_id, last_touch_id FROM iap_ad_free_purchases
)`;
// Rank payers before expanding rows: first purchase remains global across stores and both ledgers.
const withStores = (source: string) => `report_rows AS (
 SELECT *, NULL report_store FROM ${source}
 UNION ALL
 SELECT *, store report_store FROM ${source}
)`;
// NULL is the existing all-store aggregate, never a store bucket. Keep both views separate so
// consumers cannot mistake a subtotal for another purchase. SQL SUM(NULL) remains NULL.
function splitStores<T>(result: D1Result<Record<string, unknown>> | undefined) {
  const totals: T[] = [];
  const stores: (T & { store: string })[] = [];
  for (const { report_store, ...row } of result?.results ?? []) {
    if (report_store === null) totals.push(row as T);
    else stores.push({ store: report_store, ...row } as T & { store: string });
  }
  return { totals, stores };
}
/** No GA identifiers, transaction tokens or profile IDs leave this aggregate endpoint. */
export async function acquisitionReport(
  db: D1Database,
  start: string,
  end: string,
  model: 'first' | 'last',
) {
  const touch = model === 'first' ? 'first_touch_id' : 'last_touch_id';
  const [sessions, purchases, refunds, coverage, unattributed] = await db.batch<
    Record<string, unknown>
  >([
    db
      .prepare(
        `SELECT campaign, count(*) sessions, count(DISTINCT profile_id) profiles, count(started_at) start_sessions, count(store_clicked_at) store_click_sessions,
      sum(CASE WHEN linked_at IS NULL THEN 1 ELSE 0 END) unlinked_sessions
      FROM acquisition_sessions WHERE received_at>=? AND received_at<? GROUP BY campaign`,
      )
      .bind(start, end),
    db
      .prepare(
        `WITH ${ALL_IAP}, ranked AS (
      SELECT *, row_number() OVER (PARTITION BY profile_id ORDER BY coalesce(purchased_at,created_at), store, transaction_id) payer_order
      FROM all_iap WHERE test=0
    ), ${withStores('ranked')} SELECT p.report_store, coalesce(s.campaign,'unattributed') campaign, p.currency, count(*) transactions,
      sum(CASE WHEN p.profile_id IS NULL THEN 1 ELSE 0 END) unknown_account_transactions,
      count(DISTINCT p.profile_id) unique_purchasers,
      count(DISTINCT CASE WHEN p.price_milliunits>0 THEN p.profile_id END) unique_payers,
      sum(CASE WHEN p.payer_order=1 AND p.profile_id IS NOT NULL AND p.price_milliunits>0 THEN 1 ELSE 0 END) new_payers,
      sum(CASE WHEN p.payer_order>1 AND p.profile_id IS NOT NULL THEN 1 ELSE 0 END) repeat_transactions,
      sum(p.price_milliunits) gross_milliunits, count(p.price_milliunits) priced_transactions,
      sum(CASE WHEN p.price_milliunits IS NULL THEN 1 ELSE 0 END) unknown_price_transactions,
      sum(CASE WHEN p.price_milliunits=0 THEN 1 ELSE 0 END) zero_price_transactions,
      sum(CASE WHEN p.purchased_at IS NULL THEN 1 ELSE 0 END) missing_purchase_time
      FROM report_rows p LEFT JOIN acquisition_sessions s ON s.id=p.${touch}
      WHERE coalesce(p.purchased_at,p.created_at)>=? AND coalesce(p.purchased_at,p.created_at)<? GROUP BY campaign,p.currency,p.report_store`,
      )
      .bind(start, end),
    db
      .prepare(
        `WITH ${ALL_IAP}, ${withStores('all_iap')} SELECT p.report_store, coalesce(s.campaign,'unattributed') campaign, p.currency, count(*) refunds,
      sum(p.price_milliunits) purchase_value_of_refunded_transactions_milliunits, count(p.price_milliunits) priced_refunds
      FROM report_rows p LEFT JOIN acquisition_sessions s ON s.id=p.${touch}
      WHERE p.test=0 AND p.refunded_at>=? AND p.refunded_at<? GROUP BY campaign,p.currency,p.report_store`,
      )
      .bind(start, end),
    db
      .prepare(
        `WITH ${ALL_IAP}, sandbox AS (
        SELECT store FROM all_iap WHERE test=1 AND created_at>=? AND created_at<?
      ) SELECT NULL report_store, count(*) sandbox_transactions FROM sandbox
      UNION ALL SELECT store, count(*) sandbox_transactions FROM sandbox GROUP BY store`,
      )
      .bind(start, end),
    // T-11-456 연결되지 않은 구매가 어느 단계에서 끊겼는지(동의 · 유입 기록 · 30일 창 · 로그인 연결) 첫 원인 하나로 센다.
    db
      .prepare(
        `WITH ${ALL_IAP}, p AS (
      SELECT store, profile_id, coalesce(purchased_at,created_at) at FROM all_iap
      WHERE test=0 AND ${touch} IS NULL AND coalesce(purchased_at,created_at)>=? AND coalesce(purchased_at,created_at)<?
    ), ${withStores('p')} SELECT p.report_store, CASE
        WHEN p.profile_id IS NULL THEN 'unknown_account'
        WHEN NOT EXISTS(SELECT 1 FROM acquisition_consents c WHERE c.profile_id=p.profile_id AND c.version=?) THEN 'no_consent'
        WHEN NOT EXISTS(SELECT 1 FROM acquisition_sessions s WHERE s.profile_id=p.profile_id) THEN 'no_session'
        WHEN NOT EXISTS(SELECT 1 FROM acquisition_sessions s WHERE s.profile_id=p.profile_id
          AND s.received_at<=p.at AND s.received_at>=strftime('%Y-%m-%dT%H:%M:%fZ', p.at, '-30 days')) THEN 'outside_window'
        WHEN NOT EXISTS(SELECT 1 FROM acquisition_sessions s WHERE s.profile_id=p.profile_id
          AND s.received_at<=p.at AND s.received_at>=strftime('%Y-%m-%dT%H:%M:%fZ', p.at, '-30 days')
          AND s.linked_at IS NOT NULL AND s.linked_at<=p.at) THEN 'not_linked'
        ELSE 'other' END reason,
      count(*) transactions, count(DISTINCT p.profile_id) purchasers,
      count(DISTINCT CASE WHEN EXISTS(SELECT 1 FROM acquisition_sessions s WHERE s.profile_id=p.profile_id AND s.campaign<>'')
        THEN p.profile_id END) purchasers_with_campaign_session
      FROM report_rows p GROUP BY reason,p.report_store`,
      )
      .bind(start, end, ACQUISITION_CONSENT_VERSION),
  ]);
  const purchaseRows = splitStores<AcquisitionPurchases>(purchases);
  const refundRows = splitStores<AcquisitionRefunds>(refunds);
  const coverageRows = splitStores<AcquisitionCoverage>(coverage);
  const reasonRows = splitStores<AcquisitionUnattributedReason>(unattributed);
  return {
    start,
    end,
    timezone: 'UTC',
    model,
    windowDays: 30,
    amountBasis:
      'Signed purchase price field sums; refund value is the purchase value of refunded transactions, not a verified cash refund or net proceeds.',
    basis:
      'sessions by server receipt; purchases by verified purchase time, legacy fallback by receipt; refunds by refund processing time',
    sessions: sessions?.results ?? [],
    purchases: purchaseRows.totals,
    refunds: refundRows.totals,
    coverage: coverageRows.totals,
    unattributedReasons: reasonRows.totals,
    byStore: {
      purchases: purchaseRows.stores,
      refunds: refundRows.stores,
      coverage: coverageRows.stores,
      unattributedReasons: reasonRows.stores,
    } satisfies AcquisitionStoreBreakdown,
  };
}
