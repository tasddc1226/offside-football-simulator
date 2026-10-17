import type { IapStore } from '@offside/contracts';
import { ACQUISITION_WINDOW_MS, ACQUISITION_CONSENT_VERSION } from '@offside/contracts/acquisition';
import { REMOVE_ADS_PRODUCT_ID } from '@offside/contracts/cup';
import type { VerifiedPurchaseMetadata } from '../../iap/metadata.js';
/** No entitlement mutation, item quantity, client display price or retroactive account assignment. */
export async function recordAdFreePurchase(
  db: D1Database,
  p: {
    store: IapStore;
    transactionId: string;
    profileId: string | null;
    test: boolean;
    now: string;
    metadata: VerifiedPurchaseMetadata;
  },
) {
  const at = p.metadata.purchasedAt;
  await db
    .prepare(
      `INSERT INTO iap_ad_free_purchases
    (store,transaction_id,profile_id,product_id,test,created_at,purchased_at,price_milliunits,currency,storefront,first_touch_id,last_touch_id,refunded_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,
      (SELECT s.id FROM acquisition_sessions s JOIN acquisition_consents c ON c.profile_id=s.profile_id
       WHERE s.profile_id=?3 AND c.version=?12 AND s.linked_at<=?7 AND s.received_at>=?11 AND s.received_at<=?7 ORDER BY s.received_at,s.id LIMIT 1),
      (SELECT s.id FROM acquisition_sessions s JOIN acquisition_consents c ON c.profile_id=s.profile_id
       WHERE s.profile_id=?3 AND c.version=?12 AND s.linked_at<=?7 AND s.received_at>=?11 AND s.received_at<=?7 ORDER BY s.received_at DESC,s.id DESC LIMIT 1),
      (SELECT refunded_at FROM iap_refund_markers WHERE store=?1 AND transaction_id=?2))
    ON CONFLICT(store,transaction_id) DO NOTHING`,
    )
    .bind(
      p.store,
      p.transactionId,
      p.profileId,
      REMOVE_ADS_PRODUCT_ID,
      p.test ? 1 : 0,
      p.now,
      at,
      p.metadata.priceMilliunits,
      p.metadata.currency,
      p.metadata.storefront,
      at ? new Date(Date.parse(at) - ACQUISITION_WINDOW_MS).toISOString() : null,
      ACQUISITION_CONSENT_VERSION,
    )
    .run();
}

export async function markPurchaseRefund(
  db: D1Database,
  store: IapStore,
  transactionId: string,
  now: string,
) {
  await db.batch([
    db
      .prepare(
        'INSERT INTO iap_refund_markers (store,transaction_id,refunded_at) VALUES (?,?,?) ON CONFLICT DO NOTHING',
      )
      .bind(store, transactionId, now),
    db
      .prepare(
        'UPDATE iap_ad_free_purchases SET refunded_at=coalesce(refunded_at,?) WHERE store=? AND transaction_id=?',
      )
      .bind(now, store, transactionId),
  ]);
}
