// 06 "점진적 공개": 프로 계약 후 전술 적합도·감독 신뢰가 처음 열릴 때 한 줄 설명 캡션을 한 번만
// 보여준다(SCR-034 온보딩과 같은 "한 번 보면 다시 안 보임" 규칙). ui-store.ts의 UI_SETTINGS_KV_KEY
// ('ui:settings')와 같은 네임스페이스의 형제 키 'ui:revealed'에 boolean으로 기록한다(브리프 지시).
import type { LocalStore } from '@offside/engine-client';

const REVEALED_STATS_KV_KEY = 'ui:revealed';

export async function readRevealedStats(store: LocalStore): Promise<boolean> {
  const value = await store.transaction('readonly', (tx) => tx.kv.get<boolean>(REVEALED_STATS_KV_KEY));
  return value === true;
}

export async function markStatsRevealed(store: LocalStore): Promise<void> {
  await store.transaction('readwrite', (tx) => tx.kv.put(REVEALED_STATS_KV_KEY, true));
}
