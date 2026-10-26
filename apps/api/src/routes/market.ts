import {
  BuyListingBodySchema,
  BuyListingResponseSchema,
  CardLockBodySchema,
  CardLockResponseSchema,
  CareerIdParamSchema,
  CreateListingBodySchema,
  CreateListingResponseSchema,
  FundsHistoryQuerySchema,
  FundsHistoryResponseSchema,
  ListingIdSchema,
  MARKET_CHART_DAYS,
  MarketCardTradesResponseSchema,
  MarketChartQuerySchema,
  MarketChartResponseSchema,
  MarketFacetsResponseSchema,
  MarketListQuerySchema,
  MarketFundsResponseSchema,
  MarketListResponseSchema,
  MarketMeResponseSchema,
  ReleaseCardsBodySchema,
  ReleaseCardsResponseSchema,
} from '@offside/contracts';
import { marketFee, marketRatio, ovrBand, priceBand } from '@offside/contracts/market-value';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { newId } from '../db/ids.js';
import { fundsHistory } from '../db/repos/fundsHistory.js';
import {
  buyListing,
  cancelListing,
  cardForListing,
  cardTrades,
  countBuysSince,
  fundsOf,
  getListing,
  insertListing,
  listOpenListings,
  marketChart,
  marketFacets,
  marketFunds,
  marketRules,
  myOpenListings,
  myTrades,
  TRADES,
  recentSales,
  releaseCards,
  setCardLocked,
} from '../db/repos/market.js';
import { myFundsSpends } from '../db/repos/itemShop.js';
import { myTeamIn, slotIdsOf } from '../db/repos/ownerTeams.js';
import { checkCupListing } from './cup.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { kstDay, kstDays } from '../time.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { kstTodayStart, requireOwner } from './ownerTeam.js';
import {
  conflictError,
  fundsShort,
  isFundsCheck,
  NO_STORE,
  notFoundError,
  nowIso,
  ok,
  readBody,
} from './shared.js';

// T-11-080 이적시장 · 구단 자금 · 방출. 거래는 지금 팀 시즌 카드끼리만 한다(프리시즌이면 프리시즌 카드).
// 방출·시장은 구글 연결된 구단주만(requireOwner) — 익명 프로필에는 자금이 생기지 않는다.

/** 목록 엣지 캐시(초). purgeEdge는 그 데이터센터 사본만 지우므로 쓰지 않고 짧은 TTL로 둔다(이미 팔린 매물은 409). */
const LIST_TTL = 15;
const CACHE = `public, max-age=${LIST_TTL}`;
/** 시세 차트 엣지 캐시(초). 하루치 집계라 1분이면 충분하다. */
const CHART_TTL = 60;
const CHART_CACHE = `public, max-age=${CHART_TTL}`;

const cardLocked = () =>
  conflictError('잠긴 선수예요. 잠금을 풀어야 내놓을 수 있어요.', 'CARD_LOCKED');

function seasonOrThrow(now: string): number {
  const season = teamSeasonAt(now);
  if (season === null)
    throw conflictError('지금은 시즌 사이 휴식기라 이적시장이 닫혀 있어요.', 'MARKET_CLOSED');
  return season;
}

const inLineup = () =>
  conflictError('선발에 든 선수는 팀에서 뺀 뒤 내놓거나 방출해 주세요.', 'IN_LINEUP');
const listingGone = () => conflictError('이미 팔렸거나 내린 선수예요.', 'LISTING_GONE');
/** T-11-310 감독으로 분류된 카드(감독 커리어 중 · 감독 카드)는 거래 · 방출 · 잠금 대상이 아니다. */
const cardManager = () =>
  conflictError('감독으로 분류된 선수는 내놓거나 방출하거나 잠글 수 없어요.', 'CARD_MANAGER');
const listingIdOf = (c: Context<AppEnv>) =>
  parseWithAppError(ListingIdSchema, c.req.param('listingId'));

