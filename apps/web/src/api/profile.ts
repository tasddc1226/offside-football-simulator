// 앱 부트스트랩·"다시 연결"에서 공유하는 세션 확보 로직. GET /v1/profile이 익명 프로필 쿠키를
// 발급한다(없으면 새로, 있으면 기존 세션 확인).
import type { QueryClient } from '@tanstack/react-query';
import type { LocalStore } from '@offside/engine-client';
import { getProfile } from './client.js';

const PROFILE_ID_KV_KEY = 'profile:id';

/**
 * 성공하면 LocalStore kv `'profile:id'`와 TanStack Query `['profile']`에 남긴다. 실패해도 앱은
 * 그대로 뜬다 — 이후 동기화는 LOCAL_ONLY로 표시된다. `EngineClientDeps.ownerProfileId`는 여기서
 * 채우지 않는다(D-19: 소유자 연결은 커리어 저장 시 서버가 세션으로 판단한다).
 */
export async function ensureProfile(store: LocalStore, queryClient: QueryClient): Promise<boolean> {
  const result = await getProfile();
  if (!result.ok) return false;

  await store.transaction('readwrite', async (tx) => {
    await tx.kv.put(PROFILE_ID_KV_KEY, result.data.id);
  });
  queryClient.setQueryData(['profile'], result.data);
  return true;
}
