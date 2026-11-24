import type { FundsHistoryEntry, FundsHistoryResponse } from '@offside/contracts';
import { FUNDS_MATCH_ID, FUNDS_TOUR_ID } from '@offside/contracts';
import type { Db } from '../client.js';
import { MATCH_INCOME_KIND } from './ownerTeams.js';
import { MATCH_INCOME_KINDS_SQL } from './matchIncome.js';
import { TOUR_FEE_KIND } from './squadTour.js';

// 구단 자금 내역(구단주 화면 → 구단 자금). 잔액을 바꾸는 기록 네 곳을 시각순으로 합친다 — 원장 테이블이 따로 없다
// (운영 도구 대조 fundsAudit.ts와 같은 출처): 방출(cards.released_value, 키운 사람) · 은퇴 장려금(cards.bonus_value) · 판매(가격 − 수수료) · 영입(가격) ·
// 구단 자금으로 산 것(owner_item_purchases) · T-11-373 카드 강화(card_enhance_log — 옛 앱이 모르는 item 대신 item NULL에 카드를 붙이고
// id를 'enhance:'로 시작한다). D1은 UNION 한 덩어리에 다섯 항까지라 지출 두 곳은 안쪽에서 먼저 합친다. 한 번에 여러 장 방출하면 시각이 같아 id로 순서를 굳힌다.
// T-11-823 랭크 경기 수입(중계권료 + 승리 수당)은 출처 표가 따로 없어 거래 기록(owner_fund_ledger, 구단주 인덱스)에서 읽는다.
// T-11-825 원정 투어 대전료(tour_fee)는 이긴 경기마다 한 줄(id 'tour:<주>:<경기 번호>')이고 합계는 경기 수입에 더한다.
// 광고를 보고 한 번 더 받은 몫(match_income_ad)도 같은 줄에 더한다. 하루 열 경기 넘게 쌓이므로 한국 날짜로 한 줄씩 묶고, 옛 앱이 모르는 kind 대신 bonus에 id 'match:<날짜>:<경기 수>'를 붙인다.

export const FUNDS_HISTORY_PAGE = 30;

const MOVES = `
  SELECT c.career_id id, 'released' kind, NULL item, c.released_value amount, NULL fee, c.released_at at,
         c.career_id cid
    FROM cards c JOIN careers ca ON ca.id = c.career_id
   WHERE ca.profile_id = ?1 AND c.released_at IS NOT NULL
  UNION ALL
  SELECT id, 'bonus', NULL, amount, NULL, at, cid FROM (
    SELECT 'bonus:' || c.career_id id, c.bonus_value amount, c.created_at at, c.career_id cid
      FROM cards c JOIN careers ca ON ca.id = c.career_id
     WHERE ca.profile_id = ?1 AND c.bonus_value IS NOT NULL
    UNION ALL
    SELECT '${FUNDS_MATCH_ID}' || date(created_at, '+9 hours') || ':' || sum(kind = '${MATCH_INCOME_KIND}'), sum(delta),
           max(created_at), NULL
      FROM owner_fund_ledger WHERE profile_id = ?1 AND kind IN (${MATCH_INCOME_KINDS_SQL})
     GROUP BY date(created_at, '+9 hours')
    UNION ALL
    SELECT '${FUNDS_TOUR_ID}' || ref, delta, created_at, NULL
      FROM owner_fund_ledger WHERE profile_id = ?1 AND kind = '${TOUR_FEE_KIND}')
  UNION ALL
  SELECT id, 'sold', NULL, price - fee, fee, closed_at, career_id
    FROM market_listings WHERE seller_id = ?1 AND status = 'sold'
  UNION ALL
  SELECT id, 'bought', NULL, -price, NULL, closed_at, career_id
    FROM market_listings WHERE buyer_id = ?1 AND status = 'sold'
  UNION ALL
  SELECT id, 'spent', item, -price, NULL, created_at, cid FROM (
    SELECT id, item, price, created_at, NULL cid FROM owner_item_purchases WHERE profile_id = ?1
    UNION ALL
    SELECT 'enhance:' || id, NULL, cost, created_at, career_id FROM card_enhance_log WHERE profile_id = ?1)`;

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
                k.pos, k.peak, k.number,
                CASE WHEN ca.id IS NULL THEN k.public_name ELSE ca.public_name END AS publicName
           FROM p LEFT JOIN cards k ON k.career_id = p.cid LEFT JOIN careers ca ON ca.id = p.cid
          ORDER BY p.at DESC, p.id DESC`,
      )
      .bind(profileId, FUNDS_HISTORY_PAGE + 1, page * FUNDS_HISTORY_PAGE),
    d1
      .prepare(
        `SELECT r.released, r.bonus,
           (SELECT coalesce(sum(price - fee), 0) FROM market_listings WHERE seller_id = ?1 AND status = 'sold') AS sold,
           (SELECT coalesce(sum(price), 0) FROM market_listings WHERE buyer_id = ?1 AND status = 'sold') AS bought,
           (SELECT coalesce(sum(price), 0) FROM owner_item_purchases WHERE profile_id = ?1)
             + (SELECT coalesce(sum(cost), 0) FROM card_enhance_log WHERE profile_id = ?1) AS spent,
           (SELECT coalesce(sum(delta), 0) FROM owner_fund_ledger
             WHERE profile_id = ?1 AND kind IN (${MATCH_INCOME_KINDS_SQL}, '${TOUR_FEE_KIND}')) AS matchIncome,
           (SELECT balance FROM owner_funds WHERE profile_id = ?1) AS balance
           FROM (SELECT coalesce(sum(CASE WHEN c.released_at IS NOT NULL THEN c.released_value END), 0) AS released,
                        coalesce(sum(c.bonus_value), 0) AS bonus
                   FROM cards c JOIN careers ca ON ca.id = c.career_id WHERE ca.profile_id = ?1) r`,
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
