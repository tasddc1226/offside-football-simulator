import type { Platform } from '../types.js';
import { createDexieLocalStore } from './dexie-store.js';

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

/** web 채널 어댑터. 세션은 쿠키(ADR-002)로, SafeArea는 CSS `env()`로, 테마는 시스템 감지로 처리한다. */
export const webPlatform: Platform = {
  channel: 'web',
  theme: { forced: null },
  createLocalStore: () => createDexieLocalStore(),
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
  analytics: {
    track() {
      // Phase 7에서 Web Analytics 연동. 그 전까지 no-op.
    },
  },
  openExternal(url) {
    window.location.assign(url);
  },
};