export function registerMarketRoutes(app: Hono<AppEnv>): void {
  // 열린 등록(공개 · 세션 조회 없음). T-11-425부터 모든 시즌 카드가 함께 오른다. 첫 페이지만 엣지에 담는다(포지션·세부 포지션·유형·정렬이 모두
  // 정해진 목록이라 키 수가 묶여 있다).
  // 시즌 사이 휴식기에는 닫는다.
  app.get('/v1/market', async (c) => {
    const q = parseWithAppError(MarketListQuerySchema, {
      pos: c.req.query('pos') || undefined,
      dpos: c.req.query('dpos') || undefined,
      type: c.req.query('type') || undefined,
      nation: c.req.query('nation') || undefined,
      league: c.req.query('league') || undefined,
      club: c.req.query('club') || undefined,
      sort: c.req.query('sort') || undefined,
      page: c.req.query('page') || undefined,
    });
    const season = teamSeasonAt(nowIso());
    if (season === null)
      return ok(
        c,
        MarketListResponseSchema,
        { season, items: [], hasMore: false, recent: [] },
        200,
        CACHE,
      );
    // 첫 페이지에는 '방금 이적' 띠(최근 거래)를 함께 싣는다 — 따로 부르지 않고 같은 엣지 캐시를 탄다.
    const load = async () => {
      const db = getDb(c);
      const [list, recent] = await Promise.all([
        listOpenListings(db, q),
        q.page === 0 ? recentSales(db) : Promise.resolve([]),
      ]);
      return { season, ...list, recent };
    };
    // T-11-500 국적 · 리그 · 클럽으로 거른 목록은 키가 많아(국적 61 · 클럽 190여 곳 × 정렬 × 포지션) 엣지에 담지 않는다.
    // 열린 매물만 훑는 가벼운 조회이고, 화면 메모 · 브라우저 캐시가 같은 요청을 다시 보내지 않는다.
    const searched = !!(q.nation || q.league || q.club);
    const data =
      q.page === 0 && !searched
        ? await edgeCached(c, EDGE.marketList(season, q.sort, q), LIST_TTL, load)
        : await load();
    return ok(c, MarketListResponseSchema, data, 200, CACHE);
  });

  // T-11-500 '국적 · 팀' 시트의 고를 거리(공개 · 세션 조회 없음). 열린 매물이 있는 국적 · 리그 · 클럽과 매물 수. 시즌마다 키 하나.
  app.get('/v1/market/facets', async (c) => {
    const season = teamSeasonAt(nowIso());
    if (season === null)
      return ok(
        c,
        MarketFacetsResponseSchema,
        { nations: [], leagues: [], clubs: [] },
        200,
        CHART_CACHE,
      );
    const data = await edgeCached(c, EDGE.marketFacets(season), CHART_TTL, () =>
      marketFacets(getDb(c)),
    );
    return ok(c, MarketFacetsResponseSchema, data, 200, CHART_CACHE);
  });

  // T-11-080f 시세 차트(공개 · 세션 조회 없음). 묶음(포지션군 · OVR대) 또는 시장 전체의 하루치 시세.
  // 키는 시즌 · 기간 · 묶음뿐이라(포지션 4 × OVR대 21 × 기간 3 + 시장 전체 3) 엣지에 담는다. 새 거래는 1분 안에 보인다.
  app.get('/v1/market/chart', async (c) => {
    const q = parseWithAppError(MarketChartQuerySchema, {
      range: c.req.query('range') || undefined,
      pos: c.req.query('pos') || undefined,
      band: c.req.query('band') || undefined,
    });
    const now = nowIso();
    const season = teamSeasonAt(now);
    if (season === null)
      return ok(c, MarketChartResponseSchema, { season, points: [] }, 200, CHART_CACHE);
    const group = q.pos !== undefined && q.band !== undefined ? { pos: q.pos, band: q.band } : null;
    const days = MARKET_CHART_DAYS[q.range];
    const since = days ? kstDays(new Date(now), days).days[0]! : null;
    const data = await edgeCached(
      c,
      EDGE.marketChart(season, q.range, group ?? undefined),
      CHART_TTL,
      async () => ({ season, points: await marketChart(getDb(c), season, since, group) }),
    );
    return ok(c, MarketChartResponseSchema, data, 200, CHART_CACHE);
  });

  // 이 선수가 팔린 기록(공개). 카드마다 키가 생기므로 엣지에는 담지 않고 브라우저 캐시만 둔다.
  app.get('/v1/market/cards/:careerId/trades', async (c) => {
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    return ok(
      c,
      MarketCardTradesResponseSchema,
      { trades: await cardTrades(getDb(c), careerId) },
      200,
      CHART_CACHE,
    );
  });

  // 구단주 화면 요약: 구단 자금 · 구단 가치(쿼리 둘).
  app.get('/v1/market/funds', requireProfile, async (c) => {
    const me = await requireOwner(c);
    return ok(c, MarketFundsResponseSchema, await marketFunds(getDb(c), me.id), 200, NO_STORE);
  });

  // 구단 자금 내역(구단주 화면 → 구단 자금): 출처별 합과 최근 순 내역(페이지).
  app.get('/v1/market/funds/history', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const q = parseWithAppError(FundsHistoryQuerySchema, {
      page: c.req.query('page') || undefined,
    });
    return ok(
      c,
      FundsHistoryResponseSchema,
      await fundsHistory(getDb(c), me.id, q.page),
      200,
      NO_STORE,
    );
  });

  // 내 자금 · 구단 가치 · 열린 등록 · 최근 거래. 이적시장 화면을 열 때 한 번 부른다(웹 메모).
  app.get('/v1/market/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const [funds, bought, listings, trades, spends, rules] = await Promise.all([
      marketFunds(db, me.id),
      countBuysSince(db, me.id, kstTodayStart(now)),
      myOpenListings(db, me.id),
      myTrades(db, me.id),
      myFundsSpends(db, me.id, TRADES),
      marketRules(db),
    ]);
    return ok(
      c,
      MarketMeResponseSchema,
      {
        season: teamSeasonAt(now),
        ...funds,
        listings,
        trades,
        spends,
        boughtToday: bought,
        rules,
      },
      200,
      NO_STORE,
    );
  });

  // 판매 등록: 내 카드(T-11-425부터 출신 시즌과 상관없이) · 기준가 있음 · 숨김 아님 · 선발 아님 · 열린 등록 없음 · 가격이 범위 안. T-11-474 동시 등록 상한은 없앴다.
  app.post('/v1/market/listings', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, CreateListingBodySchema);
    const now = nowIso();
    const season = seasonOrThrow(now);
    const teamSeason = teamSeasonAt(now);
    const [card, rules, [team]] = await Promise.all([
      cardForListing(db, input.careerId),
      marketRules(db),
      teamSeason === null ? Promise.resolve([]) : myTeamIn(db, me.id, teamSeason),
    ]);
    if (!card || card.ownerId !== me.id)
      throw notFoundError('내 선수 카드를 찾을 수 없어요.', 'CARD_NOT_FOUND');
    if (card.cardValue === null || card.hidden)
      throw conflictError('기준가가 없는 선수는 내놓을 수 없어요.', 'CARD_NOT_TRADABLE');
    if (card.manager) throw cardManager();
    if (card.openListing) throw conflictError('이미 내놓은 선수예요.', 'CARD_LISTED');
    if (card.locked) throw cardLocked();
    // T-11-474 지금 시즌 선발은 팀에서 뺀 뒤에 내놓는다(팔기 탭에도 보이지 않는다).
    if (team && slotIdsOf(team).includes(input.careerId)) throw inLineup();
    await checkCupListing(db, me.id, season, input.careerId);
    const band = priceBand(card.cardValue, rules);
    if (input.price < band.min || input.price > band.max)
      throw conflictError('판매가가 정해진 범위를 벗어났어요.', 'PRICE_OUT_OF_BAND');
    const id = newId('lst');
    if (
      !(await insertListing(db, {
        id,
        careerId: input.careerId,
        sellerId: me.id,
        price: input.price,
        now,
      }))
    )
      throw conflictError('이미 내놓았거나 방출했거나 잠근 선수예요.', 'CARD_LISTED');
    const listing = (await getListing(db, id))!.listing;
    return ok(c, CreateListingResponseSchema, { listing }, 201, NO_STORE);
  });

  // 판매 취소(내 열린 등록만).
  app.delete('/v1/market/listings/:listingId', requireProfile, async (c) => {
    const me = await requireOwner(c);
    if (!(await cancelListing(getDb(c), listingIdOf(c), me.id, nowIso()))) throw listingGone();
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
    const [found, funds, rules] = await Promise.all([
      getListing(db, id),
      fundsOf(db, me.id),
      marketRules(db),
    ]);
    if (!found || found.status !== 'open' || found.hidden) throw listingGone();
    const card = found.listing.card;
    if (found.sellerId === me.id) throw conflictError('내가 내놓은 선수예요.', 'OWN_LISTING');
    if (found.price !== input.price)
      throw conflictError('판매가가 바뀌었어요. 다시 확인해 주세요.', 'PRICE_CHANGED');
    // T-11-474 하루 영입 수 제한은 없앴다(오늘 영입 수는 화면 통계로만 센다).
    // 잔액 행이 없거나 모자라면 batch 전에 막는다(행이 없으면 출금 UPDATE가 0행으로 지나가 공짜가 된다).
    if (funds < input.price) throw fundsShort();
    let result: Awaited<ReturnType<typeof buyListing>>;
    try {
      result = await buyListing(db, {
        id,
        sellerId: found.sellerId,
        buyerId: me.id,
        price: input.price,
        fee: marketFee(input.price, rules.feeRate),
        now,
        daily: {
          season,
          posGroup: card.pos,
          band: ovrBand(card.peak),
          day: kstDay(now),
          ratio: marketRatio(input.price, card.cardValue),
        },
      });
    } catch (e) {
      // 같은 구단주가 동시에 두 선수를 사서 잔액이 모자라게 되면 CHECK 위반으로 batch 전체가 되돌아간다.
      if (isFundsCheck(e)) throw fundsShort();
      throw e;
    }
    if (!result.won) throw listingGone();
    return ok(c, BuyListingResponseSchema, { balance: result.balance }, 200, NO_STORE);
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
    if (input.careerIds.some((id) => lineup.has(id))) throw inLineup();
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

  // T-11-188 선수 잠금·풀기. 지금 가진 카드면 시즌과 상관없이(영입한 선수도) 잠근다. 판매 중이면 내린 뒤 잠근다.
  app.post('/v1/cards/lock', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, CardLockBodySchema);
    if (
      await setCardLocked(db, {
        careerId: input.careerId,
        profileId: me.id,
        locked: input.locked,
        now: nowIso(),
      })
    )
      return ok(c, CardLockResponseSchema, { locked: input.locked }, 200, NO_STORE);
    const card = await cardForListing(db, input.careerId);
    if (!card || card.ownerId !== me.id)
      throw notFoundError('내 선수 카드를 찾을 수 없어요.', 'CARD_NOT_FOUND');
    if (card.manager) throw cardManager();
    throw conflictError('판매 중인 선수예요. 판매를 내린 뒤 잠글 수 있어요.', 'CARD_LISTED');
  });
}
