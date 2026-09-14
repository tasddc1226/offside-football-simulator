// API 클라이언트 최소본. base URL은 VITE_API_BASE_URL(없으면 http://localhost:8787),
// credentials: 'include', JSON 본문, 응답 봉투(data/error)를 해석해 오류는 { code, message,
// retryable }로 정규화한다. GET이 아닌 요청에는 Idempotency-Key 헤더를 붙인다. T-1-011 동기화
// 클라이언트가 apiFetch를 재사용한다.
import {
  CareerSummaryListSchema,
  DeleteProfileStartResponseSchema,
  ErrorEnvelopeSchema,
  GetCareerResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  IssueRecoveryCodeResponseSchema,
  LivePresenceSchema,
  MergeResponseSchema,
  NoticesResponseSchema,
  ProfileSchema,
  RecoverProfileResponseSchema,
  ServiceSeasonCurrentSchema,
  type CareerSummaryList,
  type DeleteProfileStartResponse,
  type ErrorCode,
  type GetCareerResponse,
  type IssueRecoveryCodeResponse,
  type LivePresence,
  type MergeChoice,
  type MergeResponse,
  type NoticesResponse,
  type Profile,
  type RecoverProfileResponse,
  type ServiceSeasonCurrent,
} from '@offside/contracts';
import { resolveApiBaseUrl } from './base-url.js';

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined,
  typeof window === 'undefined' ? undefined : window.location.hostname,
);

export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE';
export type ApiError = { code: ApiErrorCode; message: string; retryable: boolean; details?: unknown };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * contracts가 export하는 zod 스키마의 구조(safeParse)만 필요하다 — apps/web은 zod를 직접
 * 의존하지 않는다(ADR-005, src/shared/ui-store.ts와 같은 규칙).
 */
export interface DataSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

function failure<T>(code: ApiErrorCode, message: string, retryable: boolean, details?: unknown): ApiResult<T> {
  return { ok: false, error: { code, message, retryable, ...(details !== undefined ? { details } : {}) } };
}

/**
 * `path`(예: `/v1/profile`)에 요청을 보내고 성공 봉투의 `data`를 돌려준다. `dataSchema`가 있으면
 * 그것으로 검증하고, 없으면 `data` 필드 존재만 확인한다(contracts 스키마가 아직 없는 엔드포인트용).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}, dataSchema?: DataSchema<T>): Promise<ApiResult<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const body = isMutation && init.body === undefined ? '{}' : init.body;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if ((body !== undefined || isMutation) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD' && !headers.has(IDEMPOTENCY_KEY_HEADER)) {
    headers.set(IDEMPOTENCY_KEY_HEADER, crypto.randomUUID());
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      credentials: 'include',
    });
  } catch {
    return failure('NETWORK_ERROR', '서버에 연결할 수 없습니다.', true);
  }

  // 204는 HTTP 정의상 항상 성공 상태다(2xx) — 본문이 없어 data 봉투를 해석할 수 없으니 여기서 끝낸다.
  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return failure('INVALID_RESPONSE', '서버 응답을 해석할 수 없습니다.', false);
  }

  if (!response.ok) {
    const parsedError = ErrorEnvelopeSchema.safeParse(json);
    if (parsedError.success) {
      const { code, message, retryable, details } = parsedError.data.error;
      return failure(code, message, retryable, details);
    }
    return failure('INVALID_RESPONSE', `요청이 실패했습니다(${response.status}).`, response.status >= 500);
  }

  if (typeof json !== 'object' || json === null || !('data' in json)) {
    return failure('INVALID_RESPONSE', '서버 응답 형식이 올바르지 않습니다.', false);
  }
  const data = (json as { data: unknown }).data;

  if (dataSchema === undefined) {
    return { ok: true, data: data as T };
  }
  const parsedData = dataSchema.safeParse(data);
  if (!parsedData.success) {
    return failure('INVALID_RESPONSE', '서버 응답 형식이 올바르지 않습니다.', false);
  }
  return { ok: true, data: parsedData.data };
}

/** API-PRO-001. */
export function getProfile(): Promise<ApiResult<Profile>> {
  return apiFetch('/v1/profile', { method: 'GET' }, ProfileSchema);
}

