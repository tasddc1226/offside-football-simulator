import type {
  AdminFundsMove,
  AdminFundsOwner,
  AdminFundsOwnerSums,
  AdminFundsReport,
} from '@offside/contracts';
import type { Db } from '../client.js';

// T-11-153 구단 자금 대조(운영 도구). 잔액(owner_funds)이 기록 세 곳에서 다시 계산한 값과 같은지 본다.
//   방출(cards.released_value, 키운 사람 = careers.profile_id) + 은퇴 장려금(cards.bonus_value, T-11-163)
//   + 판매(market_listings 가격 − 수수료)
//   − 영입(market_listings 가격) − 구단 자금으로 산 것(owner_item_purchases)
// 운영자가 열 때만 읽는다. 전체 대조는 세 기록을 한 번씩 훑는다(2026-10 운영 기준 약 15만 행 · 1초).

const MISMATCH_LIMIT = 50;
const MOVES_LIMIT = 50;

// 구단주별 출처 합. pid 필터는 한 명을 볼 때만 붙인다(?1).
const sums = (one: boolean) => {
  const w = (col: string) => (one ? ` AND ${col} = ?1` : '');
  return `
  r AS (SELECT ca.profile_id pid, sum(c.released_value) v FROM cards c JOIN careers ca ON ca.id = c.career_id
         WHERE c.released_at IS NOT NULL${w('ca.profile_id')} GROUP BY 1),
  k AS (SELECT ca.profile_id pid, sum(c.bonus_value) v FROM cards c JOIN careers ca ON ca.id = c.career_id
         WHERE c.bonus_value IS NOT NULL${w('ca.profile_id')} GROUP BY 1),
  s AS (SELECT seller_id pid, sum(price - fee) v, sum(fee) fee FROM market_listings
         WHERE status = 'sold'${w('seller_id')} GROUP BY 1),
  b AS (SELECT buyer_id pid, sum(price) v FROM market_listings
         WHERE status = 'sold' AND buyer_id IS NOT NULL${w('buyer_id')} GROUP BY 1),
  i AS (SELECT profile_id pid, sum(price) v FROM owner_item_purchases WHERE 1 = 1${w('profile_id')} GROUP BY 1),
  x AS (SELECT f.profile_id profileId, p.nickname, f.balance,
               coalesce(r.v, 0) released, coalesce(k.v, 0) bonus, coalesce(s.v, 0) sold, coalesce(s.fee, 0) fees,
               coalesce(b.v, 0) bought, coalesce(i.v, 0) items
          FROM owner_funds f
          LEFT JOIN profiles p ON p.id = f.profile_id
          LEFT JOIN r ON r.pid = f.profile_id LEFT JOIN k ON k.pid = f.profile_id LEFT JOIN s ON s.pid = f.profile_id
          LEFT JOIN b ON b.pid = f.profile_id LEFT JOIN i ON i.pid = f.profile_id
         WHERE 1 = 1${w('f.profile_id')}),
  d AS (SELECT *, balance - (released + bonus + sold - bought - items) diff FROM x)`;
};

type SumsRow = AdminFundsOwnerSums & { fees: number };
const ownerSums = ({ fees: _fees, ...r }: SumsRow): AdminFundsOwnerSums => r;

/** 전체 구단주 대조 요약과 어긋난 구단주(차이 큰 순). */
export async function fundsReport(db: Db, now: Date): Promise<AdminFundsReport> {
  const d1 = db.$client;
  const [total, bad, items] = await d1.batch([
    d1.prepare(
      `WITH ${sums(false)}
       SELECT count(*) owners, coalesce(sum(balance), 0) balance, coalesce(sum(released), 0) released,
              coalesce(sum(bonus), 0) bonus, coalesce(sum(sold), 0) sold, coalesce(sum(bought), 0) bought, coalesce(sum(fees), 0) fees,
              coalesce(sum(diff <> 0), 0) mismatched FROM d`,
    ),
    d1
      .prepare(
        `WITH ${sums(false)} SELECT * FROM d WHERE diff <> 0 ORDER BY abs(diff) DESC LIMIT ?`,
      )
      .bind(MISMATCH_LIMIT),
    d1.prepare(`SELECT item, sum(price) v FROM owner_item_purchases GROUP BY item`),
  ]);
  const t = total!.results[0] as Omit<AdminFundsReport, 'generatedAt' | 'items' | 'mismatches'>;
  return {
    generatedAt: now.toISOString(),
    ...t,
    items: Object.fromEntries(
      (items!.results as { item: string; v: number }[]).map((x) => [x.item, x.v]),
    ),
    mismatches: (bad!.results as SumsRow[]).map(ownerSums),
  };
}

/** 프로필 id(prf_…) 또는 닉네임으로 구단주 한 명의 대조와 최근 움직임. 구단 자금 행이 없으면 null. */
export async function fundsOwner(db: Db, q: string): Promise<AdminFundsOwner | null> {
  const d1 = db.$client;
  const pid = q.startsWith('prf_')
    ? q
    : (
        await d1
          .prepare(`SELECT id FROM profiles WHERE nickname = ? AND deleted_at IS NULL LIMIT 1`)
          .bind(q)
          .first<{ id: string }>()
      )?.id;
  if (!pid) return null;
  const [row, moves] = await d1.batch([
    d1.prepare(`WITH ${sums(true)} SELECT * FROM d`).bind(pid),
    d1
      .prepare(
        `SELECT 'released' kind, NULL item, c.released_value amount, c.released_at at
           FROM cards c JOIN careers ca ON ca.id = c.career_id
          WHERE ca.profile_id = ?1 AND c.released_at IS NOT NULL
         UNION ALL
         SELECT 'bonus', NULL, c.bonus_value, c.created_at
           FROM cards c JOIN careers ca ON ca.id = c.career_id
          WHERE ca.profile_id = ?1 AND c.bonus_value IS NOT NULL
         UNION ALL
         SELECT 'sold', NULL, price - fee, closed_at FROM market_listings WHERE seller_id = ?1 AND status = 'sold'
         UNION ALL
         SELECT 'bought', NULL, -price, closed_at FROM market_listings WHERE buyer_id = ?1 AND status = 'sold'
         UNION ALL
         SELECT 'item', item, -price, created_at FROM owner_item_purchases WHERE profile_id = ?1
         ORDER BY at DESC LIMIT ?2`,
      )
      .bind(pid, MOVES_LIMIT),
  ]);
  const sumsRow = row!.results[0] as SumsRow | undefined;
  if (!sumsRow) return null;
  return { ...ownerSums(sumsRow), moves: moves!.results as AdminFundsMove[] };
}
