import { OWNER_ITEMS, type OwnerItem } from '@offside/contracts';
import {
  STARTER_PACK_CONTROL_PCT,
  STARTER_PACK_RETIRE_AGE,
  starterPackItems,
} from '@offside/contracts/starter-pack';
import type { VerifiedPurchaseMetadata } from '../../iap/metadata.js';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-770d 첫 구매 묶음: 자격 · 지급 · 환불. 지급은 스토어 거래마다 원장 한 줄(starter_packs)이고, 그 줄을 넣은 요청만 세 가지
// 아이템을 같은 batch에서 준다(원장과 아이템이 따로 놀지 않는다). 자격은 프로필 인덱스로만 읽는다(원장을 훑지 않는다).

export type StarterEligibility = 'owned' | 'paid' | 'no_retire' | 'control' | 'eligible';

/**
 * 대조군인지. 프로필마다 고정이라 다시 접속하거나 기기를 바꿔도 같다. 따로 적어 두지 않고 프로필 id로 다시 계산한다
 * (분석도 같은 식으로 군을 나눈다): SHA-256('starter_v1:' + 프로필 id)의 첫 두 바이트 % 100 < 대조군 비율.
 */
export async function starterControl(profileId: string): Promise<boolean> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`starter_v1:${profileId}`)),
  );
  return ((bytes[0]! << 8) | bytes[1]!) % 100 < STARTER_PACK_CONTROL_PCT;
}

/**
 * 이 구단주가 첫 구매 묶음을 살 수 있나. 한 번의 왕복으로 읽는다.
 * - 실결제 이력: 아이템 · 시즌 패스 · 멤버십 · 웹 결제 · 광고 제거(원장에 남은 것) 가운데 시험 거래가 아닌 것이 하나라도 있으면
 *   paid. 환불한 거래도 센다(한 번 결제한 구단주를 미결제로 되돌리지 않는다).
 * - 끝까지 뛴(35세 이상) 은퇴 선수가 한 명은 있어야 한다.
 */
export async function starterEligibilityOf(db: Db, profileId: string): Promise<StarterEligibility> {
  const row = await db.$client
    .prepare(
      `SELECT
         EXISTS (SELECT 1 FROM starter_packs WHERE profile_id = ?1) AS owned,
         EXISTS (SELECT 1 FROM iap_purchases WHERE profile_id = ?1 AND test = 0) AS items,
         EXISTS (SELECT 1 FROM season_passes WHERE profile_id = ?1 AND test = 0) AS pass,
         EXISTS (SELECT 1 FROM memberships WHERE profile_id = ?1 AND test = 0) AS member,
         EXISTS (SELECT 1 FROM web_pay_orders WHERE profile_id = ?1 AND status = 'PAID' AND test = 0) AS web,
         EXISTS (SELECT 1 FROM iap_ad_free_purchases WHERE profile_id = ?1 AND test = 0) AS adFree,
         EXISTS (SELECT 1 FROM careers WHERE profile_id = ?1 AND status = 'retired' AND retire_age >= ?2) AS retired`,
    )
    .bind(profileId, STARTER_PACK_RETIRE_AGE)
    .first<Record<'owned' | 'items' | 'pass' | 'member' | 'web' | 'adFree' | 'retired', number>>();
  if (!row) return 'no_retire';
  if (row.owned) return 'owned';
  if (row.items || row.pass || row.member || row.web || row.adFree) return 'paid';
  if (!row.retired) return 'no_retire';
  return (await starterControl(profileId)) ? 'control' : 'eligible';
}

/** 이 거래를 받은 구단주(없으면 undefined). */
export const starterOfTransaction = (db: Db, store: string, transactionId: string) =>
  db.$client
    .prepare(
      `SELECT profile_id AS profileId FROM starter_packs WHERE store = ? AND transaction_id = ?`,
    )
    .bind(store, transactionId)
    .first<{ profileId: string }>();

const HAVE_SQL = `SELECT item, qty FROM owner_items WHERE profile_id = ?`;
const fold = (rows: readonly { item: string; qty: number }[]) => {
  const out = Object.fromEntries(OWNER_ITEMS.map((k) => [k, 0])) as Record<OwnerItem, number>;
  for (const r of rows) if (r.item in out) out[r.item as OwnerItem] = r.qty;
  return out;
};

/**
 * 확인한 스토어 거래로 묶음을 준다. 거래(store, transactionId)마다 원장 한 줄이라 같은 거래를 다시 보내면 원장도 아이템도
 * 그대로다. 다른 구단주가 받은 거래면 null, 아니면 지금 장수. 자격은 여기서 보지 않는다: 스토어가 승인한 유료 거래는 자격이
 * 그사이 바뀌었어도(다른 기기에서 먼저 샀어도) 약속한 묶음을 한 번 준다. 환불 알림이 먼저 온 거래(iap_refund_markers)는 줄만
 * 남기고 주지 않는다.
 */
