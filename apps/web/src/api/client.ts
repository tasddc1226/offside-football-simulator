import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import type { Profile as ContractProfile, HofDetailResponse, HofListResponse, MyCareersResponse } from '@offside/contracts';
import { resolveApiBaseUrl } from './base-url.js';

// API 클라이언트 최소본 (계정: 로그인/프로필/연동 해제/로그아웃/삭제 만). 게임 상태는 전부
// localStorage에 남고 서버로 보내지 않는다. `@offside/contracts` 전체를 값으로 가져오면 zod까지
// 번들에 들어오므로, 헤더 이름은 zod 없는 `./headers` 서브패스에서, 응답 타입은 type-only import로
// 가져온다(타입 전용 import는 컴파일 시 제거되어 번들 비용이 없다).
export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined,
  typeof window === 'undefined' ? undefined : window.location.hostname,
);

export type Profile = Pick<
  ContractProfile,
  'id' | 'linked' | 'googleEmailMasked' | 'recoveryCodeIssuedAt' | 'createdAt'
>;

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

// ───────── T-10-005 공개 명예의 전당 (로그인 불필요) ─────────
export function getHof(limit = 50, page = 1): Promise<ApiResult<HofListResponse>> {
  return apiFetch<HofListResponse>(`/v1/hof?limit=${limit}${page > 1 ? `&page=${page}` : ''}`, { method: 'GET' });
}
/** T-10-013. 이 계정의 은퇴 선수. 익명 프로필이면 linked=false. */
export function getMyCareers(): Promise<ApiResult<MyCareersResponse>> {
  return apiFetch<MyCareersResponse>('/v1/careers/mine', { method: 'GET' });
}
export function getHofDetail(careerId: string): Promise<ApiResult<HofDetailResponse>> {
  return apiFetch<HofDetailResponse>(`/v1/hof/${encodeURIComponent(careerId)}`, { method: 'GET' });
}
