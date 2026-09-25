import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import type { Profile as ContractProfile, HofDetailResponse, HofListResponse, HofSort, MyCareersResponse } from '@offside/contracts';
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

// T-10-015. 공개 조회 결과를 메모리에 잠깐 두고, 같은 요청이 동시에 나가면 하나로 합친다 — 화면을 오갈
// 때마다 같은 목록을 다시 받지 않는다. 실패는 담지 않는다. 쓰기(POST/PUT/PATCH/DELETE)가 성공하면 전부
// 비운다: 무엇이 바뀌었는지 따지지 않고 "쓰면 다시 읽는다"로 단순하게 맞춘다(쓰기는 드물다).
const memo = new Map<string, { until: number; result: Promise<ApiResult<unknown>> }>();

export function clearApiCache(): void {
  memo.clear();
}

/** GET을 ttlMs 동안 메모한다. 같은 path의 진행 중 요청도 함께 쓴다. */
export function cachedGet<T>(path: string, ttlMs: number): Promise<ApiResult<T>> {
  const hit = memo.get(path);
  if (hit && Date.now() < hit.until) return hit.result as Promise<ApiResult<T>>;
  const result = apiFetch<T>(path, { method: 'GET' });
  memo.set(path, { until: Date.now() + ttlMs, result });
  void result.then((r) => {
    if (!r.ok && memo.get(path)?.result === result) memo.delete(path);
  });
  return result;
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

  if (isMutation && response.ok) clearApiCache();
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
export function getHof(limit = 50, page = 1, sort: HofSort = 'score'): Promise<ApiResult<HofListResponse>> {
  const q = `limit=${limit}${page > 1 ? `&page=${page}` : ''}${sort !== 'score' ? `&sort=${sort}` : ''}`;
  return cachedGet<HofListResponse>(`/v1/hof?${q}`, 60_000);
}
/** T-10-013. 이 계정의 은퇴 선수. 익명 프로필이면 linked=false. */
export function getMyCareers(): Promise<ApiResult<MyCareersResponse>> {
  return cachedGet<MyCareersResponse>('/v1/careers/mine', 60_000);
}
export function getHofDetail(careerId: string): Promise<ApiResult<HofDetailResponse>> {
  return cachedGet<HofDetailResponse>(`/v1/hof/${encodeURIComponent(careerId)}`, 300_000);
}
