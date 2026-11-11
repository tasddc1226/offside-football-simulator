// T-11-697 엠블럼 · 대회 로고는 IndexedDB, 나머지는 localStorage. main.ts가 세이브를 읽기 전에 불러 기다린다.
import { setStorage } from '@offside/game/storage';
import { browserIdb, createBigStore, type LocalKv } from './bigStore.js';

function localKv(): LocalKv | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // 저장소 차단: 엔진의 저장 API가 알아서 실패한다.
  }
}

/** 기다려야 할 IndexedDB 읽기. 옮겨 둔 값이 없으면 null이라 부팅이 바로 이어진다. */
export function installBigStore(): Promise<void> | null {
  const local = localKv();
  if (!local) return null;
  const big = createBigStore(local, browserIdb());
  setStorage(big.store);
  return big.needsLoad() ? big.load() : null;
}
