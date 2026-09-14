// 사용자 결정(2026-09-14): 홈 공지사항은 서버 D1 `notices` 테이블이 정본이다(HOME_NOTICES 상수 제거).
// service-season.ts와 같은 폴백 체인을 쓴다 — 네트워크 성공이면 kv-store에 마지막 응답을 저장하고,
// 실패(오프라인·API 오류)면 그 kv-store 캐시를, 캐시도 없으면 빈 배열을 돌려준다. 서비스 시즌과 달리
// React 밖(rules of hooks 위반 지점)에서 쓰는 non-hook resolver는 없다 — HomeCommunity 한 곳만 읽는다.
// 폴백까지 queryFn 안에서 끝내 쿼리가 항상 success 상태로 끝나게 한다 — 그래야 화면은 로딩/빈 목록
// 두 상태만 다루면 된다(오류 상태를 별도로 그릴 필요가 없다).
import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Notice } from '@offside/contracts';
import { getNotices } from '../api/client.js';
import { getAppEngine } from './engine.js';

const NOTICES_KV_KEY = 'notices:latest';
// 공지는 운영이 SQL로만 갱신하고 실시간성이 필요 없어 service-season(5분)보다 훨씬 넉넉하게 둔다.
const STALE_TIME_MS = 30 * 60 * 1000;

async function readCachedNotices(): Promise<Notice[]> {
  try {
    const engine = await getAppEngine();
    const cached = await engine.store.transaction('readonly', (tx) => tx.kv.get<Notice[]>(NOTICES_KV_KEY));
    return cached ?? [];
  } catch {
    return [];
  }
}

async function fetchNotices(): Promise<Notice[]> {
  const result = await getNotices();
  if (!result.ok) {
    return readCachedNotices();
  }
  try {
    const engine = await getAppEngine();
    await engine.store.transaction('readwrite', (tx) => tx.kv.put(NOTICES_KV_KEY, result.data.items));
  } catch {
    // kv-store 저장 실패는 이번 응답 표시를 막을 이유가 아니다 — 다음 성공 때 다시 시도한다.
  }
  return result.data.items;
}

export const noticesQueryOptions = queryOptions({
  queryKey: ['notices', 'latest'] as const,
  queryFn: fetchNotices,
  staleTime: STALE_TIME_MS,
  // fetchNotices가 이미 폴백까지 끝내 항상 resolve한다 — 전역 retry:1이 여기서 또 돌면
  // 오프라인일 때 캐시/빈 목록 표시가 1초+ 늦어진다(service-season.ts와 같은 이유).
  retry: false,
});

/** 홈(HomeCommunity)이 공지 목록을 읽는 유일한 지점. */
export function useNotices(): UseQueryResult<Notice[]> {
  return useQuery(noticesQueryOptions);
}
