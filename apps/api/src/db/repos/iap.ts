import {
  HOME_GIFT,
  OWNER_ITEMS,
  REROLL_MILEAGE,
  scoutPityAt,
  type ScoutPityCap,
  type IapStore,
  type OwnerItem,
  type ScoutMode,
  type ScoutPity,
  type WEB_PAY_STORE,
} from '@offside/contracts';
import type { VerifiedPurchaseMetadata } from '../../iap/metadata.js';
import { ACQUISITION_WINDOW_MS } from '@offside/contracts/acquisition';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-145 구단주 아이템(리롤권 · T-11-174 잠재력 강화권) 읽기 · 쓰기 · 인앱 구매 지급.

type Items = Record<OwnerItem, number> & { pity?: ScoutPity; mileage?: number };
// T-11-244 프리미엄 스카우트 천장 카운트도 같은 왕복에 'pity.<열>' 행으로 붙인다(행이 없으면 pity 없음 = 모두 0).
// T-11-248 리롤권 마일리지도 'mileage' 행으로 붙인다(행이 없으면 mileage 없음 = 0).
const ITEMS_SQL = `SELECT item, qty FROM owner_items WHERE profile_id = ?1
  UNION ALL SELECT 'pity.used', used FROM scout_pity WHERE profile_id = ?1
  UNION ALL SELECT 'pity.streak', streak FROM scout_pity WHERE profile_id = ?1
  UNION ALL SELECT 'pity.elites', elites FROM scout_pity WHERE profile_id = ?1
  UNION ALL SELECT 'mileage', progress FROM reroll_mileage WHERE profile_id = ?1`;
const OWNER_SQL = `SELECT profile_id AS profileId FROM iap_purchases WHERE store = ? AND transaction_id = ?`;

/** 구매 원장의 store: 앱 스토어 둘 · T-11-454 웹 결제(토스). */
type LedgerStore = IapStore | typeof WEB_PAY_STORE;

const foldItems = (rows: readonly { item: string; qty: number }[]): Items => {
  const out = Object.fromEntries(OWNER_ITEMS.map((k) => [k, 0])) as Record<OwnerItem, number>;
  const pity: ScoutPity = { used: 0, streak: 0, elites: 0 };
  let hasPity = false;
  let mileage: number | undefined;
  for (const r of rows) {
    if (r.item in out) out[r.item as OwnerItem] = r.qty;
    else if (r.item === 'mileage') mileage = r.qty;
    else if (r.item.startsWith('pity.')) {
      pity[r.item.slice(5) as keyof ScoutPity] = r.qty;
      hasPity = true;
    }
  }
  return {
    ...out,
    ...(hasPity ? { pity } : {}),
    ...(mileage !== undefined ? { mileage } : {}),
  };
};

/**
 * T-11-244 스카우트권 한 장의 천장 카운트를 고친다(장수를 뺀 같은 batch, 차감이 됐을 때만). SET의 식은 모두 고치기 전
 * 값을 읽는다. pity = 기기가 천장을 아는지(옛 앱은 확정 모드를 받지 못하니 장수만 센다), hit = 기기가 뽑은 일반 후보에
 * S가 있었는지. 규칙은 contracts scoutPityView와 같다.
 */
// T-11-450 천장 장수는 시즌마다 다르다(scoutPityOf). 정수 두 개만 SQL에 넣는다.
const pitySql = (cap: ScoutPityCap) => {
  const ELITE_DUE = `?2 = 1 AND (used + 1) / ${Math.trunc(cap.elite)} > elites`;
  const SURE_DUE = `?2 = 1 AND streak >= ${Math.trunc(cap.sure) - 1}`;
  return `INSERT INTO scout_pity (profile_id, used, streak, elites, mode, updated_at)
  SELECT ?1, 1, CASE WHEN ?2 = 1 AND ?3 = 1 THEN 0 ELSE 1 END, 0, 'normal', ?4
  WHERE EXISTS (SELECT 1 FROM owner_items WHERE profile_id = ?1 AND item = 'scout' AND updated_at = ?4)
  ON CONFLICT (profile_id) DO UPDATE SET
    mode = CASE WHEN ${ELITE_DUE} THEN 'elite' WHEN ${SURE_DUE} THEN 'sure' ELSE 'normal' END,
    elites = elites + (CASE WHEN ${ELITE_DUE} THEN 1 ELSE 0 END),
    streak = CASE WHEN (${ELITE_DUE}) OR (${SURE_DUE}) OR (?2 = 1 AND ?3 = 1) THEN 0 ELSE streak + 1 END,
    used = used + 1,
    updated_at = excluded.updated_at
  RETURNING mode`;
};

