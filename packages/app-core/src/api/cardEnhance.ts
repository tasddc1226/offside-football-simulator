// T-11-373 카드 강화 API. 강화 창(지연 청크)만 import한다. 상태는 창을 열 때 한 번 받고(메모하지 않음 — 잔액 · 시도권이
// 시도마다 바뀐다), 시도는 화면이 본 단계 · 실패 수 · 쓴 시도권 · 비용 · 확률을 함께 보낸다(어긋나면 ENHANCE_STALE). 같은 시도의
// 재시도는 같은 멱등 키를 보내 서버가 한 번만 판정 · 차감한다. 성공한 쓰기는 apiFetch가 메모를 비운다.
import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import type {
  EnhanceAutoBody,
  EnhanceAutoResponse,
  EnhanceBody,
  EnhanceResponse,
  EnhanceStateResponse,
  EnhanceStatsResponse,
} from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';

export type {
  EnhanceBody,
  EnhanceResponse,
  EnhanceStateResponse,
  EnhanceStatsResponse,
} from '@offside/contracts';

export const fetchEnhanceState = (careerId: string) =>
  apiFetch<EnhanceStateResponse>(`/v1/cards/${encodeURIComponent(careerId)}/enhance`);

export const enhanceCard = (careerId: string, body: EnhanceBody, requestKey: string) =>
  apiFetch<EnhanceResponse>(`/v1/cards/${encodeURIComponent(careerId)}/enhance`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: requestKey },
    body: JSON.stringify(body),
  });

export type { EnhanceAutoBody, EnhanceAutoResponse } from '@offside/contracts';

/** T-11-679 자동 강화 한 요청(서버가 ENHANCE_AUTO_CHUNK번까지 굴린다). */
export const enhanceCardAuto = (careerId: string, body: EnhanceAutoBody, requestKey: string) =>
  apiFetch<EnhanceAutoResponse>(`/v1/cards/${encodeURIComponent(careerId)}/enhance/auto`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: requestKey },
    body: JSON.stringify(body),
  });

/** T-11-758 강화 실제 결과(표시 확률별 성공 수). '실제 결과 보기'를 펼칠 때만 부르고, 서버가 6시간에 한 번 집계하므로 그동안 다시 부르지 않는다. */
export const fetchEnhanceStats = () =>
  cachedGet<EnhanceStatsResponse>('/v1/card-enhance/stats', 6 * 60 * 60_000);
