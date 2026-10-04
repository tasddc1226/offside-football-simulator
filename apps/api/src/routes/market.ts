import {
  BuyListingBodySchema,
  BuyListingResponseSchema,
  CreateListingBodySchema,
  CreateListingResponseSchema,
  ListingIdSchema,
  MarketListQuerySchema,
  MarketListResponseSchema,
  MarketMeResponseSchema,
  ReleaseCardsBodySchema,
  ReleaseCardsResponseSchema,
} from '@offside/contracts';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { newId } from '../db/ids.js';
import {
  buyListing,
  cancelListing,
  cardForListing,
  countBuysSince,
  countOpenListingsOf,
  fundsOf,
  getListing,
  insertListing,
  listOpenListings,
  marketRules,
  myOpenListings,
  myTrades,
  ownedCardsValue,
  priceBand,
  releaseCards,
} from '../db/repos/market.js';
import { myTeamIn, slotIdsOf } from '../db/repos/ownerTeams.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { kstDays } from '../time.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-080 이적시장 · 구단 자금 · 방출. 거래는 지금 팀 시즌 카드끼리만 한다(프리시즌이면 프리시즌 카드).
// 방출·시장은 구글 연결된 구단주만(requireOwner) — 익명 프로필에는 자금이 생기지 않는다.

/** 목록 엣지 캐시(초). 쓰기는 이 데이터센터의 첫 페이지 사본을 지우고, 다른 곳은 TTL 안에 새로 읽는다. */
const LIST_TTL = 15;
const CACHE = `public, max-age=${LIST_TTL}`;

const kstTodayStart = (now: string) => kstDays(new Date(now), 1).startIso;

function seasonOrThrow(now: string): number {
  const season = teamSeasonAt(now);
  if (season === null)
    throw conflictError('지금은 시즌 사이 휴식기라 이적시장이 닫혀 있어요.', 'MARKET_CLOSED');
  return season;
}

const listingGone = () => conflictError('이미 팔렸거나 내린 선수예요.', 'LISTING_GONE');
const fundsShort = () => conflictError('구단 자금이 모자라요.', 'FUNDS_SHORT');
const listingIdOf = (c: Context<AppEnv>) =>
  parseWithAppError(ListingIdSchema, c.req.param('listingId'));

