import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import type { Profile as ContractProfile } from '@offside/contracts';
import { mutationCacheScope } from './mutationPolicy.js';
import { loadKey, saveKey, storage } from '@offside/game/storage';
import { markAchDirty, touchesAchievements } from '../achDirty.js';
import { getLocale } from '@offside/contracts/i18n';
import { settingsApiText as L } from '../i18n/ko/settingsApi.js';

// API 클라이언트 (웹·앱 공용, T-11-002). 게임 상태는 전부 기기 저장소에 남고, 서버로는 계정·공개 기록 요청만 나간다.
// `@offside/contracts` 전체를 값으로 가져오면 zod까지 번들에 들어오므로, 헤더 이름은 zod 없는 `./headers`
// 서브패스에서, 응답 타입은 type-only import로 가져온다(타입 전용 import는 컴파일 시 제거되어 번들 비용이 없다).

/** 클라이언트가 넣는 서버 주소·인증. 웹은 세션 쿠키(`credentials: 'include'`), 앱은 Authorization 헤더. */
export interface ApiHost {
  baseUrl: string;
  auth(): { credentials?: 'include' | 'omit' | 'same-origin'; headers?: Record<string, string> };
  /** 세션이 없거나 무효일 때(PROFILE_REQUIRED) 새 익명 세션을 받는다. 없으면 GET /v1/profile — 웹은 이것이
   *  새 프로필과 세션 쿠키를 만든다. 앱은 무효 토큰을 버리고 새 앱 세션을 받는다. */
  renewSession?(): Promise<boolean>;
}
let host: ApiHost = { baseUrl: 'http://localhost:8787', auth: () => ({ credentials: 'include' }) };
/** 시작할 때 한 번(첫 요청 전에) 부른다. */
export function configureApi(h: ApiHost): void {
  host = h;
  // 기기에 남긴 공개 조회(persistedGet)는 지우지 않는다 — 다시 열었을 때 쓰려고 남긴 것이다.
  clearApiCache(false);
}
export const apiBaseUrl = (): string => host.baseUrl;
export const apiAuth = (): ReturnType<ApiHost['auth']> => host.auth();

export type Profile = Pick<
  ContractProfile,
  | 'id'
  | 'linked'
  | 'googleEmailMasked'
  | 'recoveryCodeIssuedAt'
  | 'createdAt'
  | 'nickname'
  | 'avatarId'
>;

export type ApiErrorCode = string;
/** reason: 서버가 error.details.reason에 담아 보내는 세부 사유(예: HOF_NOT_FOUND). */
export type ApiError = {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  reason?: string;
  /** ID of the original server response, including when a denial is reused from cache. */
  requestId?: string;
};
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

function failure<T>(
  code: ApiErrorCode,
  message: string,
  retryable: boolean,
  requestId?: unknown,
  reason?: string,
): ApiResult<T> {
  const error: ApiError = { code, message, retryable };
  if (reason) error.reason = reason;
  if (typeof requestId === 'string' && requestId.trim()) error.requestId = requestId;
  return { ok: false, error };
}

// T-10-015. 공개 조회 결과를 메모리에 잠깐 두고, 같은 요청이 동시에 나가면 하나로 합친다 — 화면을 오갈
// 때마다 같은 목록을 다시 받지 않는다. 실패는 담지 않는다. 쓰기(POST/PUT/PATCH/DELETE)가 성공하면 전부
// 비운다: 무엇이 바뀌었는지 따지지 않고 "쓰면 다시 읽는다"로 단순하게 맞춘다(쓰기는 드물다).
const memo = new Map<string, { until: number; result: Promise<ApiResult<unknown>> }>();
const MEMO_SWEEP_AT = 100;

/** persisted: 기기에 남긴 공개 조회(persistedGet)도 함께 버린다. 쓰기 · 로그인 · 당겨서 새로고침은 버리고, 시작할 때만 남긴다. */
export function clearApiCache(persisted = true): void {
  memo.clear();
  ownerDenied = null;
  cacheGeneration++;
  if (persisted) dropPersisted();
}

