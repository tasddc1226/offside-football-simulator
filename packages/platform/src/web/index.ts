import type { Platform } from '../types.js';
import { closeAnalyticsClientIdStore, createAnalytics } from './analytics.js';
import { createDexieLocalStore, deleteDexieLocalStore } from './dexie-store.js';

export type { Platform };

const backHandlers = new Set<() => boolean>();

function handlePopState(): void {
  for (const handler of Array.from(backHandlers)) {
    if (handler()) return;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', handlePopState);
}

/**
 * web 채널 어댑터. 세션은 쿠키(ADR-002)로, SafeArea는 CSS `env()`로, 테마는 시스템 감지로 처리한다.
 * `analyticsEndpoint`는 이 패키지가 apps/web의 API 클라이언트 설정을 직접 import하지 않도록 호출
 * 쪽이 주입한다(T-2-012).
 */
export function createWebPlatform(options: { analyticsEndpoint: string; dev?: boolean }): Platform {
  return {
    channel: 'web',
    theme: { forced: null },
    features: { googleLink: true },
    createLocalStore: () => createDexieLocalStore(),
    async clearLocalData() {
      await closeAnalyticsClientIdStore();
      await deleteDexieLocalStore();
    },
    session: {
      async getBearerToken() {
        return null;
      },
      async setBearerToken() {
        // web 채널은 쿠키로 세션을 유지한다(ADR-002). no-op.
      },
    },
    identity: {
      async getAnonymousKey() {
        return null;
      },
    },
    lifecycle: {
      onBackPressed(handler) {
        backHandlers.add(handler);
        return () => backHandlers.delete(handler);
      },
      async confirmExit() {
        return true;
      },
    },
    insets() {
      return { top: 0, bottom: 0 };
    },
    analytics: createAnalytics(options.analyticsEndpoint, options.dev !== undefined ? { dev: options.dev } : {}),
    openExternal(url) {
      window.location.assign(url);
    },
  };
}
