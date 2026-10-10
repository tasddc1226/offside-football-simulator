import { OWNER_ITEMS, type IapStore, type OwnerItem } from '@offside/contracts';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-145 구단주 아이템(리롤권 · T-11-174 잠재력 강화권) 읽기 · 쓰기 · 인앱 구매 지급.

type Items = Record<OwnerItem, number>;
const ITEMS_SQL = `SELECT item, qty FROM owner_items WHERE profile_id = ?`;
const OWNER_SQL = `SELECT profile_id AS profileId FROM iap_purchases WHERE store = ? AND transaction_id = ?`;

const foldItems = (rows: readonly { item: string; qty: number }[]): Items => {
  const out = Object.fromEntries(OWNER_ITEMS.map((k) => [k, 0])) as Items;
  for (const r of rows) if (r.item in out) out[r.item as OwnerItem] = r.qty;
  return out;
};

/** 구단주 아이템 장수(행이 없으면 0). */
export async function ownerItemsOf(db: Db, profileId: string): Promise<Items> {
  const { results } = await db.$client
    .prepare(ITEMS_SQL)
    .bind(profileId)
    .all<{ item: string; qty: number }>();
  return foldItems(results);
}

/** 아이템 한 장 쓰기. 한 장도 없으면 null, 아니면 쓴 뒤 장수. 한 번의 왕복으로 끝난다. */
export async function spendItem(
  db: Db,
  profileId: string,
  item: OwnerItem,
  now: string,
): Promise<Items | null> {
  const d1 = db.$client;
  const [used, items] = await d1.batch<{ item: string; qty: number }>([
    d1
      .prepare(
        `UPDATE owner_items SET qty = qty - 1, updated_at = ?
         WHERE profile_id = ? AND item = ? AND qty > 0`,
      )
      .bind(now, profileId, item),
    d1.prepare(ITEMS_SQL).bind(profileId),
  ]);
  return used?.meta.changes ? foldItems(items?.results ?? []) : null;
}

/** 이 거래를 받은 구단주(없으면 undefined). */
export async function iapOwnerOf(db: Db, store: IapStore, transactionId: string) {
  const row = await db.$client
    .prepare(OWNER_SQL)
    .bind(store, transactionId)
    .first<{ profileId: string }>();
  return row?.profileId;
}

/**
 * T-11-174 확인한 스토어 거래로 아이템을 준다. 거래(store, transactionId)마다 원장 행 하나라 같은 거래를 다시 보내면 원장도
 * 아이템도 그대로다. 다른 구단주가 받은 거래면 null, 아니면 지금 장수.
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
): Promise<Items | null> {
  const d1 = db.$client;
  const [, , owner, items] = await d1.batch<{ profileId?: string; item: string; qty: number }>([
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
    d1.prepare(OWNER_SQL).bind(p.store, p.transactionId),
    d1.prepare(ITEMS_SQL).bind(p.profileId),
  ]);
  if (owner?.results[0]?.profileId !== p.profileId) return null;
  return foldItems(items?.results ?? []);
}
