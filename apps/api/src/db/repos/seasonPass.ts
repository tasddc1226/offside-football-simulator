import type { SeasonPassSeason } from '@offside/contracts';
import { OWNER_ITEMS, type OwnerItem } from '@offside/contracts/cup';
import { SEASON_GAUGE } from '@offside/contracts/season-gauge';
import {
  passRewardBetween,
  passSaleSeason,
  passSeasonFor,
  passTierOf,
} from '@offside/contracts/season-pass';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-511 시즌 패스. 규칙 · 단계표는 contracts season-pass-rules.ts. 패스 화면을 열 때와 사거나 받을 때만 부른다.

type PassRow = { season: number; claimed: number };

/**
 * 시즌별 진행도: 그 시즌 선수가 fullAge 이상에 은퇴한 커리어를 KST 날짜마다 dailyCap까지 센다(시즌 게이지와 같은 기준).
 * careers_profile_status_season_idx로 그 구단주의 은퇴 커리어만 읽는다.
 */
async function progressOf(db: Db, profileId: string, seasons: readonly number[]) {
  const out = new Map<number, number>(seasons.map((s) => [s, 0]));
  if (!seasons.length) return out;
  const { results } = await db.$client
    .prepare(
      `SELECT season, SUM(MIN(n, ?)) AS progress FROM (
         SELECT service_season AS season, date(retired_at, '+9 hours') AS d, COUNT(*) AS n
         FROM careers
         WHERE profile_id = ? AND status = 'retired' AND retire_age >= ?
           AND service_season IN (${seasons.map(() => '?').join(', ')})
         GROUP BY service_season, d
       ) GROUP BY season`,
    )
    .bind(SEASON_GAUGE.dailyCap, profileId, SEASON_GAUGE.fullAge, ...seasons)
    .all<{ season: number; progress: number }>();
  for (const r of results) out.set(r.season, r.progress);
  return out;
}

const ownedRows = async (db: Db, profileId: string) =>
  (
    await db.$client
      .prepare(
        `SELECT season, claimed FROM season_passes
         WHERE profile_id = ? AND refunded_at IS NULL ORDER BY season`,
      )
      .bind(profileId)
      .all<PassRow>()
  ).results;

/**
 * 패스 화면: 지금 시즌(사지 않았어도 진행도는 보인다) + 산 패스 가운데 아직 받을 단계가 남은 지난 시즌 · 미리 산 다음 시즌.
 */
export async function seasonPassesOf(
  db: Db,
  profileId: string,
  now: string,
): Promise<SeasonPassSeason[]> {
  const current = passSaleSeason(now);
  const rows = await ownedRows(db, profileId);
  const progress = await progressOf(db, profileId, [
    ...new Set([current, ...rows.filter((r) => r.season < current).map((r) => r.season)]),
  ]);
  const view = (season: number, row?: PassRow): SeasonPassSeason => {
    const p = progress.get(season) ?? 0;
    return { season, owned: !!row, progress: p, tier: passTierOf(p), claimed: row?.claimed ?? 0 };
  };
  const mine = new Map(rows.map((r) => [r.season, r]));
  return [
    view(current, mine.get(current)),
    ...rows
      .filter((r) => r.season !== current)
      .map((r) => view(r.season, r))
      .filter((v) => v.season > current || v.tier > v.claimed),
  ];
}

/** 이 거래로 연 패스의 구단주 · 시즌(없으면 undefined). */
export const passOfTransaction = (db: Db, store: string, transactionId: string) =>
  db.$client
    .prepare(
      `SELECT profile_id AS profileId, season FROM season_passes WHERE store = ? AND transaction_id = ?`,
    )
    .bind(store, transactionId)
    .first<{ profileId: string; season: number }>();

/**
 * 확인한 스토어 거래로 패스를 연다. 같은 거래를 다시 보내면 그 시즌을 그대로 돌려준다. 다른 구단주가 연 거래면 null.
 * 파는 시즌을 이미 가졌으면 다음 시즌 패스가 된다. 환불로 닫힌 시즌을 다시 사면 그 줄을 새 거래로 다시 연다(받은 단계는
 * 그대로라 같은 보상을 두 번 받지 않는다).
 */