// T-11-724 잘 바뀌지 않는 공개 조회(밸런스 · 구단 전력 · 게시판 첫 쪽 · 최초 기록 · 시즌 게이지 · 앱 버전)는 응답을 기기에도 남긴다.
// 메모는 메모리에만 있어 새로고침 · 앱 재시작마다 사라지는데, 남긴 응답이 메모 시간 안이면 서버에 묻지 않고 그것을 쓴다(메모
// 시간은 그대로라, 앱을 닫지 않았을 때와 같은 신선도다). 모두에게 같은 응답만 남긴다 — 사람마다 다른 응답은 남기지 않는다.
// 저장소에 지우기가 없어 세대 번호로 한꺼번에 버리고(쓰기 · 로그인 · 당겨서 새로고침), 한 경로만 버릴 때는 시각을 0으로 덮는다.
const PERSIST_PREFIX = 'ft_api:';
const PERSIST_GEN = 'ft_api_gen';
type Persisted = { gen: number; at: number; data: unknown };
const persistGen = (): number => loadKey<number>(PERSIST_GEN) ?? 0;
const persistedKeys = new Set<string>();
function dropPersisted(): void {
  saveKey(PERSIST_GEN, persistGen() + 1);
  persistedKeys.clear();
}

/** cachedGet과 같되 응답을 기기에도 남겨, 다시 열었을 때 메모 시간 안이면 서버에 묻지 않는다. 모두에게 같은 응답에만 쓴다. */
export function persistedGet<T>(path: string, ttlMs: number): Promise<ApiResult<T>> {
  const key = withLang(path);
  const hit = memo.get(key);
  if (hit && Date.now() < hit.until) return hit.result as Promise<ApiResult<T>>;
  persistedKeys.add(key);
  const saved = loadKey<Persisted>(PERSIST_PREFIX + key);
  const age = saved ? Date.now() - saved.at : -1;
  if (saved && saved.gen === persistGen() && age >= 0 && age < ttlMs && saved.data !== undefined) {
    const result = Promise.resolve<ApiResult<T>>({ ok: true, data: saved.data as T });
    memo.set(key, { until: saved.at + ttlMs, result });
    return result;
  }
  const result = cachedGet<T>(path, ttlMs);
  const generation = cacheGeneration;
  void result.then((r) => {
    // 받는 사이에 메모를 비웠으면(쓰기 · 로그인) 낡은 응답일 수 있어 남기지 않는다.
    if (r.ok && generation === cacheGeneration)
      saveKey(PERSIST_PREFIX + key, { gen: persistGen(), at: Date.now(), data: r.data });
  });
  return result;
}

// Only a server-confirmed owner denial is memoized. Network/auth/server failures remain retryable.
let ownerDenied: { locale: string; until: number; error: ApiError } | null = null;
let cacheGeneration = 0;
export async function ownerCachedGet<T>(path: string, ttlMs: number): Promise<ApiResult<T>> {
  const locale = getLocale();
  if (ownerDenied?.locale === locale && Date.now() < ownerDenied.until)
    return { ok: false, error: ownerDenied.error };
  const generation = cacheGeneration;
  const result = await cachedGet<T>(path, ttlMs);
  if (
    generation === cacheGeneration &&
    !result.ok &&
    result.error.reason === 'GOOGLE_LOGIN_REQUIRED'
  )
    ownerDenied = { locale, until: Date.now() + 10 * 60_000, error: result.error };
  return result;
}

/**
 * T-11-106 서버가 만드는 문장(업적·최초 기록·오류 안내 등)을 지금 언어로 받는다. 영어·일본어일 때만 `lang=en|ja`를
 * 붙인다 — 한국어 요청은 예전과 같은 주소라 엣지 캐시 키도 그대로다.
 */
