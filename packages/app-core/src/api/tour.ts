// T-11-825 원정 투어 API. 투어 화면(지연 청크)만 import한다. 사다리 · 제한 · 수치는 contracts에 있어 따로 부르지 않는다.
import type {
  TourMatchResponse,
  TourOrderBody,
  TourRankingResponse,
  TourStartBody,
  TourStateResponse,
} from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';

/** 투어 홈(이번 주 사다리 · 내 진행 · 진행 중인 경기). 화면을 열 때만, 메모 1분(출발 · 지시를 보내면 메모가 비워진다). */
export const fetchTour = () => cachedGet<TourStateResponse>('/v1/tour', 60_000);
/** 주간 순위. 순위 탭을 열 때만, 메모 1분. */
export const fetchTourRanking = () => cachedGet<TourRankingResponse>('/v1/tour/ranking', 60_000);
/** 원정 출발(도전권 한 번). 첫 30분까지 치른 경기를 돌려준다. */
export const startTourMatch = (body: TourStartBody) =>
  apiFetch<TourMatchResponse>('/v1/tour/matches', { method: 'POST', body: JSON.stringify(body) });
/** 작전 타임 지시를 보내고 다음 30분을 치른다. */
export const orderTourMatch = (id: string, body: TourOrderBody) =>
  apiFetch<TourMatchResponse>(`/v1/tour/matches/${encodeURIComponent(id)}/orders`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
