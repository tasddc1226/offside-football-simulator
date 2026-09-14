// D-78 API-PRES-001·002: 상단 네비바 "N명 플레이 중" 배지 + 하트비트. service-season.ts와 같은
// queryOptions 관례(쿼리 키·staleTime·retry 고정, 훅은 useQuery로 감싼 것뿐)를 따른다.
import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { LivePresence } from '@offside/contracts';
import { useEffect } from 'react';
import { getLivePresence, postPresenceHeartbeat } from '../api/client.js';

const REFETCH_INTERVAL_MS = 60_000;
const STALE_TIME_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 60_000;

async function fetchLivePresence(): Promise<LivePresence> {
  const result = await getLivePresence();
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
}

export const livePresenceQueryOptions = queryOptions({
  queryKey: ['presence', 'live'] as const,
  queryFn: fetchLivePresence,
  refetchInterval: REFETCH_INTERVAL_MS,
  refetchIntervalInBackground: false,
  staleTime: STALE_TIME_MS,
  retry: false,
});

/** 네비바가 배지에 쓸 "지금 플레이 중" 수. API가 없거나 실패하면 data는 undefined다(배지는 숨김). */
export function useLivePresence(): UseQueryResult<LivePresence> {
  return useQuery(livePresenceQueryOptions);
}

function sendHeartbeatIfVisible(): void {
  if (document.visibilityState !== 'visible') return;
  postPresenceHeartbeat().catch(() => {
    // 조용히 무시 — 하트비트는 최선 노력이고 콘솔 경고를 남기지 않는다(D-78).
  });
}

/**
 * 마운트 시 1회 + 60초 간격으로 하트비트를 보낸다. 탭이 보이지 않는 동안은 보내지 않고,
 * `visibilitychange`로 다시 보이게 되면 즉시 1회 더 보낸다. 30초 캐시(staleTime)라 하트비트
 * 성공 뒤 presence 쿼리를 invalidate하지 않는다 — 다음 60초 refetch가 알아서 갱신한다.
 */
export function usePresenceHeartbeat(): void {
  useEffect(() => {
    sendHeartbeatIfVisible();
    const interval = setInterval(sendHeartbeatIfVisible, HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sendHeartbeatIfVisible();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
