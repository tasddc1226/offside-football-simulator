import { resolveBalance } from '@offside/contracts';
import type { Db } from '../client.js';
import { getActiveBalance } from './balance.js';

// T-11-152 구단 자금으로 사는 선수 후보 리롤권. 쌓이기만 하는 구단 자금을 없애는 곳이라 비싸게 팔고, 같은 날 더 살수록
// 비싸지며 하루 상한이 있다. 수치는 운영 도구 밸런스 설정(이적시장 묶음)의 활성 버전을 요청 때 바로 읽는다.

/** 리롤권 상점 수치(활성 버전, 없으면 기본값). */
export async function rerollShopRules(db: Db) {
  const b = resolveBalance((await getActiveBalance(db))?.values);
  return { price: b.rerollPrice, growth: b.rerollPriceGrowth, cap: b.rerollDailyCap };
}

/** 가진 리롤권 · 구단 자금 · since(오늘 0시, 한국 시각) 뒤에 산 장수를 한 번에 읽는다(행이 없으면 0). */
export async function shopSnapshot(db: Db, profileId: string, since: string) {
  const row = await db.$client
    .prepare(
      `SELECT (SELECT qty FROM owner_items WHERE profile_id = ?1 AND item = 'reroll') AS reroll,
              (SELECT balance FROM owner_funds WHERE profile_id = ?1) AS balance,
              (SELECT coalesce(sum(qty), 0) FROM owner_item_purchases
                WHERE profile_id = ?1 AND item = 'reroll' AND created_at >= ?2) AS bought`,
    )
    .bind(profileId, since)
    .first<{ reroll: number | null; balance: number | null; bought: number }>();
  return { reroll: row?.reroll ?? 0, balance: row?.balance ?? 0, bought: row?.bought ?? 0 };
}

/**
 * 리롤권 한 장 사기. 1) 오늘 산 장수가 라우트가 본 값(bought) 그대로일 때만 원장에 넣고 2) 그 행이 있으면 자금을 빼고
 * 3) 리롤권을 더한다. 동시에 두 번 사면 뒤 요청은 1이 0행이라 아무것도 바꾸지 않는다(won = false). 잔액이 모자라면 CHECK
 * 위반으로 batch 전체가 되돌아간다.
 */
export async function buyReroll(
  db: Db,
  b: { id: string; profileId: string; price: number; bought: number; since: string; now: string },
): Promise<{ won: boolean; balance: number; reroll: number }> {
  const d1 = db.$client;
  const won = `EXISTS (SELECT 1 FROM owner_item_purchases WHERE id = ?)`;
  const results = await d1.batch([
    d1
      .prepare(
        `INSERT INTO owner_item_purchases (id, profile_id, item, qty, price, created_at)
         SELECT ?, ?, 'reroll', 1, ?, ?
         WHERE (SELECT coalesce(sum(qty), 0) FROM owner_item_purchases
                WHERE profile_id = ? AND item = 'reroll' AND created_at >= ?) = ?`,
      )
      .bind(b.id, b.profileId, b.price, b.now, b.profileId, b.since, b.bought),
    d1
      .prepare(
        `UPDATE owner_funds SET balance = balance - ?, updated_at = ? WHERE profile_id = ? AND ${won}`,
      )
      .bind(b.price, b.now, b.profileId, b.id),
    d1
      .prepare(
        `INSERT INTO owner_items (profile_id, item, qty, updated_at)
         SELECT ?, 'reroll', 1, ? WHERE ${won}
         ON CONFLICT (profile_id, item) DO UPDATE SET qty = qty + 1, updated_at = excluded.updated_at`,
      )
      .bind(b.profileId, b.now, b.id),
    d1
      .prepare(
        `SELECT (SELECT balance FROM owner_funds WHERE profile_id = ?) AS balance,
                (SELECT qty FROM owner_items WHERE profile_id = ? AND item = 'reroll') AS reroll`,
      )
      .bind(b.profileId, b.profileId),
  ]);
  const row = results.at(-1)!.results[0] as { balance: number | null; reroll: number | null };
  return {
    won: results[0]!.meta.changes === 1,
    balance: row.balance ?? 0,
    reroll: row.reroll ?? 0,
  };
}