export function withLang(path: string): string {
  const lang = getLocale();
  return lang === 'ko' ? path : `${path}${path.includes('?') ? '&' : '?'}lang=${lang}`;
}

/** 새 서버 이벤트를 실제로 열 때 해당 기능만 갱신한다. 다른 화면의 메모는 유지한다. */
export function invalidateApiCache(prefix: string): void {
  const under = (key: string) =>
    key === prefix || key.startsWith(`${prefix}?`) || key.startsWith(`${prefix}/`);
  for (const key of memo.keys()) if (under(key)) memo.delete(key);
  // 기기에 남긴 응답도 버린다(이번 실행에서 읽은 경로만 안다 — 그 밖의 것은 메모 시간이 지나면 버려진다).
  for (const key of persistedKeys)
    if (under(key)) saveKey(PERSIST_PREFIX + key, { gen: -1, at: 0, data: null });
}

/** GET을 ttlMs 동안 메모한다. 같은 path의 진행 중 요청도 함께 쓴다(언어가 다르면 다른 요청이다). */
export function cachedGet<T>(path: string, ttlMs: number): Promise<ApiResult<T>> {
  const key = withLang(path);
  const hit = memo.get(key);
  if (hit && Date.now() < hit.until) return hit.result as Promise<ApiResult<T>>;
  const result = apiFetch<T>(path, { method: 'GET' });
  // 선수 상세를 많이 열면 키가 늘어난다 — 일정 크기를 넘으면 만료된 것만 걷어 낸다.
  if (memo.size >= MEMO_SWEEP_AT)
    for (const [k, v] of memo) if (Date.now() >= v.until) memo.delete(k);
  memo.set(key, { until: Date.now() + ttlMs, result });
  void result.then((r) => {
    if (!r.ok && memo.get(key)?.result === result) memo.delete(key);
  });
  return result;
}

/** T-11-301 응답 없이 매달리는 요청의 상한. iOS에서 요청 중 앱이 뒤로 가면 소켓이 조용히 끊겨 fetch가 영원히
 * 끝나지 않았다(공지 칸이 "불러오는 중"에 멈추고, 업로드 큐가 그 약속에 묶여 은퇴 기록이 안 올라갔다).
 * 이 시간이 지나면 끊고 네트워크 오류로 돌려준다 — 부르는 쪽은 같은 재시도 경로를 탄다. */
export const API_TIMEOUT_MS = 15_000;