export function registerMarketRoutes(app: Hono<AppEnv>): void {
  // 지금 시즌 열린 등록(공개 · 세션 조회 없음). 첫 페이지만 엣지에 담는다(포지션·정렬별 몇 개뿐).
  app.get('/v1/market', async (c) => {
    const q = parseWithAppError(MarketListQuerySchema, {
      pos: c.req.query('pos') || undefined,
      sort: c.req.query('sort') || undefined,
      page: c.req.query('page') || undefined,
    });
    const season = teamSeasonAt(nowIso());
    const load = async () => {
      const db = getDb(c);
      const rules = await marketRules(db);
      if (season === null) return { season, items: [], hasMore: false, rules };
      return { season, ...(await listOpenListings(db, season, q)), rules };
    };
    const data =
      q.page === 0 && season !== null
        ? await edgeCached(c, EDGE.marketList(season, q.sort, q.pos), LIST_TTL, load)
        : await load();
    return ok(c, MarketListResponseSchema, data, 200, CACHE);
  });

  // 내 자금 · 구단 가치 · 열린 등록 · 최근 거래. 이적시장 화면을 열 때 한 번 부른다(웹 메모).
  app.get('/v1/market/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const [[funds], [owned], [bought], listings, trades, rules] = await Promise.all([
      fundsOf(db, me.id),
      ownedCardsValue(db, me.id),
      countBuysSince(db, me.id, kstTodayStart(now)),
      myOpenListings(db, me.id),
      myTrades(db, me.id),
      marketRules(db),
    ]);
    const balance = funds?.balance ?? 0;
    return ok(
      c,
      MarketMeResponseSchema,
      {
        season: teamSeasonAt(now),
        balance,
        clubValue: balance + Number(owned?.v ?? 0),
        listings,
        trades,
        buysLeft: Math.max(0, rules.dailyBuys - Number(bought?.n ?? 0)),
        rules,
      },
      200,
      NO_STORE,
    );
  });

  // 판매 등록: 지금 시즌의 내 카드 · 기준가 있음 · 숨김 아님 · 열린 등록 없음 · 가격이 범위 안 · 동시 등록 상한 안.
  app.post('/v1/market/listings', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, CreateListingBodySchema);
    const now = nowIso();
    const season = seasonOrThrow(now);
    const [card, [open], rules] = await Promise.all([
      cardForListing(db, input.careerId),
      countOpenListingsOf(db, me.id),
      marketRules(db),
    ]);
    if (!card || card.ownerId !== me.id)
      throw notFoundError('내 선수 카드를 찾을 수 없어요.', 'CARD_NOT_FOUND');
    if (card.season !== season)
      throw conflictError('이번 시즌 선수만 내놓을 수 있어요.', 'CARD_OTHER_SEASON');
    if (card.cardValue === null || card.hidden)
      throw conflictError('기준가가 없는 선수는 내놓을 수 없어요.', 'CARD_NOT_TRADABLE');
    if (card.openListing) throw conflictError('이미 내놓은 선수예요.', 'CARD_LISTED');
    if (Number(open?.n ?? 0) >= rules.listLimit)
      throw conflictError(`한 번에 ${rules.listLimit}명까지 내놓을 수 있어요.`, 'LISTING_LIMIT');
    const band = priceBand(card.cardValue, rules);
    if (input.price < band.min || input.price > band.max)
      throw conflictError('판매가가 정할 수 있는 범위를 벗어났어요.', 'PRICE_OUT_OF_BAND');
    const id = newId('lst');
    if (
      !(await insertListing(db, {
        id,
        careerId: input.careerId,
        sellerId: me.id,
        season,
        price: input.price,
        now,
      }))
    )
      throw conflictError('이미 내놓았거나 방출한 선수예요.', 'CARD_LISTED');
    purgeEdge(c, STALE.marketChanged(season));
    const listing = (await getListing(db, id))!.listing;
    return ok(c, CreateListingResponseSchema, { listing }, 201, NO_STORE);
  });

  // 판매 취소(내 열린 등록만).
  app.delete('/v1/market/listings/:listingId', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const id = listingIdOf(c);
    const found = await getListing(db, id);
    if (!found || found.sellerId !== me.id || found.status !== 'open') throw listingGone();
    if (!(await cancelListing(db, id, me.id, nowIso()))) throw listingGone();
    purgeEdge(c, STALE.marketChanged(found.listingSeason));
    return c.body(null, 204);
  });

  // 영입. 화면에서 본 가격을 함께 보낸다 — 그 사이 내렸거나 팔렸거나 가격이 다르면 409.
  app.post('/v1/market/listings/:listingId/buy', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const id = listingIdOf(c);
    const input = readBody(c, BuyListingBodySchema);
    const now = nowIso();
    const season = seasonOrThrow(now);
    const [found, [funds], [bought], rules] = await Promise.all([
      getListing(db, id),
      fundsOf(db, me.id),
      countBuysSince(db, me.id, kstTodayStart(now)),
      marketRules(db),
    ]);
    if (!found || found.status !== 'open' || found.hidden || found.listingSeason !== season)
      throw listingGone();
    if (found.sellerId === me.id) throw conflictError('내가 내놓은 선수예요.', 'OWN_LISTING');
    if (found.price !== input.price)
      throw conflictError('판매가가 바뀌었어요. 다시 확인해 주세요.', 'PRICE_CHANGED');
    if (Number(bought?.n ?? 0) >= rules.dailyBuys)
      throw conflictError(
        `오늘은 ${rules.dailyBuys}명까지 영입할 수 있어요. 내일 다시 영입해 주세요.`,
        'DAILY_BUY_LIMIT',
      );
    // 잔액 행이 없거나 모자라면 batch 전에 막는다(행이 없으면 출금 UPDATE가 0행으로 지나가 공짜가 된다).
    if ((funds?.balance ?? 0) < input.price) throw fundsShort();
    let result: 'won' | 'lost';
    try {
      result = await buyListing(db, {
        id,
        buyerId: me.id,
        price: input.price,
        fee: Math.round(input.price * rules.feeRate),
        now,
      });
    } catch (e) {
      // 같은 구단주가 동시에 두 선수를 사서 잔액이 모자라게 되면 CHECK 위반으로 batch 전체가 되돌아간다.
      if (String(e).includes('CHECK constraint failed')) throw fundsShort();
      throw e;
    }
    if (result === 'lost') throw listingGone();
    purgeEdge(c, STALE.marketChanged(season));
    const [after] = await fundsOf(db, me.id);
    return ok(c, BuyListingResponseSchema, { balance: after?.balance ?? 0 }, 200, NO_STORE);
  });

  // 방출(한 명 또는 여러 명). 직접 키운 선수만, 판매 중이거나 지금 시즌 선발에 든 선수는 뺀다. 되돌릴 수 없다.
  app.post('/v1/cards/release', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, ReleaseCardsBodySchema);
    const now = nowIso();
    const season = teamSeasonAt(now);
    const [[team], rules] = await Promise.all([
      season === null ? Promise.resolve([]) : myTeamIn(db, me.id, season),
      marketRules(db),
    ]);
    const lineup = new Set(team ? slotIdsOf(team) : []);
    if (input.careerIds.some((id) => lineup.has(id)))
      throw conflictError('선발에 든 선수는 팀에서 뺀 뒤 방출해 주세요.', 'IN_LINEUP');
    const res = await releaseCards(db, {
      profileId: me.id,
      careerIds: [...new Set(input.careerIds)],
      rate: rules.releaseRate,
      now,
    });
    if (res.released === 0)
      throw conflictError('방출할 수 있는 선수가 없어요.', 'NOTHING_TO_RELEASE');
    return ok(c, ReleaseCardsResponseSchema, res, 200, NO_STORE);
  });
}