/**
 * T-11-248 리롤권 한 장의 마일리지를 센다(장수를 뺀 같은 batch, 차감이 됐을 때만). progress가 REROLL_MILEAGE에 닿으면
 * 0으로 되돌리고 rewarded를 하나 올린다. 이어지는 MILEAGE_GRANT가 그때만 스카우트권 1장을 준다. 규칙은 contracts
 * rerollMileageLeft와 같다.
 */
const MILEAGE_FULL = `progress + 1 >= ${REROLL_MILEAGE}`;
const MILEAGE_SQL = `INSERT INTO reroll_mileage (profile_id, used, progress, rewarded, updated_at)
  SELECT ?1, 1, 1, 0, ?2
  WHERE EXISTS (SELECT 1 FROM owner_items WHERE profile_id = ?1 AND item = 'reroll' AND updated_at = ?2)
  ON CONFLICT (profile_id) DO UPDATE SET
    rewarded = rewarded + (CASE WHEN ${MILEAGE_FULL} THEN 1 ELSE 0 END),
    progress = CASE WHEN ${MILEAGE_FULL} THEN 0 ELSE progress + 1 END,
    used = used + 1,
    updated_at = excluded.updated_at
  RETURNING progress`;
const MILEAGE_GRANT = `EXISTS (SELECT 1 FROM reroll_mileage WHERE profile_id = ? AND progress = 0 AND updated_at = ?)`;

/** 구단주 아이템 장수(행이 없으면 0). */
export async function ownerItemsOf(db: Db, profileId: string): Promise<Items> {
  const { results } = await db.$client
    .prepare(ITEMS_SQL)
    .bind(profileId)
    .all<{ item: string; qty: number }>();
  return foldItems(results);
}

/**
 * 아이템 한 장 쓰기. 한 장도 없으면 null, 아니면 쓴 뒤 장수. 한 번의 왕복으로 끝난다. T-11-244 스카우트권이면 천장
 * 카운트를 같이 고치고 이번 장의 모드(scoutMode)를 돌려준다. T-11-248 리롤권이면 마일리지를 세고, 이번 장으로 차면
 * 스카우트권 1장을 같이 주고 mileageScout를 붙인다.
 */
export async function spendItem(
  db: Db,
  profileId: string,
  item: OwnerItem,
  now: string,
  scout: { pity: boolean; hit: boolean } = { pity: false, hit: false },
): Promise<(Items & { scoutMode?: ScoutMode; mileageScout?: true }) | null> {
  const d1 = db.$client;
  const results = await d1.batch<{ item: string; qty: number; mode?: ScoutMode }>([
    d1
      .prepare(
        `UPDATE owner_items SET qty = qty - 1, updated_at = ?
         WHERE profile_id = ? AND item = ? AND qty > 0`,
      )
      .bind(now, profileId, item),
    ...(item === 'scout'
      ? [
          d1
            .prepare(pitySql(scoutPityAt(now)))
            .bind(profileId, scout.pity ? 1 : 0, scout.hit ? 1 : 0, now),
        ]
      : []),
    ...(item === 'reroll'
      ? [
          d1.prepare(MILEAGE_SQL).bind(profileId, now),
          grantItemStatement(d1, profileId, 'scout', 1, now, {
            sql: MILEAGE_GRANT,
            params: [profileId, now],
          }),
        ]
      : []),
    d1.prepare(ITEMS_SQL).bind(profileId),
  ]);
  if (!results[0]?.meta.changes) return null;
  const items = foldItems(results.at(-1)?.results ?? []);
  if (item === 'reroll') return results[2]?.meta.changes ? { ...items, mileageScout: true } : items;
  const mode = item === 'scout' ? results[1]?.results[0]?.mode : undefined;
  return mode ? { ...items, scoutMode: mode } : items;
}

