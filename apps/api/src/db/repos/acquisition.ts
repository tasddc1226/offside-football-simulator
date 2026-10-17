/** No GA identifiers, transaction tokens or profile IDs leave this aggregate endpoint. */
export async function acquisitionReport(
  db: D1Database,
  start: string,
  end: string,
  model: 'first' | 'last',
) {
  const touch = model === 'first' ? 'first_touch_id' : 'last_touch_id';
  const [sessions, purchases, refunds, coverage] = await db.batch([
    db
      .prepare(
        `SELECT campaign, count(*) sessions, count(started_at) start_sessions, count(store_clicked_at) store_click_sessions,
      sum(CASE WHEN linked_at IS NULL THEN 1 ELSE 0 END) unlinked_sessions
      FROM acquisition_sessions WHERE received_at>=? AND received_at<? GROUP BY campaign`,
      )
      .bind(start, end),
    db
      .prepare(
        `WITH ranked AS (
      SELECT *, row_number() OVER (PARTITION BY profile_id ORDER BY coalesce(purchased_at,created_at), store, transaction_id) payer_order
      FROM iap_purchases WHERE test=0
    ) SELECT coalesce(s.campaign,'unattributed') campaign, p.currency, count(*) transactions,
      count(DISTINCT p.profile_id) unique_purchasers,
      count(DISTINCT CASE WHEN p.price_milliunits>0 THEN p.profile_id END) unique_payers,
      sum(CASE WHEN p.payer_order=1 AND p.price_milliunits>0 THEN 1 ELSE 0 END) new_payers,
      sum(CASE WHEN p.payer_order>1 THEN 1 ELSE 0 END) repeat_transactions,
      sum(p.price_milliunits) gross_milliunits, count(p.price_milliunits) priced_transactions,
      sum(CASE WHEN p.price_milliunits IS NULL THEN 1 ELSE 0 END) unknown_price_transactions,
      sum(CASE WHEN p.price_milliunits=0 THEN 1 ELSE 0 END) zero_price_transactions,
      sum(CASE WHEN p.purchased_at IS NULL THEN 1 ELSE 0 END) missing_purchase_time
      FROM ranked p LEFT JOIN acquisition_sessions s ON s.id=p.${touch}
      WHERE coalesce(p.purchased_at,p.created_at)>=? AND coalesce(p.purchased_at,p.created_at)<? GROUP BY campaign,p.currency`,
      )
      .bind(start, end),
    db
      .prepare(
        `SELECT coalesce(s.campaign,'unattributed') campaign, p.currency, count(*) refunds,
      sum(p.price_milliunits) refunded_milliunits, count(p.price_milliunits) priced_refunds
      FROM iap_purchases p LEFT JOIN acquisition_sessions s ON s.id=p.${touch}
      WHERE p.test=0 AND p.refunded_at>=? AND p.refunded_at<? GROUP BY campaign,p.currency`,
      )
      .bind(start, end),
    db
      .prepare(
        'SELECT count(*) sandbox_transactions FROM iap_purchases WHERE test=1 AND created_at>=? AND created_at<?',
      )
      .bind(start, end),
  ]);
  return {
    start,
    end,
    timezone: 'UTC',
    model,
    windowDays: 30,
    basis:
      'sessions by server receipt; purchases by verified purchase time, legacy fallback by receipt; refunds by refund processing time',
    sessions: sessions?.results ?? [],
    purchases: purchases?.results ?? [],
    refunds: refunds?.results ?? [],
    coverage: coverage?.results ?? [],
  };
}
