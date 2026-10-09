import {
  MARKET_PER_PAGE,
  MARKET_RECENT,
  type MarketSale,
  resolveBalance,
  type MarketChartPoint,
  type MarketListing,
  type MarketRules,
  type MarketSort,
  type MarketTrade,
} from '@offside/contracts';
import { CARD_VALUE_FLOOR, marketRatio } from '@offside/contracts/market-value';
import type { PosGroup } from '@offside/contracts/positions';
import { and, asc, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { getActiveBalance } from './balance.js';
import { eventNotificationStatements } from '../../push/events.js';
import { peakOf } from './ownerTeams.js';
import { cards, careers, marketDaily, marketListings, ownerFunds } from '../schema.js';

// T-11-080 이적시장 · 구단 자금 · 방출. 설계: docs/tracking/owner-funds-card-market-plan.md 5~7절.
// 쓰기는 D1 batch(한 트랜잭션)로 묶고, "이번 요청이 이겼는가"는 첫 문장의 조건부 UPDATE가 남긴 표식으로 판정한다.

/** 운영 도구 밸런스 설정의 이적시장 수치(활성 버전, 없으면 기본값). */
export async function marketRules(db: Db): Promise<MarketRules> {
  const b = resolveBalance((await getActiveBalance(db))?.values);
  return {
    releaseRate: b.marketReleaseRate,
    feeRate: b.marketFeeRate,
    priceMin: b.marketPriceMin,
    priceMax: b.marketPriceMax,
    listLimit: b.marketListLimit,
    dailyBuys: b.marketDailyBuys,
  };
}

const cardCols = {
  careerId: cards.careerId,
  pos: cards.pos,
  dpos: cards.dpos,
  nation: cards.nation,
  peak: cards.peak,
  number: cards.number,
  publicName: careers.publicName,
  legendScore: cards.legendScore,
  peakProfile: cards.peakProfile,
  type: careers.type,
  cardValue: cards.cardValue,
  transfers: cards.transfers,
  season: cards.serviceSeason,
};
const listingCols = {
  id: marketListings.id,
  price: marketListings.price,
  createdAt: marketListings.createdAt,
  ...cardCols,
};
type ListingRow = {
  id: string;
  price: number;
  createdAt: string;
} & { [K in keyof typeof cardCols]: unknown };

const toListing = (r: ListingRow): MarketListing => ({
  id: r.id,
  price: r.price,
  createdAt: r.createdAt,
  card: {
    careerId: r.careerId as string,
    pos: r.pos as PosGroup,
    dpos: (r.dpos as MarketListing['card']['dpos']) ?? null,
    nation: (r.nation as string | null) ?? null,
    peak: r.peak as number,
    number: (r.number as number | null) ?? null,
    publicName: (r.publicName as string | null) ?? null,
    legendScore: r.legendScore as number,
    attrs: peakOf(r.peakProfile as string | null)?.attrs ?? null,
    type: (r.type as string | null) ?? null,
    cardValue: (r.cardValue as number | null) ?? 0,
    transfers: r.transfers as number,
    season: r.season as number,
  },
});

const notHidden = sql`coalesce(${careers.hidden}, 0) = 0`;

/** 지금 시즌의 열린 등록 한 페이지(하나 더 읽어 다음 페이지가 있는지 본다). */
export async function listOpenListings(
  db: Db,
  season: number,
  q: { pos?: PosGroup | undefined; sort: MarketSort; page: number },
): Promise<{ items: MarketListing[]; hasMore: boolean }> {
  const rows = await db
    .select(listingCols)
    .from(marketListings)
    .innerJoin(cards, eq(cards.careerId, marketListings.careerId))
    .leftJoin(careers, eq(careers.id, marketListings.careerId))
    .where(
      and(
        eq(marketListings.status, 'open'),
        eq(marketListings.season, season),
        notHidden,
        q.pos ? eq(cards.pos, q.pos) : undefined,
      ),
    )
    .orderBy(
      ...(q.sort === 'price'
        ? [asc(marketListings.price), desc(marketListings.createdAt)]
        : [desc(marketListings.createdAt)]),
    )
    .limit(MARKET_PER_PAGE + 1)
    .offset(q.page * MARKET_PER_PAGE);
  return {
    items: rows.slice(0, MARKET_PER_PAGE).map(toListing),
    hasMore: rows.length > MARKET_PER_PAGE,
  };
}

/** 이번 시즌 최근에 팔린 선수(최신순). market_listings_sold_idx가 받친다. */
export async function recentSales(db: Db, season: number): Promise<MarketSale[]> {
  const rows = await db
    .select({ ...listingCols, soldAt: marketListings.closedAt })
    .from(marketListings)
    .innerJoin(cards, eq(cards.careerId, marketListings.careerId))
    .leftJoin(careers, eq(careers.id, marketListings.careerId))
    .where(and(eq(marketListings.status, 'sold'), eq(marketListings.season, season), notHidden))
    .orderBy(desc(marketListings.closedAt))
    .limit(MARKET_RECENT);
  return rows.map((r) => {
    const { id, price, card } = toListing(r);
    return { id, price, card, soldAt: r.soldAt as string };
  });
}

/** 한 등록(카드 포함). 열려 있지 않아도 돌려준다. */
export async function getListing(db: Db, id: string) {
  const [row] = await db
    .select({
      ...listingCols,
      status: marketListings.status,
      sellerId: marketListings.sellerId,
      hidden: sql<number>`coalesce(${careers.hidden}, 0)`,
    })
    .from(marketListings)
    .innerJoin(cards, eq(cards.careerId, marketListings.careerId))
    .leftJoin(careers, eq(careers.id, marketListings.careerId))
    .where(eq(marketListings.id, id));
  return row && { ...row, listing: toListing(row) };
}

/** 등록할 카드: 내가 가진 카드 + 키운 사람·숨김 + 열린 등록 여부. */
export async function cardForListing(db: Db, careerId: string) {
  const [row] = await db
    .select({
      ownerId: cards.ownerId,
      season: cards.serviceSeason,
      cardValue: cards.cardValue,
      hidden: sql<number>`coalesce(${careers.hidden}, 0)`,
      openListing: marketListings.id,
    })
    .from(cards)
    .leftJoin(careers, eq(careers.id, cards.careerId))
    .leftJoin(
      marketListings,
      and(eq(marketListings.careerId, cards.careerId), eq(marketListings.status, 'open')),
    )
    .where(eq(cards.careerId, careerId));
  return row;
}

export async function countOpenListingsOf(db: Db, sellerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(marketListings)
    .where(and(eq(marketListings.sellerId, sellerId), eq(marketListings.status, 'open')));
  return row?.n ?? 0;
}

/** T-11-145 이 선수들 중 시장에 내놓은(열린 매물) 수. */
export async function countOpenListingsAmong(
  db: Db,
  careerIds: readonly string[],
): Promise<number> {
  if (!careerIds.length) return 0;
  const row = await db.$client
    .prepare(
      `SELECT count(*) AS n FROM market_listings WHERE status = 'open' AND career_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(careerIds))
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function countBuysSince(db: Db, buyerId: string, sinceIso: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(marketListings)
    .where(and(eq(marketListings.buyerId, buyerId), gte(marketListings.closedAt, sinceIso)));
  return row?.n ?? 0;
}

export async function fundsOf(db: Db, profileId: string): Promise<number> {
  const [row] = await db
    .select({ balance: ownerFunds.balance })
    .from(ownerFunds)
    .where(eq(ownerFunds.profileId, profileId));
  return row?.balance ?? 0;
}

/**
 * 구단 가치에 더하는 선수 몫: 가진 카드의 기준가(없으면 방출 지급과 같이 CARD_VALUE_FLOOR). T-11-109 전에는 직접 키운
 * 선수를 은퇴 가치로 셌는데, 방출 지급이 기준가로 바뀌어(T-11-104) 같은 기준으로 맞춘다.
 */
async function ownedCardsValue(db: Db, profileId: string): Promise<number> {
  const [row] = await db
    .select({
      v: sql<number>`coalesce(sum(coalesce(${cards.cardValue}, ${CARD_VALUE_FLOOR})), 0)`,
    })
    .from(cards)
    .where(eq(cards.ownerId, profileId));
  return row?.v ?? 0;
}

/** 구단 자금과 구단 가치(자금 + 내가 가진 카드 몫). */
export async function marketFunds(db: Db, profileId: string) {
  const [balance, owned] = await Promise.all([
    fundsOf(db, profileId),
    ownedCardsValue(db, profileId),
  ]);
  return { balance, clubValue: balance + owned };
}

export async function myOpenListings(db: Db, sellerId: string): Promise<MarketListing[]> {
  const rows = await db
    .select(listingCols)
    .from(marketListings)
    .innerJoin(cards, eq(cards.careerId, marketListings.careerId))
    .leftJoin(careers, eq(careers.id, marketListings.careerId))
    .where(and(eq(marketListings.sellerId, sellerId), eq(marketListings.status, 'open')))
    .orderBy(desc(marketListings.createdAt));
  return rows.map(toListing);
}

export const TRADES = 30;
const tradeCard = {
  careerId: cards.careerId,
  pos: cards.pos,
  peak: cards.peak,
  number: cards.number,
  publicName: careers.publicName,
};

/** 최근 판매·영입·방출(각각 최근 TRADES건을 읽어 시각순으로 합친다). */
export async function myTrades(db: Db, profileId: string): Promise<MarketTrade[]> {
  const sold = and(eq(marketListings.sellerId, profileId), eq(marketListings.status, 'sold'));
  const [s, b, r] = await db.batch([
    db
      .select({
        id: marketListings.id,
        price: marketListings.price,
        fee: marketListings.fee,
        at: marketListings.closedAt,
        ...tradeCard,
      })
      .from(marketListings)
      .innerJoin(cards, eq(cards.careerId, marketListings.careerId))
      .leftJoin(careers, eq(careers.id, marketListings.careerId))
      .where(sold)
      .orderBy(desc(marketListings.closedAt))
      .limit(TRADES),
    db
      .select({
        id: marketListings.id,
        price: marketListings.price,
        fee: marketListings.fee,
        at: marketListings.closedAt,
        ...tradeCard,
      })
      .from(marketListings)
      .innerJoin(cards, eq(cards.careerId, marketListings.careerId))
      .leftJoin(careers, eq(careers.id, marketListings.careerId))
      .where(and(eq(marketListings.buyerId, profileId), isNotNull(marketListings.closedAt)))
      .orderBy(desc(marketListings.closedAt))
      .limit(TRADES),
    // 방출은 직접 키운 선수만 할 수 있어 키운 사람(careers.profile_id)이 곧 방출한 사람이다.
    db
      .select({
        amount: cards.releasedValue,
        at: cards.releasedAt,
        ...tradeCard,
      })
      .from(cards)
      .innerJoin(careers, eq(careers.id, cards.careerId))
      .where(and(eq(careers.profileId, profileId), isNotNull(cards.releasedAt)))
      .orderBy(desc(cards.releasedAt))
      .limit(TRADES),
  ]);
  const card = (x: {
    careerId: string;
    pos: PosGroup;
    peak: number;
    number: number | null;
    publicName: string | null;
  }) => ({
    careerId: x.careerId,
    pos: x.pos,
    peak: x.peak,
    number: x.number,
    publicName: x.publicName,
  });
  return [
    ...s.map((x) => ({
      id: x.id,
      kind: 'sold' as const,
      amount: x.price - x.fee,
      at: x.at!,
      card: card(x),
    })),
    ...b.map((x) => ({
      id: x.id,
      kind: 'bought' as const,
      amount: x.price,
      at: x.at!,
      card: card(x),
    })),
    ...r.map((x) => ({
      id: `rel_${x.careerId}`,
      kind: 'released' as const,
      amount: x.amount ?? 0,
      at: x.at!,
      card: card(x),
    })),
  ]
    .sort((a, z) => z.at.localeCompare(a.at))
    .slice(0, TRADES);
}

/** 판매 등록. 지금도 내 카드이고 열린 등록이 없을 때만 넣는다(그 사이 방출되면 0행). 넣었으면 true. */
export async function insertListing(
  db: Db,
  l: { id: string; careerId: string; sellerId: string; season: number; price: number; now: string },
): Promise<boolean> {
  const res = await db.$client
    .prepare(
      `INSERT OR IGNORE INTO market_listings (id, career_id, seller_id, season, price, status, created_at)
       SELECT ?, career_id, owner_id, service_season, ?, 'open', ? FROM cards
       WHERE career_id = ? AND owner_id = ? AND service_season = ?`,
    )
    .bind(l.id, l.price, l.now, l.careerId, l.sellerId, l.season)
    .run();
  return res.meta.changes === 1;
}

/** 내 열린 등록을 내린다. 내렸으면 true. */
export async function cancelListing(db: Db, id: string, sellerId: string, now: string) {
  const res = await db.$client
    .prepare(
      `UPDATE market_listings SET status = 'cancelled', closed_at = ?
       WHERE id = ? AND seller_id = ? AND status = 'open'`,
    )
    .bind(now, id, sellerId)
    .run();
  return res.meta.changes === 1;
}

/**
 * 구매. 1) 등록을 잡고(열려 있고 · 본 가격 그대로 · 내가 판 게 아닐 때) 2) 구매자 출금 3) 판매자 입금 4) 카드 주인을 바꾼다.
 * 2~5는 1이 남긴 표식(buyer_id · closed_at)이 있을 때만 바꾼다. 5) 시세 집계(market_daily)에 한 건 더한다. 잔액이 모자라면 CHECK 위반으로 batch 전체가 되돌아간다.
 * won = 샀다(아니면 이미 팔렸거나 내렸거나 가격이 바뀌었다). balance = 구매 뒤 내 잔액.
 */
export async function buyListing(
  db: Db,
  b: {
    id: string;
    buyerId: string;
    sellerId: string;
    price: number;
    fee: number;
    now: string;
    /** 시세 집계 묶음과 이 거래의 비율(라우트가 이미 읽은 카드로 계산한다). */
    daily: { season: number; posGroup: string; band: number; day: string; ratio: number };
  },
): Promise<{ won: boolean; balance: number }> {
  const d1 = db.$client;
  const won = `EXISTS (SELECT 1 FROM market_listings WHERE id = ? AND buyer_id = ? AND closed_at = ?)`;
  const mark = [b.id, b.buyerId, b.now] as const;
  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE market_listings SET status = 'sold', buyer_id = ?, closed_at = ?, fee = ?
         WHERE id = ? AND status = 'open' AND price = ? AND seller_id <> ?`,
      )
      .bind(b.buyerId, b.now, b.fee, b.id, b.price, b.buyerId),
    d1
      .prepare(
        `UPDATE owner_funds SET balance = balance - ?, updated_at = ? WHERE profile_id = ? AND ${won}`,
      )
      .bind(b.price, b.now, b.buyerId, ...mark),
    d1
      .prepare(
        `INSERT INTO owner_funds (profile_id, balance, updated_at)
         SELECT seller_id, price - fee, ? FROM market_listings WHERE id = ? AND buyer_id = ? AND closed_at = ?
         ON CONFLICT (profile_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = excluded.updated_at`,
      )
      .bind(b.now, ...mark),
    d1
      .prepare(
        `UPDATE cards SET owner_id = ?, transfers = transfers + 1, updated_at = ?
         WHERE career_id = (SELECT career_id FROM market_listings WHERE id = ?)
           AND owner_id = (SELECT seller_id FROM market_listings WHERE id = ?) AND ${won}`,
      )
      .bind(b.buyerId, b.now, b.id, b.id, ...mark),
    // 시세 집계(market_daily): 이 batch가 판 등록일 때만 그날(KST) 묶음에 한 건 더한다.
    d1
      .prepare(
        `INSERT INTO market_daily (season, pos_group, ovr_band, day, trades, volume, ratio_sum, ratio_min, ratio_max)
         SELECT ?, ?, ?, ?, 1, ?, ?, ?, ? WHERE ${won}
         ON CONFLICT (season, pos_group, ovr_band, day) DO UPDATE SET
           trades = trades + 1, volume = volume + excluded.volume, ratio_sum = ratio_sum + excluded.ratio_sum,
           ratio_min = min(ratio_min, excluded.ratio_min), ratio_max = max(ratio_max, excluded.ratio_max)`,
      )
      .bind(
        b.daily.season,
        b.daily.posGroup,
        b.daily.band,
        b.daily.day,
        b.price,
        ...Array(3).fill(b.daily.ratio),
        ...mark,
      ),
    ...eventNotificationStatements(
      d1,
      {
        profileId: b.sellerId,
        sourceKey: `market-sold:${b.id}`,
        now: b.now,
        content: {
          kind: 'market',
          title: '등록한 선수가 이적했어요', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          body: '판매가 완료됐어요. 이적시장에서 판매 내역과 구단 자금을 확인해 주세요.', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
          target: { type: 'screen', screen: 'market' },
        },
      },
      { sql: won, params: [...mark] },
    ),
    d1.prepare(`SELECT balance FROM owner_funds WHERE profile_id = ?`).bind(b.buyerId),
  ]);
  const bal = results.at(-1)!.results[0] as { balance: number } | undefined;
  return { won: results[0]!.meta.changes === 1, balance: bal?.balance ?? 0 };
}

