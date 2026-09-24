// Account.svelte가 재마운트되어도(홈 화면을 벗어났다 돌아오는 경우) 프로필 확인 캐시를
// 유지하기 위한 모듈 스코프 상태. account.ts의 module-level `cached`/`fetchedAt`과 동일한 역할이다.
import type { Profile } from '../api/client.js';

export const accountCache: { value: Profile | null | 'error' | undefined; fetchedAt: number } = {
  value: undefined,
  fetchedAt: 0,
};
