// T-11-418 오프사이드 리그 API. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type { LeagueMeResponse, LeagueResponse } from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';

export type { LeagueMeResponse, LeagueResponse } from '@offside/contracts';

/** 리그 한눈에(누구나): 일정 · 단계 · 신청 수. 서버 캐시 30초. */
export const fetchLeague = () => cachedGet<LeagueResponse>('/v1/leagues/current', 30_000);
/** 내 신청 · 자격. 리그 화면을 열 때만 부른다. */
export const fetchLeagueMe = () => apiFetch<LeagueMeResponse>('/v1/leagues/current/me');

// 쓰기 성공이면 apiFetch가 조회 캐시를 비운다.
export const enterLeague = () =>
  apiFetch<undefined>('/v1/leagues/current/entries', { method: 'POST' });
export const withdrawLeague = () =>
  apiFetch<undefined>('/v1/leagues/current/entries/me', { method: 'DELETE' });
