// T-11-373 카드 강화 API. 강화 창(지연 청크)만 import한다. 상태는 창을 열 때 한 번 받고(메모하지 않음 — 잔액 · 남은 횟수가
// 시도마다 바뀐다), 시도는 화면이 본 단계 · 비용을 함께 보낸다(어긋나면 ENHANCE_STALE). 성공한 쓰기는 apiFetch가 메모를 비운다.
import type { EnhanceResponse, EnhanceStateResponse } from '@offside/contracts';
import { apiFetch } from './client.js';

export type { EnhanceResponse, EnhanceStateResponse } from '@offside/contracts';

export const fetchEnhanceState = () => apiFetch<EnhanceStateResponse>('/v1/cards/enhance');

export const enhanceCard = (careerId: string, level: number, cost: number) =>
  apiFetch<EnhanceResponse>(`/v1/cards/${careerId}/enhance`, {
    method: 'POST',
    body: JSON.stringify({ level, cost }),
  });
