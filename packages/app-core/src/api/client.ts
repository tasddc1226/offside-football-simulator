import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import { LIVE_POLL_SEC, TICKER_POLL_SEC } from '@offside/contracts/polling';
import type {
  Profile as ContractProfile,
  FirstsResponse,
  HofDetailResponse,
  HofListResponse,
  CareerPos,
  HofSort,
  LiveResponse,
  MyCareersResponse,
  RetiredNumberCheckResponse,
  RetiredNumbersResponse,
  RetiredNumbersSummary,
  TickerResponse,
} from '@offside/contracts';
import { storage } from '@offside/game/storage';
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
}
export const apiBaseUrl = (): string => host.baseUrl;
export const apiAuth = (): ReturnType<ApiHost['auth']> => host.auth();

export type Profile = Pick<
  ContractProfile,
  'id' | 'linked' | 'googleEmailMasked' | 'recoveryCodeIssuedAt' | 'createdAt' | 'nickname'
>;

export type ApiErrorCode = string;
/** reason: 서버가 error.details.reason에 담아 보내는 세부 사유(예: HOF_NOT_FOUND). */
export type ApiError = { code: ApiErrorCode; message: string; retryable: boolean; reason?: string };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

function failure<T>(
  code: ApiErrorCode,
  message: string,
  retryable: boolean,
  reason?: string,
): ApiResult<T> {
  return { ok: false, error: { code, message, retryable, ...(reason ? { reason } : {}) } };
}

// T-10-015. 공개 조회 결과를 메모리에 잠깐 두고, 같은 요청이 동시에 나가면 하나로 합친다 — 화면을 오갈
// 때마다 같은 목록을 다시 받지 않는다. 실패는 담지 않는다. 쓰기(POST/PUT/PATCH/DELETE)가 성공하면 전부
// 비운다: 무엇이 바뀌었는지 따지지 않고 "쓰면 다시 읽는다"로 단순하게 맞춘다(쓰기는 드물다).
const memo = new Map<string, { until: number; result: Promise<ApiResult<unknown>> }>();
const MEMO_SWEEP_AT = 100;

export function clearApiCache(): void {
  memo.clear();
}

/**
 * T-11-106 서버가 만드는 문장(업적·최초 기록·오류 안내 등)을 지금 언어로 받는다. 영어일 때만 `lang=en`을 붙인다 —
 * 한국어 요청은 예전과 같은 주소라 엣지 캐시 키도 그대로다.
 */
export function withLang(path: string): string {
  return getLocale() === 'en' ? `${path}${path.includes('?') ? '&' : '?'}lang=en` : path;
}

/** 새 서버 이벤트를 실제로 열 때 해당 기능만 갱신한다. 다른 화면의 메모는 유지한다. */
export function invalidateApiCache(prefix: string): void {
  for (const key of memo.keys())
    if (key === prefix || key.startsWith(`${prefix}?`) || key.startsWith(`${prefix}/`))
      memo.delete(key);
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
    response = await fetch(`${host.baseUrl}${withLang(path)}`, {
      ...init,
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      ...auth,
    });
  } catch {
    return failure('NETWORK_ERROR', L.network, true);
  }

  if (isMutation && response.ok && !keepCache) clearApiCache();
  // T-11-034 업적이 바뀌었을 수 있는 쓰기 — 다음 화면에서 업적을 한 번 받아 새 업적을 알린다.
  if (isMutation && response.ok && touchesAchievements(path)) markAchDirty();
  if (response.status === 204) return { ok: true, data: undefined as T };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return failure('INVALID_RESPONSE', L.badResponse, false);
  }

  if (!response.ok) {
    if (json && typeof json === 'object' && 'error' in json) {
      const e = (
        json as {
          error: {
            code?: string;
            message?: string;
            retryable?: boolean;
            details?: { reason?: unknown };
          };
        }
      ).error;
      const reason = typeof e.details?.reason === 'string' ? e.details.reason : undefined;
      if (e.code === 'PROFILE_REQUIRED') noteSession(false);
      return failure(e.code ?? 'UNKNOWN', e.message ?? L.failed, !!e.retryable, reason);
    }
    return failure(
      'INVALID_RESPONSE',
      L.failedStatus({ status: response.status }),
      response.status >= 500,
    );
  }
  if (typeof json !== 'object' || json === null || !('data' in json)) {
    return failure('INVALID_RESPONSE', L.badShape, false);
  }
  return { ok: true, data: (json as { data: unknown }).data as T };
}

export async function getProfile(): Promise<ApiResult<Profile>> {
  const r = await apiFetch<Profile>('/v1/profile', { method: 'GET' });
  if (r.ok) noteSession(true);
  return r;
}

/** 세션이 없다는 응답(PROFILE_REQUIRED)을 받은 뒤 새 익명 세션을 받는다. 받았으면 true. */
export const renewSession = (): Promise<boolean> =>
  host.renewSession ? host.renewSession() : getProfile().then((r) => r.ok);

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
export function unlinkGoogle(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/auth/google/unlink', { method: 'POST' });
}
export function logout(): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/auth/logout', { method: 'POST' });
}
export function startProfileDeletion(): Promise<
  ApiResult<{ confirmToken: string; expiresAt: string }>