/**
 * 방출: 지금 내가 가진 카드 중 내가 키웠고 숨김 아니고 판매 중이 아닌 것만. 받은 자금(카드 기준가 × 지급률, 천만 단위)을
 * 잔액에 더한다.
 */
export async function releaseCards(
  db: Db,
  r: { profileId: string; careerIds: string[]; rate: number; now: string },
): Promise<{ released: number; amount: number; balance: number }> {
  const d1 = db.$client;
  // 이 batch가 방출한 카드는 released_value = -1로 잠깐 표시한다. D1 batch는 하나의 트랜잭션이고 서로 끼어들지 않으므로
  // -1은 언제나 이 요청의 카드뿐이다(released_at = now 같은 시각 표시는 같은 밀리초의 다른 방출과 겹칠 수 있다).
  // 뒤 문장들도 요청한 카드(기본키)로 좁혀 표 전체를 훑지 않는다. 금액은 contracts releasePayout과 같은 계산.
  // T-11-104 은퇴 가치가 기준가의 수 배라 시장에 파는 것보다 방출이 늘 나았다 — 지급 기준을 기준가로 맞춘다.
  const amountOf = `CAST(round(coalesce(card_value, ${CARD_VALUE_FLOOR}) * ? / 1000.0) AS INTEGER) * 1000`;
  const ids = JSON.stringify(r.careerIds);
  const mine = `career_id IN (SELECT value FROM json_each(?)) AND released_value = -1`;
  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE cards SET owner_id = NULL, released_at = ?, updated_at = ?, released_value = -1
         WHERE career_id IN (SELECT value FROM json_each(?)) AND owner_id = ?
           AND EXISTS (SELECT 1 FROM careers c WHERE c.id = cards.career_id AND c.profile_id = ? AND c.hidden = 0)
           AND NOT EXISTS (SELECT 1 FROM market_listings l WHERE l.career_id = cards.career_id AND l.status = 'open')`,
      )
      .bind(r.now, r.now, ids, r.profileId, r.profileId),
    d1
      .prepare(
        `INSERT INTO owner_funds (profile_id, balance, updated_at)
         SELECT ?, sum(${amountOf}), ? FROM cards WHERE ${mine} HAVING count(*) > 0
         ON CONFLICT (profile_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = excluded.updated_at`,
      )
      .bind(r.profileId, r.rate, r.now, ids),
    d1
      .prepare(
        `SELECT count(*) AS n, coalesce(sum(${amountOf}), 0) AS amount FROM cards WHERE ${mine}`,
      )
      .bind(r.rate, ids),
    d1.prepare(`UPDATE cards SET released_value = ${amountOf} WHERE ${mine}`).bind(r.rate, ids),
    d1.prepare(`SELECT balance FROM owner_funds WHERE profile_id = ?`).bind(r.profileId),
  ]);
  const sum = results[2]!.results[0] as { n: number; amount: number };
  const bal = results[4]!.results[0] as { balance: number } | undefined;
  return { released: sum.n, amount: sum.amount, balance: bal?.balance ?? 0 };
}

/** 계정 삭제: 내 열린 등록을 내리고 자금 행을 지운다(소프트 삭제라 FK CASCADE가 돌지 않는다). */
export function marketDeleteStatements(db: Db, profileId: string, now: string) {
  return [
    db
      .update(marketListings)
      .set({ status: 'cancelled', closedAt: now })
      .where(and(eq(marketListings.sellerId, profileId), eq(marketListings.status, 'open'))),
    db.delete(ownerFunds).where(eq(ownerFunds.profileId, profileId)),
  ] as const;
}

/**
 * T-11-080f 시세 차트: since(KST 일자, 없으면 시즌 전체)부터 하루치 시세. group을 주면 그 묶음(기본키 앞부분),
 * 없으면 시장 전체를 일자별로 합친다(market_daily_day_idx). 평균은 천분율 합 ÷ 거래 수.
 */
export async function marketChart(
  db: Db,
  season: number,
  since: string | null,
  group: { pos: PosGroup; band: number } | null,
): Promise<MarketChartPoint[]> {
  const trades = sql<number>`sum(${marketDaily.trades})`;
  const ratioSum = sql<number>`sum(${marketDaily.ratioSum})`;
  const rows = await db
    .select({
      day: marketDaily.day,
      trades,
      volume: sql<number>`sum(${marketDaily.volume})`,
      ratioSum,
      min: sql<number>`min(${marketDaily.ratioMin})`,
      max: sql<number>`max(${marketDaily.ratioMax})`,
    })
    .from(marketDaily)
    .where(
      and(
        eq(marketDaily.season, season),
        group ? eq(marketDaily.posGroup, group.pos) : undefined,
        group ? eq(marketDaily.ovrBand, group.band) : undefined,
        since ? gte(marketDaily.day, since) : undefined,
      ),
    )
    .groupBy(marketDaily.day)
    .orderBy(asc(marketDaily.day));
  return rows.map(({ ratioSum: sum, ...r }) => ({ ...r, avg: Math.round(sum / r.trades) }));
}

/** 이 선수가 팔린 기록(최신순, 최대 20건). market_listings_card_idx가 받친다. */
export async function cardTrades(db: Db, careerId: string) {
  const rows = await db
    .select({
      price: marketListings.price,
      cardValue: cards.cardValue,
      soldAt: sql<string>`${marketListings.closedAt}`,
    })
    .from(marketListings)
    .innerJoin(cards, eq(cards.careerId, marketListings.careerId))
    .where(and(eq(marketListings.careerId, careerId), eq(marketListings.status, 'sold')))
    .orderBy(desc(marketListings.closedAt))
    .limit(20);
  return rows.map(({ cardValue, ...r }) => ({
    ...r,
    ratio: marketRatio(r.price, cardValue ?? r.price),
  }));
}
