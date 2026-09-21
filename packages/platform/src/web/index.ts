import type { Platform } from '../types.js';
import { closeAnalyticsClientIdStore, createAnalytics } from './analytics.js';
import { createDexieLocalStore, deleteDexieLocalStore } from './dexie-store.js';

export type { Platform };

const backHandlers = new Set<() => boolean>();
// A popstate can also be produced when the user returns to this document with the
// browser Forward button.  Keep that case distinct from consuming our guard entry:
// there is no application back action to replay when the guard was not armed.
let backGuardArmed = false;

/**
 * T-7-039 뒤로가기 가드. 라우터가 메모리 히스토리로 바뀌면서 브라우저 뒤로가기는 더 이상 라우터를
 * 거치지 않고 곧장 사이트를 벗어난다 — 원작(slbcareer.com)처럼 브라우저 히스토리에 "가드 엔트리"를
 * 하나 쌓아 두고, 그게 소비될 때마다 다시 쌓는 트릭으로 막는다. 이 파일이 가드 엔트리 적재·재적재를
 * 맡고, 앱(`apps/web`)은 `lifecycle.onBackPressed(handler)`로 "라우터가 뒤로 갔거나 홈으로
 * 보냈으면 true"만 돌려주는 핸들러를 등록한다. 등록된 핸들러가 전부 false면(=이미 앱의 첫 화면)
 * 가드를 다시 쌓지 않고 실제로 한 번 더 뒤로 가 사용자가 나가게 둔다.
 *
 * 순수 로직(armBackGuard/handleBackGuardPopState)은 `window`/`document` 없이도(노드 vitest
 * 환경) 테스트할 수 있도록 `BackGuardHost`로 주입받는다 — `platform.test.ts` 참고.
 */
export interface BackGuardHost {
  getState(): unknown;
  getHref(): string;
  pushState(state: unknown, href: string): void;
  back(): void;
}

const BACK_GUARD_FLAG = 'offsideBackGuard';

export function isBackGuardState(state: unknown): boolean {
  return (
    typeof state === 'object' && state !== null && (state as Record<string, unknown>)[BACK_GUARD_FLAG] === true
  );
}

/** 이미 가드 엔트리 위에 있으면(React StrictMode·HMR로 이 모듈이 다시 실행돼도) 다시 쌓지 않는다. */
export function armBackGuard(host: BackGuardHost): void {
  const currentState = host.getState();
  if (isBackGuardState(currentState)) return;
  const nextState =
    typeof currentState === 'object' && currentState !== null
      ? { ...(currentState as Record<string, unknown>), [BACK_GUARD_FLAG]: true }
      : { [BACK_GUARD_FLAG]: true };
  host.pushState(nextState, host.getHref());
}

/** popstate마다: 등록된 핸들러 중 하나라도 처리했으면(true) 가드를 재적재하고, 전부 false면
 * 가드를 다시 쌓지 않고 한 번 더 물러나 실제로 나가게 둔다. */
export function handleBackGuardPopState(host: BackGuardHost, handlers: Iterable<() => boolean>): void {
  for (const handler of Array.from(handlers)) {
    if (handler()) {
      armBackGuard(host);
      return;
    }
  }
  host.back();
}

function createWindowBackGuardHost(): BackGuardHost {
  return {
    getState: () => window.history.state,
    getHref: () => window.location.href,
    pushState: (state, href) => window.history.pushState(state, '', href),
    back: () => window.history.back(),
  };
}

function handlePopState(): void {
  const host = createWindowBackGuardHost();
  if (!backGuardArmed) {
    armBackGuard(host);
    backGuardArmed = true;
    return;
  }

  // The browser has just consumed the guard entry.  A handler that handles the
  // event will arm a replacement below; a false result intentionally permits the
  // legitimate exit from the root screen.
  backGuardArmed = false;
  handleBackGuardPopState(host, backHandlers);
  if (isBackGuardState(host.getState())) backGuardArmed = true;
}

if (typeof window !== 'undefined') {
  armBackGuard(createWindowBackGuardHost());
  backGuardArmed = true;
  window.addEventListener('popstate', handlePopState);
  // Forward navigation and BFCache restores can return to the app without a
  // guard entry.  Re-arm at that lifecycle boundary so later in-app navigation
  // retains browser Back behavior.
  window.addEventListener('pageshow', () => {
    armBackGuard(createWindowBackGuardHost());
    backGuardArmed = true;
  });
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
