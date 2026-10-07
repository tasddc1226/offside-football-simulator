// T-11-145 오프사이드 컵 · 구단주 아이템(선수 후보 리롤권) API. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  CupMatchResponse,
  CupMeResponse,
  CupResponse,
  OwnerItemsResponse,
} from '@offside/contracts';
import { apiFetch, cachedGet, invalidateApiCache } from './client.js';

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
} from '@offside/contracts';

/** 대회 한눈에(누구나). cupId 'current' = 지금 보여 줄 대회. 서버 캐시 30초. */
export const fetchCup = (cupId = 'current') => cachedGet<CupResponse>(`/v1/cups/${cupId}`, 30_000);
/** 내 참가·자격·다음 경기·명단 잠금·리롤권. */
export const fetchCupMe = (cupId = 'current') => apiFetch<CupMeResponse>(`/v1/cups/${cupId}/me`);
export const fetchCupMatch = (cupId: string, matchId: string) =>
  cachedGet<CupMatchResponse>(`/v1/cups/${cupId}/matches/${matchId}`, 60_000);

export async function enterCup(cupId: string) {
  const r = await apiFetch<null>(`/v1/cups/${cupId}/entries`, { method: 'POST' });
  invalidateApiCache('/v1/cups');
  return r;
}
export async function withdrawCup(cupId: string) {
  const r = await apiFetch<null>(`/v1/cups/${cupId}/entries/me`, { method: 'DELETE' });
  invalidateApiCache('/v1/cups');
  return r;
}

export const fetchItems = () => apiFetch<OwnerItemsResponse>('/v1/items');
/** 리롤권 1장 쓰기. 성공하면 남은 장수 — 그다음 gameActions.rerollCandidates()로 후보를 다시 뽑는다. */
export const useReroll = () =>
  apiFetch<OwnerItemsResponse>('/v1/items/reroll/use', { method: 'POST' });
