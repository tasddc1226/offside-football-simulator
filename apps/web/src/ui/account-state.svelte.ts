// Account.svelte가 재마운트되어도(설정 화면을 벗어났다 돌아오는 경우) 프로필 확인 캐시를
// 유지하기 위한 모듈 스코프 상태. account.ts의 module-level `cached`/`fetchedAt`과 동일한 역할이다.
// 설정 화면이 로그인 상태에 따라 운영 도구 입구를 보이므로 반응형으로 둔다.
import { getProfile, type Profile } from '@offside/app-core/api/client';
import { noteOwner } from '@offside/app-core/api/friendPending';
import { isMember } from '@offside/app-core/account';

export const accountCache = $state<{
  value: Profile | null | 'error' | undefined;
  fetchedAt: number;
}>({
  value: undefined,
  fetchedAt: 0,
});

// T-11-669 계정 확인이 끝날 때마다 세대를 올리고 알린다(은퇴 화면 실험이 다른 계정의 결과를 묶지 않게).
const changeListeners = new Set<() => void>();
let generation = 0;
export const accountGeneration = () => generation;
export function onAccountChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => void changeListeners.delete(fn);
}

/** 프로필을 다시 받아 캐시에 둔다. 실패는 'error'(서버에 연결하지 못함). */
export async function refreshAccount() {
  const r = await getProfile();
  const before = accountCache.value;
  accountCache.fetchedAt = Date.now();
  accountCache.value = r.ok ? r.data : 'error';
  const id = (p: typeof before) => (p && p !== 'error' ? p.id : p);
  if (id(before) !== id(accountCache.value)) generation++;
  for (const fn of changeListeners) {
    try {
      fn();
    } catch {
      /* optional */
    }
  }
}

const REVALIDATE_MS = 5 * 60_000;

/** 다시 묻고, 로그인 상태를 구단주 표시로도 남긴다(T-11-275 홈 선물은 로그인한 기기에서만 묻는다). silent가 아니면 확인 중으로 돌린다. */
export async function loadAccount(silent = false) {
  if (!silent) accountCache.value = undefined;
  await refreshAccount();
  const p = accountCache.value;
  if (p !== undefined && p !== 'error') noteOwner(!!p && isMember(p));
}

let inflight: Promise<void> | null = null;
function load(silent: boolean): Promise<void> {
  inflight ??= loadAccount(silent).finally(() => (inflight = null));
  return inflight;
}

/** 계정 상태를 쓰는 화면(설정 계정 카드 · 구단주 · 상점, T-11-567)이 열릴 때. 처음이면 묻고, 5분이 지났으면 조용히 다시 묻는다. */
export function ensureAccount() {
  if (accountCache.value === undefined) void load(false);
  else if (Date.now() - accountCache.fetchedAt > REVALIDATE_MS) void load(true);
}

/** T-11-669 ensureAccount와 같되, 처음이거나 5분이 지난 캐시면 다시 확인이 끝날 때까지 기다린다(옛 계정으로 판단하지 않게). */
export function freshAccount(): Promise<void> {
  if (accountCache.value === undefined) return load(false);
  if (Date.now() - accountCache.fetchedAt > REVALIDATE_MS) return load(true);
  return inflight ?? Promise.resolve();
}
/** 캐시가 확인된 지 5분 안이다(확인 중 · 만료면 false). */
export const accountFresh = () =>
  accountCache.value !== undefined && Date.now() - accountCache.fetchedAt <= REVALIDATE_MS;