export async function grantStarterPack(
  db: Db,
  p: {
    store: string;
    transactionId: string;
    profileId: string;
    version: string;
    test: boolean;
    now: string;
    grantId: string;
    metadata?: VerifiedPurchaseMetadata;
  },
): Promise<Record<OwnerItem, number> | null> {
  const d1 = db.$client;
  const reward = starterPackItems(p.version);
  const items = OWNER_ITEMS.filter((k) => (reward[k] ?? 0) > 0);
  // 이 요청이 넣은 줄일 때만(grant_id) 준다. 같은 거래의 다시 보내기 · 동시 요청은 줄을 넣지 못해 주지 않는다.
  const mine = {
    sql: `EXISTS (SELECT 1 FROM starter_packs
            WHERE store = ? AND transaction_id = ? AND grant_id = ? AND refunded_at IS NULL)`,
    params: [p.store, p.transactionId, p.grantId],
  };
  const results = await d1.batch<{ profileId?: string; item: string; qty: number }>([
    d1
      .prepare(
        `INSERT INTO starter_packs (store, transaction_id, profile_id, version, test, grant_id, created_at,
           purchased_at, price_milliunits, currency, storefront, refunded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
           (SELECT refunded_at FROM iap_refund_markers WHERE store = ?1 AND transaction_id = ?2))
         ON CONFLICT DO NOTHING`,
      )
      .bind(
        p.store,
        p.transactionId,
        p.profileId,
        p.version,
        p.test ? 1 : 0,
        p.grantId,
        p.now,
        p.metadata?.purchasedAt ?? null,
        p.metadata?.priceMilliunits ?? null,
        p.metadata?.currency ?? null,
        p.metadata?.storefront ?? null,
      ),
    ...items.map((k) => grantItemStatement(d1, p.profileId, k, reward[k]!, p.now, mine)),
    d1
      .prepare(
        `SELECT profile_id AS profileId FROM starter_packs WHERE store = ? AND transaction_id = ?`,
      )
      .bind(p.store, p.transactionId),
    d1.prepare(HAVE_SQL).bind(p.profileId),
  ]);
  const owner = results.at(-2)?.results[0]?.profileId;
  if (owner !== p.profileId) return null;
  return fold(results.at(-1)?.results ?? []);
}

/**
 * 스토어가 환불한 묶음 거래를 닫는다. 거래마다 한 번만 처리하고, 그 판의 구성을 지금 가진 장수 안에서 아이템별로 회수한다
 * (이미 쓴 만큼은 남는다). 실제 회수한 장수를 revoked_json에 적는다. 묶음 거래가 아니면 false.
 */
export async function revokeStarterPack(
  db: Db,
  store: string,
  transactionId: string,
  now: string,
): Promise<boolean> {
  const d1 = db.$client;
  const row = await d1
    .prepare(
      `UPDATE starter_packs SET refunded_at = ?
       WHERE store = ? AND transaction_id = ? AND refunded_at IS NULL
       RETURNING profile_id AS profileId, version`,
    )
    .bind(now, store, transactionId)
    .first<{ profileId: string; version: string }>();
  if (!row) return !!(await starterOfTransaction(db, store, transactionId));
  const reward = starterPackItems(row.version);
  const take = OWNER_ITEMS.filter((k) => (reward[k] ?? 0) > 0);
  if (!take.length) return true;
  // 회수할 장수 = min(받은 장수, 지금 가진 장수). 같은 batch에서 먼저 그 장수를 원장에 적고, 이어서 아이템에서 뺀다.
  const have = (k: OwnerItem) =>
    `MIN(${Math.trunc(reward[k]!)}, COALESCE((SELECT qty FROM owner_items WHERE profile_id = ?1 AND item = '${k}'), 0))`;
  await d1.batch([
    d1
      .prepare(
        `UPDATE starter_packs SET revoked_json = json_object(${take.map((k) => `'${k}', ${have(k)}`).join(', ')})
         WHERE store = ?2 AND transaction_id = ?3`,
      )
      .bind(row.profileId, store, transactionId),
    ...take.map((k) =>
      d1
        .prepare(
          `UPDATE owner_items SET qty = qty - MIN(qty, ?), updated_at = ? WHERE profile_id = ? AND item = ?`,
        )
        .bind(reward[k]!, now, row.profileId, k),
    ),
  ]);
  return true;
}
