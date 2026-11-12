import { createAccountCache } from '@offside/app-core/accountCache';
// Account.svelte가 재마운트되어도(설정 화면을 벗어났다 돌아오는 경우) 프로필 확인 캐시를
// 유지하기 위한 모듈 스코프 상태. account.ts의 module-level `cached`/`fetchedAt`과 동일한 역할이다.
// 설정 화면이 로그인 상태에 따라 운영 도구 입구를 보이므로 반응형으로 둔다.
import { getProfile, type Profile } from '@offside/app-core/api/client';
import { noteOwner } from '@offside/app-core/api/friendPending';
import { isMember } from '@offside/app-core/account';
import { profileKey } from '@offside/app-core/retireExperiment';
import type { AccountKey } from '@offside/app-core/retireExpMetrics';
import { noteRetireAccount, setRetireAccountSource } from '../analytics/index.js';

export const accountCache = $state<{
  value: Profile | null | 'error' | undefined;
  fetchedAt: number;
}>({
  value: undefined,
  fetchedAt: 0,
});

const policy = createAccountCache(accountCache, loadAccount);
export const {
  setAccount,
  accountGeneration,
  onAccountChange,
  ensureAccount,
  freshAccount,
  accountFresh,
} = policy;
const accountKey = (): AccountKey => {
  const p = accountCache.value;
  if (p === undefined || p === 'error') return undefined;
  return p ? profileKey(p.id) : null;
};
setRetireAccountSource(accountKey);
onAccountChange(noteRetireAccount);

/** 프로필을 다시 받아 캐시에 둔다. 실패는 'error'(서버에 연결하지 못함). */
export async function refreshAccount() {
  const r = await getProfile();
  setAccount(r.ok ? r.data : 'error');
}

/** 다시 묻고, 로그인 상태를 구단주 표시로도 남긴다(T-11-275 홈 선물은 로그인한 기기에서만 묻는다). silent가 아니면 확인 중으로 돌린다. */
export async function loadAccount(silent = false) {
  if (!silent) accountCache.value = undefined;
  await refreshAccount();
  const p = accountCache.value;
  if (p !== undefined && p !== 'error') noteOwner(!!p && isMember(p));
}
