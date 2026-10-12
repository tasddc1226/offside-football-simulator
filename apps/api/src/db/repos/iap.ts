import { OWNER_ITEMS, type IapStore, type OwnerItem } from '@offside/contracts';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-145 구단주 아이템(리롤권 · T-11-174 잠재력 강화권) 읽기 · 쓰기 · 인앱 구매 지급.

type Items = Record<OwnerItem, number>;
const ITEMS_SQL = `SELECT item, sum(qty) AS qty FROM (
  SELECT item, qty FROM owner_items WHERE profile_id = ?1
  UNION ALL SELECT item, remaining AS qty FROM membership_item_lots WHERE profile_id = ?1
) GROUP BY item`;
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
  const [memberUsed, used, items] = await d1.batch<{ item: string; qty: number }>([
    // Consume refundable lots first; a later refund never touches independently earned items.
    d1
      .prepare(
        `UPDATE membership_item_lots SET remaining = remaining - 1 WHERE rowid = (
      SELECT rowid FROM membership_item_lots WHERE profile_id = ? AND item = ? AND remaining > 0
      ORDER BY created_at, store, environment, transaction_id LIMIT 1
    )`,
      )
      .bind(profileId, item),
    d1
      .prepare(
        `UPDATE owner_items SET qty = qty - 1, updated_at = ?
         WHERE changes() = 0 AND profile_id = ? AND item = ? AND qty > 0`,
      )
      .bind(now, profileId, item),
    d1.prepare(ITEMS_SQL).bind(profileId),
  ]);
  return memberUsed?.meta.changes || used?.meta.changes ? foldItems(items?.results ?? []) : null;
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

export type IapRevoke =
  | { found: false }
  | {
      found: true;
      already: boolean;
      profileId: string;
      item: string;
      qty: number;
      revoked: number;
    };

/**
 * T-11-215 스토어가 환불한 거래의 아이템을 회수한다. 거래마다 한 번만 처리하고(refunded_at), 지금 가진 장수 안에서만
 * 뺀다 — 이미 쓴 만큼은 revoked_qty가 qty보다 작게 남는다. 모르는 거래면 found: false, 이미 처리했으면 already.
 */
export async function revokeIapPurchase(
  db: Db,
  store: IapStore,
  transactionId: string,
  now: string,
): Promise<IapRevoke> {
  const d1 = db.$client;
  const key = `store = ? AND transaction_id = ?`;
  const [marked, , , row] = await d1.batch<{
    profileId: string;
    item: string;
    qty: number;
    revoked: number;
  }>([
    d1
      .prepare(`UPDATE iap_purchases SET refunded_at = ? WHERE ${key} AND refunded_at IS NULL`)
      .bind(now, store, transactionId),
    // 회수할 장수 = min(받은 장수, 지금 가진 장수). 앞 문장이 표시한 경우에만.
    d1
      .prepare(
        `UPDATE iap_purchases SET revoked_qty = MIN(qty, COALESCE((
           SELECT o.qty FROM owner_items o
           WHERE o.profile_id = iap_purchases.profile_id AND o.item = iap_purchases.item), 0))
         WHERE ${key} AND changes() = 1`,
      )
      .bind(store, transactionId),
    d1
      .prepare(
        `UPDATE owner_items SET qty = qty - (SELECT revoked_qty FROM iap_purchases WHERE ${key}),
           updated_at = ?
         WHERE changes() = 1
           AND profile_id = (SELECT profile_id FROM iap_purchases WHERE ${key})
           AND item = (SELECT item FROM iap_purchases WHERE ${key})`,
      )
      .bind(store, transactionId, now, store, transactionId, store, transactionId),
    d1
      .prepare(
        `SELECT profile_id AS profileId, item, qty, revoked_qty AS revoked FROM iap_purchases WHERE ${key}`,
      )
      .bind(store, transactionId),
  ]);
  const r = row?.results[0];
  if (!r) return { found: false };
  return { found: true, already: !marked?.meta.changes, ...r };
}