/** 이 거래를 받은 구단주(없으면 undefined). */
export async function iapOwnerOf(db: Db, store: LedgerStore, transactionId: string) {
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
    store: LedgerStore;
    transactionId: string;
    profileId: string;
    productId: string;
    item: OwnerItem;
    qty: number;
    test: boolean;
    now: string;
    alertId?: string;
    metadata?: VerifiedPurchaseMetadata;
    acquisitionEnabled?: boolean;
  },
): Promise<Items | null> {
  const d1 = db.$client;
  const [, , owner, items] = await d1.batch<{ profileId?: string; item: string; qty: number }>([
    d1
      .prepare(
        `INSERT INTO iap_purchases (store, transaction_id, profile_id, product_id, item, qty, test, created_at,
          purchased_at, price_milliunits, currency, storefront, first_touch_id, last_touch_id, refunded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
          (SELECT s.id FROM acquisition_sessions s JOIN acquisition_consents c ON c.profile_id=s.profile_id
           WHERE ?13=1 AND s.profile_id=?3 AND s.linked_at IS NOT NULL AND s.linked_at<=?9
             AND s.received_at>=?14 AND s.received_at<=?9 ORDER BY s.received_at, s.id LIMIT 1),
          (SELECT s.id FROM acquisition_sessions s JOIN acquisition_consents c ON c.profile_id=s.profile_id
           WHERE ?13=1 AND s.profile_id=?3 AND s.linked_at IS NOT NULL AND s.linked_at<=?9
             AND s.received_at>=?14 AND s.received_at<=?9 ORDER BY s.received_at DESC, s.id DESC LIMIT 1),
          (SELECT refunded_at FROM iap_refund_markers WHERE store=?1 AND transaction_id=?2))
         ON CONFLICT DO NOTHING`,
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
        p.metadata?.purchasedAt ?? null,
        p.metadata?.priceMilliunits ?? null,
        p.metadata?.currency ?? null,
        p.metadata?.storefront ?? null,
        p.acquisitionEnabled ? 1 : 0,
        p.metadata?.purchasedAt
          ? new Date(Date.parse(p.metadata.purchasedAt) - ACQUISITION_WINDOW_MS).toISOString()
          : null,
      ),
    grantItemStatement(d1, p.profileId, p.item, p.qty, p.now, {
      sql: 'changes() = 1 AND EXISTS (SELECT 1 FROM iap_purchases WHERE store=? AND transaction_id=? AND refunded_at IS NULL)',
      params: [p.store, p.transactionId],
    }),
    d1.prepare(OWNER_SQL).bind(p.store, p.transactionId),
    d1.prepare(ITEMS_SQL).bind(p.profileId),
    ...(p.alertId
      ? [
          d1
            .prepare(
              `INSERT INTO billing_alerts (id, store, kind, product_id, test, created_at)
      SELECT ?, store, 'purchase', product_id, test, created_at FROM iap_purchases
      WHERE store = ? AND transaction_id = ? AND profile_id = ? AND created_at = ? AND refunded_at IS NULL
      ON CONFLICT DO NOTHING`,
            )
            .bind(p.alertId, p.store, p.transactionId, p.profileId, p.now),
        ]
      : []),
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
  store: LedgerStore,
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

/** T-11-275 이 구단주가 지금 홈 선물을 받았는지(PK 조회 한 번). */
export async function homeGiftClaimed(db: Db, profileId: string): Promise<boolean> {
  const row = await db.$client
    .prepare(`SELECT 1 AS x FROM gift_claims WHERE profile_id = ? AND gift_id = ?`)
    .bind(profileId, HOME_GIFT.id)
    .first();
  return row !== null;
}

/**
 * T-11-275 홈 선물 받기. 받은 기록을 넣고, 그 줄을 이 batch가 새로 넣었을 때만(claim_id) 강화권 · 스카우트권을 더한다.
 * 이미 받았으면 null, 아니면 받은 뒤 장수. 스카우트권은 다른 경로로 받은 것과 같은 줄이라 쓸 때 천장을 똑같이 센다.
 */
export async function claimHomeGift(db: Db, profileId: string, now: string): Promise<Items | null> {
  const d1 = db.$client;
  const claimId = crypto.randomUUID();
  const guard = {
    sql: `EXISTS (SELECT 1 FROM gift_claims WHERE profile_id = ? AND gift_id = ? AND claim_id = ?)`,
    params: [profileId, HOME_GIFT.id, claimId],
  };
  const results = await d1.batch<{ item: string; qty: number }>([
    d1
      .prepare(
        `INSERT OR IGNORE INTO gift_claims (profile_id, gift_id, claim_id, claimed_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(profileId, HOME_GIFT.id, claimId, now),
    grantItemStatement(d1, profileId, 'boost', HOME_GIFT.boost, now, guard),
    grantItemStatement(d1, profileId, 'scout', HOME_GIFT.scout, now, guard),
    d1.prepare(ITEMS_SQL).bind(profileId),
  ]);
  if (!results[0]?.meta.changes) return null;
  return foldItems(results.at(-1)?.results ?? []);
}

/**
 * T-11-386 시즌 업적 보상 한 번 읽기 — 그 시즌 업적 행의 점수 · 적어 둔 보상 장수와 받았는지(giftId 받은 기록). 행이 없으면
 * null(그 시즌에 업적을 센 적 없음). 장수가 null이면 아직 세지 않았다.
 */
export async function seasonGiftRowOf(
  db: Db,
  profileId: string,
  season: number,
  giftId: string,
): Promise<{ score: number; boost: number | null; scout: number | null; claimed: boolean } | null> {
  const row = await db.$client
    .prepare(
      `SELECT score, reward_boost AS boost, reward_scout AS scout,
              EXISTS (SELECT 1 FROM gift_claims WHERE profile_id = ?1 AND gift_id = ?3) AS claimed
         FROM owner_achievements WHERE profile_id = ?1 AND season = ?2`,
    )
    .bind(profileId, season, giftId)
    .first<{ score: number; boost: number | null; scout: number | null; claimed: number }>();
  return row ? { ...row, claimed: row.claimed === 1 } : null;
}

/** T-11-386 센 시즌 업적 보상 장수를 적는다. 이미 적었으면 그대로 둔다(겹쳐 세도 먼저 적은 값). */
export async function saveSeasonGift(
  db: Db,
  profileId: string,
  season: number,
  r: { boost: number; scout: number },
) {
  await db.$client
    .prepare(
      `UPDATE owner_achievements SET reward_boost = ?, reward_scout = ?
        WHERE profile_id = ? AND season = ? AND reward_boost IS NULL`,
    )
    .bind(r.boost, r.scout, profileId, season)
    .run();
}

/**
 * T-11-386 시즌 업적 보상 받기 — 홈 선물(claimHomeGift)과 같은 방식: 받은 기록을 넣고, 그 줄을 이 batch가 새로 넣었을
 * 때만 적어 둔 장수만큼 더한다. 이미 받았으면 null, 아니면 받은 뒤 장수.
 */
export async function claimSeasonGift(
  db: Db,
  profileId: string,
  giftId: string,
  r: { boost: number; scout: number },
  now: string,
): Promise<Items | null> {
  const d1 = db.$client;
  const claimId = crypto.randomUUID();
  const guard = {
    sql: `EXISTS (SELECT 1 FROM gift_claims WHERE profile_id = ? AND gift_id = ? AND claim_id = ?)`,
    params: [profileId, giftId, claimId],
  };
  const results = await d1.batch<{ item: string; qty: number }>([
    d1
      .prepare(
        `INSERT OR IGNORE INTO gift_claims (profile_id, gift_id, claim_id, claimed_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(profileId, giftId, claimId, now),
    ...(r.boost > 0 ? [grantItemStatement(d1, profileId, 'boost', r.boost, now, guard)] : []),
    ...(r.scout > 0 ? [grantItemStatement(d1, profileId, 'scout', r.scout, now, guard)] : []),
    d1.prepare(ITEMS_SQL).bind(profileId),
  ]);
  if (!results[0]?.meta.changes) return null;
  return foldItems(results.at(-1)?.results ?? []);
}
