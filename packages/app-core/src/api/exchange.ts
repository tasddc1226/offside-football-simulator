// T-11-374 카드 바치기 과제 API. 과제 목록은 코드 묶음(contracts card-exchange-rules)이라 부르지 않는다. 카드 과제 창(지연 청크)만 import한다.
import type { ExchangeClaimResponse, ExchangeMeResponse } from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';

/** 이번 주 · 이번 시즌 과제마다 내가 낸 횟수. 창을 열 때만, 메모 1분(내면 메모가 비워진다). */
export const fetchExchangeMe = () => cachedGet<ExchangeMeResponse>('/v1/exchanges/me', 60_000);
/** 카드 내기. 성공하면 메모가 비어 내 팀 · 아이템을 새로 받는다. */
export const claimExchange = (id: string, careerIds: string[]) =>
  apiFetch<ExchangeClaimResponse>(`/v1/exchanges/${encodeURIComponent(id)}/claim`, {
    method: 'POST',
    body: JSON.stringify({ careerIds }),
  });
