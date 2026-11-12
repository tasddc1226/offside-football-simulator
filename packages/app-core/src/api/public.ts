import type { DetailPos } from '@offside/contracts/positions';
import { LIVE_POLL_SEC, TICKER_POLL_SEC } from '@offside/contracts/polling';
import type {
  Best11Response,
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
  SeasonGaugeResponse,
} from '@offside/contracts';
import { cachedGet, type ApiResult } from './transport.js';

// ───────── T-10-005 공개 명예의 전당 (로그인 불필요) ─────────
export function getHof(
  limit = 50,
  page = 1,
  sort: HofSort = 'score',
  season: number | null = null,
  name = '',
  pos: CareerPos | null = null,
  dpos: DetailPos | null = null,
): Promise<ApiResult<HofListResponse>> {
  const q = `limit=${limit}${page > 1 ? `&page=${page}` : ''}${sort !== 'score' ? `&sort=${sort}` : ''}${season !== null ? `&season=${season}` : ''}${name ? `&q=${encodeURIComponent(name)}` : ''}${pos ? `&pos=${pos}` : ''}${dpos ? `&dpos=${dpos}` : ''}`;
  // T-11-503 홈 상위 목록이 홈에 돌아올 때마다 다시 받지 않게 5분 메모. 내 은퇴 업로드는 outbox가 메모를 비운다.
  return cachedGet<HofListResponse>(`/v1/hof?${q}`, 300_000);
}
/** T-11-463 시즌 BEST 11(공개). 자리 주인은 은퇴마다 바뀌지만 화면을 열 때만 부른다. */
export function getBest11(season: number): Promise<ApiResult<Best11Response>> {
  return cachedGet<Best11Response>(`/v1/best11?season=${season}`, 60_000);
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
    300_000, // T-11-503 홈에 돌아올 때마다 다시 받지 않게 5분.
  );
}
/** T-10-030 홈 라이브 현황(로그인 불필요). 홈이 1분마다 묻는다 — 서버 엣지 캐시와 같은 간격(T-10-045). */
export function getLive(): Promise<ApiResult<LiveResponse>> {
  // 메모는 폴링 간격보다 조금 짧게 — 다음 폴링이 메모가 아니라 서버(엣지)를 읽는다.
  return cachedGet<LiveResponse>('/v1/live', LIVE_POLL_SEC * 1000 - 5_000);
}
/** 시즌 진행 게이지(로그인 불필요). 서버가 30분마다 세고 엣지에 5분 담으므로 5분 메모. */
export function getSeasonGauge(): Promise<ApiResult<SeasonGaugeResponse>> {
  return cachedGet<SeasonGaugeResponse>('/v1/season/gauge', 300_000);
}
/** T-10-122 홈 전광판(로그인 불필요). 서버 엣지 캐시와 같은 간격으로 묻는다. */
export function getTicker(): Promise<ApiResult<TickerResponse>> {
  return cachedGet<TickerResponse>('/v1/ticker', TICKER_POLL_SEC * 1000 - 5_000);
}
