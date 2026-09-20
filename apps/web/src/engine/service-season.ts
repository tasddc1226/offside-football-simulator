// T-2-012 D-54: "현재 서비스 시즌" 조회 하나를 SCR-001 허브(배너·배지·버튼)는 useServiceSeason()
// 훅으로, career-actions.ts(React 밖, rules of hooks 위반)는 resolveServiceSeason() 또는 id 전용
// resolveServiceSeasonId()로 쓴다. 같은 queryOptions(쿼리 키 ['service-season','current'], staleTime 5분)를 공유해 캐시가
// 갈리지 않는다 — 훅은 queryClient.fetchQuery로 감싼 것뿐이다(routes/index.tsx의 loader가 이미 쓰는
// queryClient.ensureQueryData와 같은 관례).
import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ServiceSeasonCurrent } from '@offside/contracts';
import { getServiceSeasonCurrent } from '../api/client.js';
import { queryClient } from '../shared/query-client.js';
import { getAppEngine } from './engine.js';
import { FALLBACK_SERVICE_SEASON } from './versions.js';

const SERVICE_SEASON_KV_KEY = 'service-season:current';
const STALE_TIME_MS = 5 * 60 * 1000;

async function fetchServiceSeason(): Promise<ServiceSeasonCurrent> {
  if (import.meta.env.DEV && import.meta.env.VITE_SIMULATOR_PREVIEW === 'true') {
    return {
      ...FALLBACK_SERVICE_SEASON,
      id: 'svc_simulator_preview',
      name: '선수 육성 프리뷰',
      isTest: true,
      rulesetVersion: '3.1.0',
      contentPackVersion: '0.10.0',
    };
  }
  const result = await getServiceSeasonCurrent();
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  const engine = await getAppEngine();
  await engine.store.transaction('readwrite', (tx) =>
    tx.kv.put(SERVICE_SEASON_KV_KEY, result.data),
  );
  return result.data;
}

export const serviceSeasonQueryOptions = queryOptions({
  queryKey: ['service-season', 'current'] as const,
  queryFn: fetchServiceSeason,
  staleTime: STALE_TIME_MS,
  // resolveServiceSeason 자체가 kv-store·상수로 이어지는 폴백 체인이다 — 여기서 재시도하면
  // (전역 retry:1 기본 backoff 1s) 커리어 생성 같은 사용자 조작이 오프라인일 때마다 1초+ 멎는다.
  retry: false,
});

/** SCR-001 허브가 배너·배지·"새 선수" 버튼 비활성화를 그리는 데 쓴다. */
export function useServiceSeason(): UseQueryResult<ServiceSeasonCurrent> {
  return useQuery(serviceSeasonQueryOptions);
}

/**
 * 현재 서비스 시즌 레코드. 폴백 순서(D-54): 네트워크 성공 → 실패 시 kv-store 마지막 성공 값 →
 * 그것도 없으면 kickoff 상수. CREATE는 이 한 레코드의 id·룰셋·팩을 원자적으로 고정한다.
 */
export async function resolveServiceSeason(): Promise<ServiceSeasonCurrent> {
  try {
    const data = await queryClient.fetchQuery(serviceSeasonQueryOptions);
    return data;
  } catch {
    const engine = await getAppEngine();
    const cached = await engine.store.transaction('readonly', (tx) =>
      tx.kv.get<ServiceSeasonCurrent>(SERVICE_SEASON_KV_KEY),
    );
    return cached ?? FALLBACK_SERVICE_SEASON;
  }
}

export async function resolveServiceSeasonId(): Promise<string> {
  return (await resolveServiceSeason()).id;
}
