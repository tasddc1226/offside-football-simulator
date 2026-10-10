// T-11-080 이적시장 · 구단 자금 · 방출 API. 이적시장 화면(지연 청크)만 import한다. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  BuyListingResponse,
  CareerPos,
  CreateListingResponse,
  MarketCardTradesResponse,
  MarketChartRange,
  MarketChartResponse,
  MarketFundsResponse,
  MarketListResponse,
  MarketMeResponse,
  MarketSort,
  ReleaseCardsResponse,
  CardLockResponse,
} from '@offside/contracts';
import { apiFetch, cachedGet, clearApiCache, type ApiResult } from './client.js';

export type {
  MarketCard,
  MarketChartPoint,
  MarketChartRange,
  MarketFundsResponse,
  MarketListing,
  MarketListResponse,
  MarketMeResponse,
  MarketRules,
  MarketSale,
  MarketSort,
  MarketTrade,
} from '@offside/contracts';

/** 지금 시즌 열린 등록. 서버가 첫 페이지를 15초 엣지 캐시한다. 쓰기(등록·취소·영입)는 메모를 비운다. */
export const fetchMarket = (sort: MarketSort, pos: CareerPos | undefined, page: number) =>
  cachedGet<MarketListResponse>(
    `/v1/market?sort=${sort}${pos ? `&pos=${pos}` : ''}${page ? `&page=${page}` : ''}`,
    30_000,
  );
/** 시세 차트(T-11-080f). pos·band가 없으면 시장 전체. 서버가 1분 엣지 캐시하니 메모도 1분. */
export const fetchMarketChart = (
  range: MarketChartRange,
  group?: { pos: CareerPos; band: number },
) =>
  cachedGet<MarketChartResponse>(
    `/v1/market/chart?range=${range}${group ? `&pos=${group.pos}&band=${group.band}` : ''}`,
    60_000,
  );
/** 이 선수가 팔린 기록(카드 상세 차트의 점). 영입 시트를 열 때만. */
export const fetchCardTrades = (careerId: string) =>
  cachedGet<MarketCardTradesResponse>(`/v1/market/cards/${careerId}/trades`, 60_000);
/** 구단주 화면 요약: 구단 자금 · 구단 가치만(구글 연결 구단주만). */
export const fetchMarketFunds = () => cachedGet<MarketFundsResponse>('/v1/market/funds', 60_000);
/** 내 자금 · 구단 가치 · 열린 등록 · 최근 거래(구글 연결 구단주만). 이적시장 화면을 열 때만. */
export const fetchMarketMe = () => cachedGet<MarketMeResponse>('/v1/market/me', 60_000);
export const createListing = (careerId: string, price: number) =>
  apiFetch<CreateListingResponse>('/v1/market/listings', {
    method: 'POST',
    body: JSON.stringify({ careerId, price }),
  });
/** 이미 팔렸거나 내렸거나 가격이 바뀐 등록이라 실패했나(화면은 목록을 새로 받는다). */
export const isStaleListing = (e: { reason?: string | undefined }) =>
  e.reason === 'LISTING_GONE' || e.reason === 'PRICE_CHANGED';
/** 실패한 쓰기는 메모를 비우지 않으니 낡은 등록이면 여기서 비워 목록을 새로 받게 한다. */
function dropStale<T>(r: ApiResult<T>): ApiResult<T> {
  if (!r.ok && isStaleListing(r.error)) clearApiCache();
  return r;
}
export const cancelListing = (id: string) =>
  apiFetch<undefined>(`/v1/market/listings/${id}`, { method: 'DELETE' }).then(dropStale);
/** 화면에서 본 가격을 함께 보낸다(그 사이 바뀌었으면 PRICE_CHANGED). */
export const buyListing = (id: string, price: number) =>
  apiFetch<BuyListingResponse>(`/v1/market/listings/${id}/buy`, {
    method: 'POST',
    body: JSON.stringify({ price }),
  }).then(dropStale);
export const releaseCards = (careerIds: string[]) =>
  apiFetch<ReleaseCardsResponse>('/v1/cards/release', {
    method: 'POST',
    body: JSON.stringify({ careerIds }),
  });
/** T-11-188 선수 잠금·풀기. 성공하면 메모가 비어 구단주 팀을 새로 받는다. */
export const setCardLock = (careerId: string, locked: boolean) =>
  apiFetch<CardLockResponse>('/v1/cards/lock', {
    method: 'POST',
    body: JSON.stringify({ careerId, locked }),
  });
