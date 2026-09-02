// API 클라이언트 최소본. base URL은 VITE_API_BASE_URL(없으면 http://localhost:8787),
// credentials: 'include', JSON 본문, 응답 봉투(data/error)를 해석해 오류는 { code, message,
// retryable }로 정규화한다. GET이 아닌 요청에는 Idempotency-Key 헤더를 붙인다. T-1-011 동기화
// 클라이언트가 apiFetch를 재사용한다.
import {
  ErrorEnvelopeSchema,
  IDEMPOTENCY_KEY_HEADER,
  IssueRecoveryCodeResponseSchema,
  ProfileSchema,
  type ErrorCode,
  type IssueRecoveryCodeResponse,
  type Profile,
} from '@offside/contracts';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787';

export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE';
export type ApiError = { code: ApiErrorCode; message: string; retryable: boolean };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * contracts가 export하는 zod 스키마의 구조(safeParse)만 필요하다 — apps/web은 zod를 직접
 * 의존하지 않는다(ADR-005, src/shared/ui-store.ts와 같은 규칙).
 */
export interface DataSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

function failure<T>(code: ApiErrorCode, message: string, retryable: boolean): ApiResult<T> {
  return { ok: false, error: { code, message, retryable } };
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

  let json: unknown;
  try {
    json = response.status === 204 ? null : await response.json();
  } catch {
    return failure('INVALID_RESPONSE', '서버 응답을 해석할 수 없습니다.', false);
  }

  if (!response.ok) {
    const parsedError = ErrorEnvelopeSchema.safeParse(json);
    if (parsedError.success) {
      const { code, message, retryable } = parsedError.data.error;
      return failure(code, message, retryable);
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
