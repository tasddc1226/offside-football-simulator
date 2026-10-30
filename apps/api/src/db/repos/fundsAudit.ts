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
//   − 영입(market_listings 가격) − 구단 자금으로 산 것(owner_item_purchases) − 카드 강화(card_enhance_log, T-11-373)
// 운영자가 열 때만 읽는다. 전체 대조는 세 기록을 한 번씩 훑는다. 방출 · 장려금은 그 값이 있는 카드만 담은 부분 인덱스에서
// 출발해 커리어를 기본 키로 찾고(커리어 26만 행을 돌지 않는다), 구단주별 합은 한 번만 계산해 요약 · 어긋난 목록을 함께
// 만든다(T-11-493). 전체 행은 Worker로 보내지 않는다(T-11-493b).

const MISMATCH_LIMIT = 50;
const MOVES_LIMIT = 50;

// 구단주별 출처 합. pid 필터는 한 명을 볼 때만 붙인다(?1). 전체를 볼 때는 CROSS JOIN으로 카드(부분 인덱스)부터 읽게
// 고정한다 — 한 명을 볼 때는 그 구단주의 커리어(profile_id 인덱스)부터 읽는 편이 빠르다.
const sums = (one: boolean) => {
  const w = (col: string) => (one ? ` AND ${col} = ?1` : '');
  return `
  r AS (SELECT ca.profile_id pid, sum(CASE WHEN c.released_at IS NOT NULL THEN c.released_value END) v,
                sum(c.bonus_value) bonus FROM cards c ${one ? 'JOIN' : 'CROSS JOIN'} careers ca ON ca.id = c.career_id
         WHERE (c.released_at IS NOT NULL OR c.bonus_value IS NOT NULL)${w('ca.profile_id')} GROUP BY 1),
  s AS (SELECT seller_id pid, sum(price - fee) v, sum(fee) fee FROM market_listings
         WHERE status = 'sold'${w('seller_id')} GROUP BY 1),
  b AS (SELECT buyer_id pid, sum(price) v FROM market_listings
         WHERE status = 'sold' AND buyer_id IS NOT NULL${w('buyer_id')} GROUP BY 1),
  i AS (SELECT pid, sum(v) v FROM (
           SELECT profile_id pid, price v FROM owner_item_purchases WHERE 1 = 1${w('profile_id')}
           UNION ALL
           SELECT profile_id, cost FROM card_enhance_log WHERE 1 = 1${w('profile_id')}) GROUP BY 1),
  x AS (SELECT f.profile_id profileId, p.nickname, f.balance,
               coalesce(r.v, 0) released, coalesce(r.bonus, 0) bonus, coalesce(s.v, 0) sold, coalesce(s.fee, 0) fees,
               coalesce(b.v, 0) bought, coalesce(i.v, 0) items
          FROM owner_funds f
          LEFT JOIN profiles p ON p.id = f.profile_id
          LEFT JOIN r ON r.pid = f.profile_id LEFT JOIN s ON s.pid = f.profile_id
          LEFT JOIN b ON b.pid = f.profile_id LEFT JOIN i ON i.pid = f.profile_id
         WHERE 1 = 1${w('f.profile_id')}),
  d AS (SELECT *, balance - (released + bonus + sold - bought - items) diff FROM x)`;
};

type SumsRow = AdminFundsOwnerSums & { fees: number };
const ownerSums = ({ fees: _fees, ...r }: SumsRow): AdminFundsOwnerSums => r;

/** 전체 구단주 대조 요약과 어긋난 구단주(차이 큰 순). */
export async function fundsReport(db: Db, now: Date): Promise<AdminFundsReport> {
  const d1 = db.$client;
  // 합계는 창 함수로 전체 구단주(1만여 행)를 한 번에 세고, Worker로는 어긋난 상위 몇 행만 보낸다.
  const [top, items] = await d1.batch([
    d1
      .prepare(
        `WITH ${sums(false)}
         SELECT *, count(*) OVER () owners_n, sum(balance) OVER () balance_t, sum(released) OVER () released_t,
                sum(bonus) OVER () bonus_t, sum(sold) OVER () sold_t, sum(bought) OVER () bought_t,
                sum(fees) OVER () fees_t, sum(diff <> 0) OVER () mismatched_n
           FROM d ORDER BY diff <> 0 DESC, abs(diff) DESC LIMIT ?`,
      )
      .bind(MISMATCH_LIMIT),
    d1.prepare(
      `SELECT item, sum(price) v FROM owner_item_purchases GROUP BY item
       UNION ALL SELECT 'enhance', sum(cost) FROM card_enhance_log HAVING count(*) > 0`,
    ),
  ]);
  type TopRow = SumsRow & {
    diff: number;
    owners_n: number;
    balance_t: number;
    released_t: number;
    bonus_t: number;
    sold_t: number;
    bought_t: number;
    fees_t: number;
    mismatched_n: number;
  };
  const rows = top!.results as TopRow[];
  const t = rows[0];
  return {
    generatedAt: now.toISOString(),
    owners: t?.owners_n ?? 0,
    balance: t?.balance_t ?? 0,
    released: t?.released_t ?? 0,
    bonus: t?.bonus_t ?? 0,
    sold: t?.sold_t ?? 0,
    bought: t?.bought_t ?? 0,
    fees: t?.fees_t ?? 0,
    mismatched: t?.mismatched_n ?? 0,
    items: Object.fromEntries(
      (items!.results as { item: string; v: number }[]).map((x) => [x.item, x.v]),
    ),
    mismatches: rows
      .filter((r) => r.diff !== 0)
      .map(
        ({
          owners_n: _o,
          balance_t: _b,
          released_t: _r,
          bonus_t: _bo,
          sold_t: _s,
          bought_t: _bu,
          fees_t: _f,
          mismatched_n: _m,
          ...r
        }) => ownerSums(r),
      ),
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
  const [row, moves, scout] = await d1.batch([
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
         SELECT 'item', item, -price, created_at FROM (
           SELECT item, price, created_at FROM owner_item_purchases WHERE profile_id = ?1
           UNION ALL
           SELECT 'enhance', cost, created_at FROM card_enhance_log WHERE profile_id = ?1)
         ORDER BY at DESC LIMIT ?2`,
      )
      .bind(pid, MOVES_LIMIT),
    // T-11-245 프리미엄 스카우트권 사용 현황(천장 카운트 · 보유 · 앱 구매).
    d1
      .prepare(
        `SELECT coalesce(sp.used, 0) used, coalesce(sp.streak, 0) streak, coalesce(sp.elites, 0) elites,
                coalesce((SELECT qty FROM owner_items WHERE profile_id = ?1 AND item = 'scout'), 0) held,
                coalesce((SELECT sum(qty - coalesce(revoked_qty, 0)) FROM iap_purchases
                           WHERE profile_id = ?1 AND item = 'scout'), 0) paid
           FROM (SELECT 1) LEFT JOIN scout_pity sp ON sp.profile_id = ?1`,
      )
      .bind(pid),
  ]);
  const sumsRow = row!.results[0] as SumsRow | undefined;
  if (!sumsRow) return null;
  return {
    ...ownerSums(sumsRow),
    moves: moves!.results as AdminFundsMove[],
    scout: scout!.results[0] as NonNullable<AdminFundsOwner['scout']>,
  };
}