/** fetch에 시간 상한을 둔다. 호출자가 준 signal도 함께 듣는다. AbortController가 없는 런타임은 그대로 부른다. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  ms = API_TIMEOUT_MS,
): Promise<Response> {
  if (typeof AbortController !== 'function') return fetch(input, init);
  const ctl = new AbortController();
  const outer = init.signal;
  if (outer?.aborted) ctl.abort();
  else outer?.addEventListener('abort', () => ctl.abort(), { once: true });
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** keepCache: 조회수 같은 카운터 쓰기 — 메모해 둔 목록을 비울 만큼의 변화가 아니다. */
export async function apiFetch<T>(
  path: string,
  { keepCache = false, ...init }: RequestInit & { keepCache?: boolean } = {},
): Promise<ApiResult<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const isMutation =
    method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const body = isMutation && init.body === undefined ? '{}' : init.body;
  const { headers: authHeaders, ...auth } = host.auth();
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(authHeaders ?? {})) headers.set(k, v);
  headers.set('Accept', 'application/json');
  if ((body !== undefined || isMutation) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD' && !headers.has(IDEMPOTENCY_KEY_HEADER)) {
    headers.set(IDEMPOTENCY_KEY_HEADER, crypto.randomUUID());
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${host.baseUrl}${withLang(path)}`, {
      ...init,
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      ...auth,
    });
  } catch {
    return failure('NETWORK_ERROR', L.network, true);
  }

  if (isMutation && response.ok && !keepCache) {
    const scope = mutationCacheScope(path);
    if (scope) invalidateApiCache(scope);
    else clearApiCache();
  }
  // T-11-034 업적이 바뀌었을 수 있는 쓰기 — 다음 화면에서 업적을 한 번 받아 새 업적을 알린다.
  if (isMutation && response.ok && touchesAchievements(path)) markAchDirty();
  if (response.status === 204) return { ok: true, data: undefined as T };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return failure('INVALID_RESPONSE', L.badResponse, false);
  }

  // Optional chaining also tolerates primitive/null metadata; failure validates the ID itself.
  const requestId = (json as { meta?: { requestId?: unknown } } | null)?.meta?.requestId;
  if (!response.ok) {
    const e = (
      json as {
        error?: {
          code?: string;
          message?: string;
          retryable?: boolean;
          details?: { reason?: unknown };
        };
      } | null
    )?.error;
    if (e !== undefined) {
      const reason = typeof e.details?.reason === 'string' ? e.details.reason : undefined;
      if (e.code === 'PROFILE_REQUIRED') noteSession(false);
      return failure(e.code ?? 'UNKNOWN', e.message ?? L.failed, !!e.retryable, requestId, reason);
    }
    return failure(
      'INVALID_RESPONSE',
      L.failedStatus({ status: response.status }),
      response.status >= 500,
      requestId,
    );
  }
  if (typeof json !== 'object' || json === null || !('data' in json)) {
    return failure('INVALID_RESPONSE', L.badShape, false, requestId);
  }
  return { ok: true, data: (json as { data: unknown }).data as T };
}

export async function getProfile(): Promise<ApiResult<Profile>> {
  const r = await apiFetch<Profile>('/v1/profile', { method: 'GET' });
  if (r.ok) {
    noteSession(true);
    if (r.data.linked.google || r.data.linked.apple) {
      ownerDenied = null;
      cacheGeneration++;
    }
  }
  return r;
}

/** 세션이 없다는 응답(PROFILE_REQUIRED)을 받은 뒤 새 익명 세션을 받는다. 받았으면 true. 동시에 여러 곳에서 불러도 한 번만 나간다. */
let renewing: Promise<boolean> | null = null;
export const renewSession = (): Promise<boolean> =>
  (renewing ??= (host.renewSession ? host.renewSession() : getProfile().then((r) => r.ok)).finally(
    () => {
      renewing = null;
    },
  ));

/** 아직 프로필이 없거나 세션이 무효인 기기면 새 익명 세션을 받은 뒤 한 번 더 보낸다. 익명 프로필로 충분한
 *  요청(좋아요·신고·차단)만 쓴다 — PROFILE_REQUIRED가 로그인 안내인 요청에 쓰면 새 프로필이 생긴다. */
export async function withProfile<T>(send: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const r = await send();
  if (!r.ok && r.error.code === 'PROFILE_REQUIRED' && (await renewSession())) return send();
  return r;
}

// T-10-037: 세션 쿠키는 API 도메인의 httpOnly라 웹에서 읽을 수 없다. 프로필 조회가 한 번이라도 성공했으면
// 표시를 남겨 두고, 표시가 없는 첫 방문자에게는 부팅 때 세션 전용 요청(→ 401)을 보내지 않는다. 어느 요청이든
// 서버가 세션이 없다고(PROFILE_REQUIRED) 하면 apiFetch가 지운다.
const SESSION_HINT = 'ft_session';
export function hasSessionHint(): boolean {
  try {
    return storage().getItem(SESSION_HINT) === '1';
  } catch {
    return false;
  }
}
export function noteSession(on: boolean) {
  try {
    storage().setItem(SESSION_HINT, on ? '1' : '0');
  } catch {
    // 저장소를 못 쓰면 표시 없이 그대로 둔다.
  }
}
