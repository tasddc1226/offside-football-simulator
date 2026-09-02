/**
 * toss 채널 스텁. SDK 없이 `StringKV`(`MemoryStringKV`) 위에 `LocalStore`를 얹는다.
 * M-001(`@apps-in-toss/web-framework` 도입)에서 다음 지점을 실제 SDK 호출로 교체한다:
 * - `createLocalStore()`: `MemoryStringKV` → 네이티브 `Storage`를 감싼 `StringKV`
 * - `identity.getAnonymousKey()`: `User.getAnonymousKey()`
 * - `lifecycle.onBackPressed`/`confirmExit`: SDK 백 이벤트 구독과 종료 확인 모달
 * - `insets()`: SafeArea API
 * - `analytics.track()`: Analytics SDK
 */
import { createKvLocalStore } from '../kv-store/kv-local-store.js';
import { MemoryStringKV } from '../kv-store/memory-kv.js';
import type { Platform } from '../types.js';

export type { Platform };

const tossStorage = new MemoryStringKV();

/** toss 채널 어댑터. 위험 표(ADR-009)에 따라 테마를 다크로 고정하고, 외부 이동을 막는다. */
export const tossPlatform: Platform = {
  channel: 'toss',
  theme: { forced: 'dark' },
  createLocalStore: () => Promise.resolve(createKvLocalStore(tossStorage)),
  async clearLocalData() {
    for (const key of await tossStorage.keys()) {
      await tossStorage.removeItem(key);
    }
  },
  session: {
    async getBearerToken() {
      return null;
    },
    async setBearerToken() {
      // M-001에서 세션 토큰을 네이티브 Storage에 보관한다.
    },
  },
  identity: {
    async getAnonymousKey() {
      return null;
    },
  },
  lifecycle: {
    onBackPressed() {
      return () => {};
    },
    async confirmExit() {
      return true;
    },
  },
  insets() {
    return { top: 0, bottom: 0 };
  },
  analytics: {
    track() {
      // no-op. M-001에서 Analytics 연동.
    },
  },
  openExternal(url) {
    console.warn(`OFFSIDE: 미니앱에서 외부 이동은 금지된다(ADR-009). 무시됨: ${url}`);
  },
};
