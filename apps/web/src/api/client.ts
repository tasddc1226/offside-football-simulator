// API 클라이언트 최소본 (계정: 로그인/프로필/연동 해제/로그아웃/삭제 만). 게임 상태는 전부
// localStorage에 남고 서버로 보내지 않는다. 응답 타입은 로컬에 정의해 API 계약 패키지와 번들 결합을 피한다.
// @offside/contracts 전체를 가져오면 zod까지 번들에 들어오므로 헤더 이름만 직접 둔다(API와 동일한 값).
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
import { resolveApiBaseUrl } from './base-url.js';

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined,
  typeof window === 'undefined' ? undefined : window.location.hostname,
);

export interface Profile {
  id: string;
  linked: { google: boolean };
  googleEmailMasked: string | null;
  recoveryCodeIssuedAt: string | null;
  createdAt: string;
}

export type ApiErrorCode = string;
export type ApiError = { code: ApiErrorCode; message: string; retryable: boolean };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

function failure<T>(code: ApiErrorCode, message: string, retryable: boolean): ApiResult<T> {
  return { ok: false, error: { code, message, retryable } };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
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

  if (response.status === 204) return { ok: true, data: undefined as T };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return failure('INVALID_RESPONSE', '서버 응답을 해석할 수 없습니다.', false);
  }

  if (!response.ok) {
    if (json && typeof json === 'object' && 'error' in json) {
      const e = (json as { error: { code?: string; message?: string; retryable?: boolean } }).error;
      return failure(e.code ?? 'UNKNOWN', e.message ?? '요청이 실패했습니다.', !!e.retryable);
    }
    return failure('INVALID_RESPONSE', `요청이 실패했습니다(${response.status}).`, response.status >= 500);
  }
  if (typeof json !== 'object' || json === null || !('data' in json)) {
    return failure('INVALID_RESPONSE', '서버 응답 형식이 올바르지 않습니다.', false);
  }
  return { ok: true, data: (json as { data: unknown }).data as T };
}

export function getProfile(): Promise<ApiResult<Profile>> {
  return apiFetch<Profile>('/v1/profile', { method: 'GET' });
}
export function unlinkGoogle(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/auth/google/unlink', { method: 'POST' });
}
export function logout(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/auth/logout', { method: 'POST' });
}
export function startProfileDeletion(): Promise<ApiResult<{ confirmToken: string; expiresAt: string }>> {
  return apiFetch('/v1/profile/delete', { method: 'POST' });
}
export function confirmProfileDeletion(confirmToken: string): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/profile/delete', { method: 'POST', body: JSON.stringify({ confirmToken }) });
}
export function googleStartUrl(): string {
  return `${API_BASE_URL}/v1/auth/google/start`;
}