/** API-PRO-003. 세션은 GET /v1/profile이 없으면 서버가 첫 요청에서 만들어 쿠키로 내려준다. */
export function issueRecoveryCode(): Promise<ApiResult<IssueRecoveryCodeResponse>> {
  return apiFetch('/v1/profile/recovery-code', { method: 'POST' }, IssueRecoveryCodeResponseSchema);
}

/** API-CAR-005. 성공 시 204(본문 없음). */
export function deleteCareerOnServer(careerId: string): Promise<ApiResult<undefined>> {
  return apiFetch(`/v1/careers/${careerId}`, { method: 'DELETE' });
}

/**
 * API-PRO-004. `RECOVERY_CONFLICT`(409)면 `error.details`에 `currentCareerCount`·
 * `targetCareerCount`가 담긴다(`RecoveryConflictDetailsSchema`로 좁혀 읽는다).
 */
export function recoverProfile(body: { code: string; mergeChoice?: MergeChoice }): Promise<ApiResult<RecoverProfileResponse>> {
  return apiFetch('/v1/profile/recover', { method: 'POST', body: JSON.stringify(body) }, RecoverProfileResponseSchema);
}

/** API-PRO-005 1단계. 본문 없음 → `{ confirmToken, expiresAt }`. */
export function startProfileDeletion(): Promise<ApiResult<DeleteProfileStartResponse>> {
  return apiFetch('/v1/profile/delete', { method: 'POST' }, DeleteProfileStartResponseSchema);
}

/** API-PRO-005 2단계. 성공 시 204(본문 없음). */
export function confirmProfileDeletion(confirmToken: string): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/profile/delete', { method: 'POST', body: JSON.stringify({ confirmToken }) });
}

/** API-AUTH-004. 성공 시 204(본문 없음). 로컬 IndexedDB는 건드리지 않는다(ADR-008). */
export function logout(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/auth/logout', { method: 'POST' });
}

/** API-CAR-001. 복구 뒤 대조(D-20)가 서버 커리어 목록을 페이지별로 읽는 데 쓴다. */
export function listRemoteCareers(cursor?: string): Promise<ApiResult<CareerSummaryList>> {
  const query = cursor !== undefined ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiFetch(`/v1/careers${query}`, { method: 'GET' }, CareerSummaryListSchema);
}

/** API-CAR-002. 복구 뒤 대조가 `importCareerFromServer`에 넘길 응답을 받는다. */
export function getRemoteCareer(careerId: string): Promise<ApiResult<GetCareerResponse>> {
  return apiFetch(`/v1/careers/${careerId}`, { method: 'GET' }, GetCareerResponseSchema);
}

/** API-AUTH-003. `merge_required` 콜백 뒤 선택을 확정한다. */
export function submitGoogleMerge(mergeChoice: MergeChoice): Promise<ApiResult<MergeResponse>> {
  return apiFetch('/v1/auth/merge', { method: 'POST', body: JSON.stringify({ mergeChoice }) }, MergeResponseSchema);
}

/** API-AUTH-006. 성공 시 204(본문 없음). */
export function unlinkGoogle(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/auth/google/unlink', { method: 'POST' });
}

/** API-SVC-001. 프로필 세션이 필요 없는 공개 엔드포인트. */
export function getServiceSeasonCurrent(): Promise<ApiResult<ServiceSeasonCurrent>> {
  return apiFetch('/v1/service-seasons/current', { method: 'GET' }, ServiceSeasonCurrentSchema);
}

/** API-PRES-001. 프로필 세션이 필요 없는 공개 GET. D-78. */
export function getLivePresence(): Promise<ApiResult<LivePresence>> {
  return apiFetch('/v1/presence', { method: 'GET' }, LivePresenceSchema);
}

/** API-PRES-002. 성공·세션 없음 모두 204(본문 없음). D-78. */
export function postPresenceHeartbeat(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/presence/heartbeat', { method: 'POST', body: '{}' });
}

/** API-NOTICE-001. 프로필 세션이 필요 없는 공개 엔드포인트. `limit` 생략 시 서버 기본값(10). */
export function getNotices(limit?: number): Promise<ApiResult<NoticesResponse>> {
  const query = limit !== undefined ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return apiFetch(`/v1/notices${query}`, { method: 'GET' }, NoticesResponseSchema);
}
