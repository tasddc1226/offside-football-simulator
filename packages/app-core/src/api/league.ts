// T-11-418 오프사이드 리그 API. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  LeagueMatchResponse,
  LeagueMeResponse,
  LeagueNewsResponse,
  LeaguePredictionCounts,
  LeaguePredictionMeResponse,
  LeaguePredictionPick,
  LeagueResponse,
  LeagueTableResponse,
} from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';

export type {
  LeagueHonor,
  LeagueMatch,
  LeagueMatchResponse,
  LeagueMeResponse,
  LeagueResponse,
  LeagueStanding,
  LeagueTableResponse,
  LeagueTeam,
} from '@offside/contracts';

/** 리그 한눈에(누구나): 일정 · 단계 · 신청 수. 서버 캐시 30초. */
// T-11-503 홈 리그 배너가 홈에 돌아올 때마다 다시 받지 않게 2분. 참가 · 취소는 apiFetch가 메모를 비운다.
export const fetchLeague = () => cachedGet<LeagueResponse>('/v1/leagues/current', 120_000);
/** 내 신청 · 자격. 리그 화면을 열 때만 부른다. */
export const fetchLeagueMe = () => apiFetch<LeagueMeResponse>('/v1/leagues/current/me');

// 쓰기 성공이면 apiFetch가 조회 캐시를 비운다.
export const enterLeague = () =>
  apiFetch<undefined>('/v1/leagues/current/entries', { method: 'POST' });
export const withdrawLeague = () =>
  apiFetch<undefined>('/v1/leagues/current/entries/me', { method: 'DELETE' });

/** T-11-418b 리그 하나(누구나): 팀 · 순위표 · 14라운드. 서버 캐시 60초. 고른 리그를 열 때만 부른다. */
export const fetchLeagueTable = (season: number, tier: number, league: number) =>
  cachedGet<LeagueTableResponse>(`/v1/leagues/${season}/tables/${tier}/${league}`, 60_000);
/** T-11-418b 리그 경기 상세(득점 기록). 끝난 경기는 바뀌지 않는다. */
export const fetchLeagueMatch = (season: number, matchId: string) =>
  cachedGet<LeagueMatchResponse>(
    `/v1/leagues/${season}/matches/${encodeURIComponent(matchId)}`,
    10 * 60_000,
  );

// ───────── T-11-652 오프사이드 데일리 · 빅매치 예측 ─────────
export type {
  LeagueBigMatch,
  LeagueNewsItem,
  LeagueNewsMatch,
  LeagueNewsPlayer,
  LeagueNewsResponse,
  LeaguePredictionCounts,
  LeaguePredictionMeResponse,
  LeaguePredictionPick,
} from '@offside/contracts';

/** 끝난 라운드 신문(누구나). 끝난 라운드는 바뀌지 않아 오래 둔다. 리그 화면을 열 때만 부른다. */
export const fetchLeagueNews = (season: number, round: number) =>
  cachedGet<LeagueNewsResponse>(`/v1/leagues/${season}/news/${round}`, 10 * 60_000);
/** 빅매치 예측 수(누구나, 서버 캐시 30초). */
export const fetchLeaguePredictionCounts = (season: number, matchId: string) =>
  cachedGet<LeaguePredictionCounts>(
    `/v1/leagues/${season}/matches/${encodeURIComponent(matchId)}/predictions`,
    30_000,
  );
/** 내 예측 · 적중 기록. */
export const fetchLeaguePredictionsMe = (season: number) =>
  apiFetch<LeaguePredictionMeResponse>(`/v1/leagues/${season}/predictions/me`);
/** 빅매치 예측(경기 시각 전까지 바꿀 수 있다). 바뀐 예측 수를 돌려준다. */
export const putLeaguePrediction = (season: number, matchId: string, pick: LeaguePredictionPick) =>
  apiFetch<LeaguePredictionCounts>(
    `/v1/leagues/${season}/matches/${encodeURIComponent(matchId)}/prediction`,
    { method: 'PUT', body: JSON.stringify({ pick }) },
  );
