// Account.svelte가 재마운트되어도(설정 화면을 벗어났다 돌아오는 경우) 프로필 확인 캐시를
// 유지하기 위한 모듈 스코프 상태. account.ts의 module-level `cached`/`fetchedAt`과 동일한 역할이다.
// 설정 화면이 로그인 상태에 따라 운영 도구 입구를 보이므로 반응형으로 둔다.
import { getProfile, type Profile } from '../api/client.js';

export const accountCache = $state<{ value: Profile | null | 'error' | undefined; fetchedAt: number }>({
  value: undefined,
  fetchedAt: 0,
});

/** 프로필을 다시 받아 캐시에 둔다. 실패는 'error'(서버에 연결하지 못함). */
export async function refreshAccount() {
  const r = await getProfile();
  accountCache.fetchedAt = Date.now();
  accountCache.value = r.ok ? r.data : 'error';
}