export async function openSeasonPass(
  db: Db,
  p: {
    profileId: string;
    store: string;
    transactionId: string;
    test: boolean;
    purchasedAt: string | null;
    now: string;
  },
): Promise<{ season: number } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const seen = await passOfTransaction(db, p.store, p.transactionId);
    if (seen) return seen.profileId === p.profileId ? { season: seen.season } : null;
    const owned = (await ownedRows(db, p.profileId)).map((r) => r.season);
    const season = passSeasonFor(p.now, owned);
    const r = await db.$client
      .prepare(
        `INSERT INTO season_passes (profile_id, season, store, transaction_id, test, claimed, purchased_at, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT (profile_id, season) DO UPDATE SET
           store = excluded.store, transaction_id = excluded.transaction_id, test = excluded.test,
           purchased_at = excluded.purchased_at, created_at = excluded.created_at, refunded_at = NULL
         WHERE season_passes.refunded_at IS NOT NULL
         ON CONFLICT DO NOTHING`,
      )
      .bind(p.profileId, season, p.store, p.transactionId, p.test ? 1 : 0, p.purchasedAt, p.now)
      .run();
    if (r.meta.changes) return { season };
    // 같은 시즌을 동시에 연 다른 거래가 먼저 들어갔거나 같은 거래가 동시에 왔다 — 다시 읽고 다음 시즌을 본다.
  }
  return null;
}

const NONE = (): Record<OwnerItem, number> =>
  Object.fromEntries(OWNER_ITEMS.map((k) => [k, 0])) as Record<OwnerItem, number>;

/**
 * 그 시즌 패스의 열린 단계 보상을 한꺼번에 받는다. 패스가 없거나 환불됐으면 null. 받을 게 없으면 모두 0. 받은 단계(claimed)를
 * 읽은 값 그대로일 때만 올리고, 이 batch가 올렸을 때만(claim_id) 아이템을 준다 — 동시에 두 번 눌러도 한 번만 받는다.
 */
export async function claimSeasonPass(
  db: Db,
  profileId: string,
  season: number,
  now: string,
): Promise<Record<OwnerItem, number> | null> {
  const d1 = db.$client;
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await d1
      .prepare(
        `SELECT claimed FROM season_passes WHERE profile_id = ? AND season = ? AND refunded_at IS NULL`,
      )
      .bind(profileId, season)
      .first<{ claimed: number }>();
    if (!row) return null;
    const tier = passTierOf((await progressOf(db, profileId, [season])).get(season) ?? 0);
    if (tier <= row.claimed) return NONE();
    const reward = passRewardBetween(row.claimed, tier);
    const claimId = crypto.randomUUID();
    const guard = {
      sql: 'EXISTS (SELECT 1 FROM season_passes WHERE profile_id = ? AND season = ? AND claim_id = ?)',
      params: [profileId, season, claimId],
    };
    const [moved] = await d1.batch([
      d1
        .prepare(
          `UPDATE season_passes SET claimed = ?, claim_id = ?
           WHERE profile_id = ? AND season = ? AND claimed = ? AND refunded_at IS NULL`,
        )
        .bind(tier, claimId, profileId, season, row.claimed),
      ...OWNER_ITEMS.filter((k) => reward[k]).map((k) =>
        grantItemStatement(d1, profileId, k, reward[k]!, now, guard),
      ),
    ]);
    if (!moved?.meta.changes) continue;
    return { ...NONE(), ...reward };
  }
  return NONE();
}

/**
 * 스토어가 환불한 패스 거래를 닫는다. 거래마다 한 번만 처리하고, 그 패스로 받은 아이템을 지금 가진 장수 안에서 회수한다
 * (이미 쓴 만큼은 남는다 — 소모성 환불과 같다). 패스 거래가 아니면 false.
 */
export async function revokeSeasonPass(
  db: Db,
  store: string,
  transactionId: string,
  now: string,
): Promise<boolean> {
  const d1 = db.$client;
  const row = await d1
    .prepare(
      `UPDATE season_passes SET refunded_at = ?
       WHERE store = ? AND transaction_id = ? AND refunded_at IS NULL
       RETURNING profile_id AS profileId, claimed`,
    )
    .bind(now, store, transactionId)
    .first<{ profileId: string; claimed: number }>();
  if (!row) return !!(await passOfTransaction(db, store, transactionId));
  const got = passRewardBetween(0, row.claimed);
  const take = OWNER_ITEMS.filter((k) => got[k]);
  if (take.length)
    await d1.batch(
      take.map((k) =>
        d1
          .prepare(
            `UPDATE owner_items SET qty = qty - MIN(qty, ?), updated_at = ? WHERE profile_id = ? AND item = ?`,
          )
          .bind(got[k]!, now, row.profileId, k),
      ),
    );
  return true;
}
