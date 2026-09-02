// createSyncClient가 요구하는 fetch 어댑터. baseUrl은 sync.ts가 API_BASE_URL로 채우므로 여기서는
// 세션 쿠키(credentials: 'include')만 보장해서 그대로 넘긴다.
import type { SyncTransportResponse } from '@offside/engine-client';

export async function syncFetch(url: string, init: RequestInit): Promise<SyncTransportResponse> {
  const response = await fetch(url, { ...init, credentials: 'include' });
  return {
    status: response.status,
    headers: response.headers,
    json: () => response.json(),
  };
}