> {
  return apiFetch('/v1/profile/delete', { method: 'POST' });
}
export function confirmProfileDeletion(confirmToken: string): Promise<ApiResult<undefined>> {
  return apiFetch('/v1/profile/delete', { method: 'POST', body: JSON.stringify({ confirmToken }) });
}
/** T-10-028 댓글에 쓰는 닉네임. 구글 로그인한 프로필만 정할 수 있다(겹치면 409 NICKNAME_TAKEN). */
export function putNickname(nickname: string): Promise<ApiResult<Profile>> {
  return apiFetch('/v1/profile/nickname', { method: 'PUT', body: JSON.stringify({ nickname }) });
}
export function googleStartUrl(): string {
  return `${host.baseUrl}/v1/auth/google/start`;
}

// ───────── T-10-005 공개 명예의 전당 (로그인 불필요) ─────────
export function getHof(
  limit = 50,
  page = 1,
  sort: HofSort = 'score',
  season: number | null = null,
  name = '',
  pos: CareerPos | null = null,
): Promise<ApiResult<HofListResponse>> {
  const q = `limit=${limit}${page > 1 ? `&page=${page}` : ''}${sort !== 'score' ? `&sort=${sort}` : ''}${season !== null ? `&season=${season}` : ''}${name ? `&q=${encodeURIComponent(name)}` : ''}${pos ? `&pos=${pos}` : ''}`;
  return cachedGet<HofListResponse>(`/v1/hof?${q}`, 60_000);
}
/** T-10-013. 이 계정의 은퇴 선수. 익명 프로필이면 linked=false. */
export function getMyCareers(): Promise<ApiResult<MyCareersResponse>> {
  return cachedGet<MyCareersResponse>('/v1/careers/mine', 60_000);
}
export function getHofDetail(careerId: string): Promise<ApiResult<HofDetailResponse>> {
  return cachedGet<HofDetailResponse>(`/v1/hof/${encodeURIComponent(careerId)}`, 300_000);
}
/**
 * T-10-076 영구결번(로그인 불필요). 내 선수 목록이 결번 배지를 붙일 때도 쓴다.
 * T-11-029 결번은 시즌마다 따로다 — season(0 = 프리시즌)을 안 주면 서버가 지금 시즌을 쓴다.
 */
export function getRetiredNumbers(season?: number): Promise<ApiResult<RetiredNumbersResponse>> {
  return cachedGet<RetiredNumbersResponse>(
    `/v1/retired-numbers${season === undefined ? '' : `?season=${season}`}`,
    60_000,
  );
}
/** T-11-101 영구결번 벽 첫 화면 — 구단별 결번 수와 최근 결번만. */
export function getRetiredNumbersSummary(
  season: number,
): Promise<ApiResult<RetiredNumbersSummary>> {
  return cachedGet<RetiredNumbersSummary>(`/v1/retired-numbers/summary?season=${season}`, 60_000);
}
/** T-11-101 한 구단의 결번(등번호 순). */
export function getRetiredNumbersOfClub(
  season: number,
  clubId: string,
): Promise<ApiResult<RetiredNumbersResponse>> {
  return cachedGet<RetiredNumbersResponse>(
    `/v1/retired-numbers?season=${season}&club=${encodeURIComponent(clubId)}`,
    60_000,
  );
}
/** T-11-101 최신순 한 페이지 — before는 앞 페이지의 next(처음은 0). */
export function getRetiredNumbersPage(
  season: number,
  before: number,
): Promise<ApiResult<RetiredNumbersResponse>> {
  return cachedGet<RetiredNumbersResponse>(
    `/v1/retired-numbers?season=${season}&before=${before}`,
    60_000,
  );
}
/** T-11-029 여러 시즌의 결번 항목을 한 목록으로(내 선수 배지용). 하나라도 실패하면 실패다. */
export async function getRetiredNumbersIn(
  seasons: readonly number[],
): Promise<ApiResult<RetiredNumbersResponse['items']>> {
  const rs = await Promise.all([...new Set(seasons)].map((n) => getRetiredNumbers(n)));
  const items: RetiredNumbersResponse['items'] = [];
  for (const r of rs) {
    if (!r.ok) return r;
    items.push(...r.data.items);
  }
  return { ok: true, data: items };
}
/** T-10-076 내 선수의 결번·서버 칭호 심사 결과. 상세를 열 때 확인하고 반복 진입은 1분 메모한다. */
export function checkRetiredNumber(
  careerId: string,
): Promise<ApiResult<RetiredNumberCheckResponse>> {
  return cachedGet<RetiredNumberCheckResponse>(
    `/v1/careers/${encodeURIComponent(careerId)}/retired-number`,
    60_000,
  );
}
/** T-10-027 서버 최초 기록(로그인 불필요). T-11-029 시즌마다 따로 — season(0 = 프리시즌)을 안 주면 서버가 지금 시즌을 쓴다. */
export function getFirsts(season?: number): Promise<ApiResult<FirstsResponse>> {
  return cachedGet<FirstsResponse>(
    `/v1/firsts${season === undefined ? '' : `?season=${season}`}`,
    60_000,
  );
}
/** T-10-030 홈 라이브 현황(로그인 불필요). 홈이 1분마다 묻는다 — 서버 엣지 캐시와 같은 간격(T-10-045). */
export function getLive(): Promise<ApiResult<LiveResponse>> {
  // 메모는 폴링 간격보다 조금 짧게 — 다음 폴링이 메모가 아니라 서버(엣지)를 읽는다.
  return cachedGet<LiveResponse>('/v1/live', LIVE_POLL_SEC * 1000 - 5_000);
}
/** T-10-122 홈 전광판(로그인 불필요). 서버 엣지 캐시와 같은 간격으로 묻는다. */
export function getTicker(): Promise<ApiResult<TickerResponse>> {
  return cachedGet<TickerResponse>('/v1/ticker', TICKER_POLL_SEC * 1000 - 5_000);
}
