import type { FundsHistoryEntry, FundsHistoryResponse } from '@offside/contracts';
import type { Db } from '../client.js';

// 구단 자금 내역(구단주 화면 → 구단 자금). 잔액을 바꾸는 기록 네 곳을 시각순으로 합친다 — 원장 테이블이 따로 없다
// (운영 도구 대조 fundsAudit.ts와 같은 출처): 방출(cards.released_value, 키운 사람) · 은퇴 장려금(cards.bonus_value) · 판매(가격 − 수수료) · 영입(가격) ·
// 구단 자금으로 산 것(owner_item_purchases). 한 번에 여러 장 방출하면 시각이 같아 id로 순서를 굳힌다.

export const FUNDS_HISTORY_PAGE = 30;

const MOVES = `
  SELECT c.career_id id, 'released' kind, NULL item, c.released_value amount, NULL fee, c.released_at at,
         c.career_id cid
    FROM cards c JOIN careers ca ON ca.id = c.career_id
   WHERE ca.profile_id = ?1 AND c.released_at IS NOT NULL
  UNION ALL
  SELECT 'bonus:' || c.career_id, 'bonus', NULL, c.bonus_value, NULL, c.created_at, c.career_id
    FROM cards c JOIN careers ca ON ca.id = c.career_id
   WHERE ca.profile_id = ?1 AND c.bonus_value IS NOT NULL
  UNION ALL
  SELECT id, 'sold', NULL, price - fee, fee, closed_at, career_id
    FROM market_listings WHERE seller_id = ?1 AND status = 'sold'
  UNION ALL
  SELECT id, 'bought', NULL, -price, NULL, closed_at, career_id
    FROM market_listings WHERE buyer_id = ?1 AND status = 'sold'
  UNION ALL
  SELECT id, 'spent', item, -price, NULL, created_at, NULL
    FROM owner_item_purchases WHERE profile_id = ?1`;

type TradeCard = NonNullable<FundsHistoryEntry['card']>;
type MoveRow = Omit<FundsHistoryEntry, 'card'> & {
  pos: TradeCard['pos'] | null;
  peak: number | null;
  number: number | null;
  publicName: string | null;
  cid: string | null;
};

export async function fundsHistory(
  db: Db,
  profileId: string,
  page: number,
): Promise<FundsHistoryResponse> {
  const d1 = db.$client;
  const [moves, totals] = await d1.batch([
    d1
      .prepare(
        // 한 페이지만 먼저 자르고 카드·커리어를 붙인다(전체 내역에 조인하지 않게).
        `WITH m AS (${MOVES}),
              p AS (SELECT * FROM m ORDER BY at DESC, id DESC LIMIT ?2 OFFSET ?3)
         SELECT p.id, p.kind, p.item, p.amount, p.fee, p.at, p.cid,
                k.pos, k.peak, k.number, ca.public_name AS publicName
           FROM p LEFT JOIN cards k ON k.career_id = p.cid LEFT JOIN careers ca ON ca.id = p.cid
          ORDER BY p.at DESC, p.id DESC`,
      )
      .bind(profileId, FUNDS_HISTORY_PAGE + 1, page * FUNDS_HISTORY_PAGE),
    d1
      .prepare(
        `SELECT
           (SELECT coalesce(sum(c.released_value), 0) FROM cards c JOIN careers ca ON ca.id = c.career_id
             WHERE ca.profile_id = ?1 AND c.released_at IS NOT NULL) AS released,
           (SELECT coalesce(sum(c.bonus_value), 0) FROM cards c JOIN careers ca ON ca.id = c.career_id
             WHERE ca.profile_id = ?1 AND c.bonus_value IS NOT NULL) AS bonus,
           (SELECT coalesce(sum(price - fee), 0) FROM market_listings WHERE seller_id = ?1 AND status = 'sold') AS sold,
           (SELECT coalesce(sum(price), 0) FROM market_listings WHERE buyer_id = ?1 AND status = 'sold') AS bought,
           (SELECT coalesce(sum(price), 0) FROM owner_item_purchases WHERE profile_id = ?1) AS spent,
           (SELECT balance FROM owner_funds WHERE profile_id = ?1) AS balance`,
      )
      .bind(profileId),
  ]);
  const rows = moves!.results as MoveRow[];
  const items = rows
    .slice(0, FUNDS_HISTORY_PAGE)
    .map(({ cid, pos, peak, number, publicName, ...m }): FundsHistoryEntry => ({
      ...m,
      card:
        cid && pos && peak !== null
          ? { careerId: cid, pos, peak, number: number ?? null, publicName: publicName ?? null }
          : null,
    }));
  const { balance, ...sums } = totals!.results[0] as FundsHistoryResponse['totals'] & {
    balance: number | null;
  };
  return {
    balance: balance ?? 0,
    totals: sums,
    items,
    hasMore: rows.length > FUNDS_HISTORY_PAGE,
  };
}
