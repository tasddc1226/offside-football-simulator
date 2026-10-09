import type { IapStore, OwnerItem } from '@offside/contracts';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

/** 구단주 아이템 장수(행이 없으면 0). */
export async function ownerItemsOf(db: Db, profileId: string): Promise<Record<OwnerItem, number>> {
  const row = await db.$client
    .prepare(
      `SELECT coalesce(sum(CASE item WHEN 'reroll' THEN qty END), 0) AS reroll,
              coalesce(sum(CASE item WHEN 'boost' THEN qty END), 0) AS boost
       FROM owner_items WHERE profile_id = ?`,
    )
    .bind(profileId)
    .first<Record<OwnerItem, number>>();
  return { reroll: row?.reroll ?? 0, boost: row?.boost ?? 0 };
}

/**
 * T-11-174 확인한 스토어 거래로 아이템을 준다. 거래(store, transactionId)마다 원장 행 하나라 같은 거래를 다시 보내면 원장도
 * 아이템도 그대로다. 'granted' 이번에 줬다 · 'again' 이 구단주가 이미 받았다 · 'other' 다른 구단주가 받은 거래다.
 */
export async function grantIapPurchase(
  db: Db,
  p: {
    store: IapStore;
    transactionId: string;
    profileId: string;
    productId: string;
    item: OwnerItem;
    qty: number;
    test: boolean;
    now: string;
  },
): Promise<'granted' | 'again' | 'other'> {
  const d1 = db.$client;
  const [ins] = await d1.batch([
    d1
      .prepare(
        `INSERT INTO iap_purchases (store, transaction_id, profile_id, product_id, item, qty, test, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      )
      .bind(
        p.store,
        p.transactionId,
        p.profileId,
        p.productId,
        p.item,
        p.qty,
        p.test ? 1 : 0,
        p.now,
      ),
    grantItemStatement(d1, p.profileId, p.item, p.qty, p.now, { sql: 'changes() = 1' }),
  ]);
  if (ins?.meta.changes) return 'granted';
  const owner = await d1
    .prepare(
      `SELECT profile_id AS profileId FROM iap_purchases WHERE store = ? AND transaction_id = ?`,
    )
    .bind(p.store, p.transactionId)
    .first<{ profileId: string }>();
  return owner?.profileId === p.profileId ? 'again' : 'other';
}
