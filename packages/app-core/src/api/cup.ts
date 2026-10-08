// T-11-145 오프사이드 컵 · 구단주 아이템(선수 후보 리롤권) API. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  CupMatchResponse,
  CupMeResponse,
  CupResponse,
  OwnerItemsResponse,
  RerollShopResponse,
} from '@offside/contracts';
import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import { apiFetch, cachedGet } from './client.js';

export type {
  CupMatch,
  CupMatchResponse,
  CupMeResponse,
  CupPhase,
  CupResponse,
  CupStanding,
  CupTeam,
  CupHonor,
  OwnerItemsResponse,
  RerollShopResponse,
} from '@offside/contracts';

/** 대회 한눈에(누구나). cupId 'current' = 지금 보여 줄 대회. 서버 캐시 30초. */
export const fetchCup = (cupId = 'current') => cachedGet<CupResponse>(`/v1/cups/${cupId}`, 30_000);
/** 내 참가·자격·다음 경기·명단 잠금·리롤권. */
export const fetchCupMe = (cupId = 'current') => apiFetch<CupMeResponse>(`/v1/cups/${cupId}/me`);
export const fetchCupMatch = (cupId: string, matchId: string) =>
  cachedGet<CupMatchResponse>(`/v1/cups/${cupId}/matches/${matchId}`, 60_000);

// 쓰기 성공이면 apiFetch가 조회 캐시를 비운다.
export const enterCup = (cupId: string) =>
  apiFetch<undefined>(`/v1/cups/${cupId}/entries`, { method: 'POST' });
export const withdrawCup = (cupId: string) =>
  apiFetch<undefined>(`/v1/cups/${cupId}/entries/me`, { method: 'DELETE' });

// 후보 화면에 들어올 때마다 묻지 않게 잠깐 메모한다. 리롤권을 쓰면(쓰기 성공) apiFetch가 메모를 비운다.
export const fetchItems = () => cachedGet<OwnerItemsResponse>('/v1/items', 30_000);
/**
 * 리롤권 1장 쓰기. 성공하면 남은 장수 — 그다음 gameActions.rerollCandidates()로 후보를 다시 뽑는다.
 * key는 한 번의 '다시 뽑기' 시도마다 하나: 응답을 못 받아 다시 누르면 같은 key로 보내 서버가 두 번 차감하지 않는다.
 */
export const spendReroll = (key: string) =>
  apiFetch<OwnerItemsResponse>('/v1/items/reroll/use', {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
  });

/** T-11-152 리롤권 상점(가진 장수 · 자금 · 다음 가격 · 오늘 산 장수). 상점을 펼칠 때만. 사면(쓰기 성공) 메모가 비워진다. */
export const fetchRerollShop = () => cachedGet<RerollShopResponse>('/v1/items/shop', 30_000);
/**
 * 리롤권 1장 사기. price는 화면에서 본 가격(그 사이 바뀌었으면 409 PRICE_CHANGED). key는 한 번의 '사기' 시도마다 하나 —
 * 응답을 못 받아 다시 누르면 같은 key로 보내 두 장을 사지 않는다.
 */
export const buyReroll = (price: number, key: string) =>
  apiFetch<RerollShopResponse>('/v1/items/reroll/buy', {
    method: 'POST',
    body: JSON.stringify({ price }),
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
  });
