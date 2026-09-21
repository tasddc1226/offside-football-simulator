import { describe, expect, it, vi } from 'vitest';
import {
  armBackGuard,
  createWebPlatform,
  handleBackGuardPopState,
  isBackGuardState,
  type BackGuardHost,
} from './web/index.js';
import { tossPlatform } from './toss/index.js';

/**
 * 실제 window 없이(이 패키지 vitest 환경은 'node') 뒤로가기 가드를 검증하기 위한 가짜 host.
 * `simulateBrowserBack`은 실제 브라우저가 물리 뒤로가기에서 popstate를 쏘기 전에 이미 이전
 * 엔트리로 옮겨 가 있는 상태(=가드 엔트리 소비)를 흉내 낸다.
 */
function createFakeBackGuardHost(initialHref: string) {
  const state = { entries: [null] as unknown[], backCalls: 0 };
  const host: BackGuardHost = {
    getState: () => state.entries[state.entries.length - 1],
    getHref: () => initialHref,
    pushState: (nextState) => {
      state.entries.push(nextState);
    },
    back: () => {
      state.backCalls += 1;
    },
  };
  const simulateBrowserBack = () => {
    if (state.entries.length > 1) state.entries.pop();
  };
  return { host, state, simulateBrowserBack };
}

const webPlatform = createWebPlatform({ analyticsEndpoint: 'https://example.com/v1/analytics/events' });

describe('platform adapters', () => {
  it('web adapter reports the web channel', () => {
    expect(webPlatform.channel).toBe('web');
  });

  it('toss adapter reports the toss channel', () => {
    expect(tossPlatform.channel).toBe('toss');
  });

  it('web은 시스템 테마를 쓰고 toss는 다크로 고정한다', () => {
    expect(webPlatform.theme.forced).toBeNull();
    expect(tossPlatform.theme.forced).toBe('dark');
  });

  it('T-1-013 D-21: Google 연결은 web만 켜져 있다(ADR-009: WebView OAuth 차단)', () => {
    expect(webPlatform.features.googleLink).toBe(true);
    expect(tossPlatform.features.googleLink).toBe(false);
  });

  it('web 세션은 쿠키 기반이라 항상 null이다', async () => {
    expect(await webPlatform.session.getBearerToken()).toBeNull();
    await expect(webPlatform.session.setBearerToken('token')).resolves.toBeUndefined();
  });

  it('두 채널 모두 지금은 식별키가 없다', async () => {
    expect(await webPlatform.identity.getAnonymousKey()).toBeNull();
    expect(await tossPlatform.identity.getAnonymousKey()).toBeNull();
  });

  it('두 채널 모두 insets는 0/0이다', () => {
    expect(webPlatform.insets()).toEqual({ top: 0, bottom: 0 });
    expect(tossPlatform.insets()).toEqual({ top: 0, bottom: 0 });
  });

  it('tossPlatform.openExternal은 location을 건드리지 않고 경고만 남긴다', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => tossPlatform.openExternal('https://example.com')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('두 채널 모두 createLocalStore가 LocalStore 계약을 만족하는 kind를 갖는다', async () => {
    const webStore = await webPlatform.createLocalStore();
    expect(webStore.kind).toBe('dexie');
    await webStore.close();

    const tossStore = await tossPlatform.createLocalStore();
    expect(tossStore.kind).toBe('toss-storage');
    await tossStore.close();
  });

  it('clearLocalData: web은 store.close() 뒤 호출해도 예외 없이 끝나고 새 store가 정상 동작한다', async () => {
    const store = await webPlatform.createLocalStore();
    await store.transaction('readwrite', async (tx) => {
      await tx.kv.put('profile:id', 'prf_before_clear');
    });
    await store.close();

    await expect(webPlatform.clearLocalData()).resolves.toBeUndefined();

    const fresh = await webPlatform.createLocalStore();
    const value = await fresh.transaction('readonly', (tx) => tx.kv.get<string>('profile:id'));
    expect(value).toBeUndefined();
    await fresh.close();
  });

  it('clearLocalData: toss는 저장된 키를 전부 지운다', async () => {
    const store = await tossPlatform.createLocalStore();
    await store.transaction('readwrite', async (tx) => {
      await tx.kv.put('profile:id', 'prf_before_clear');
    });
    await store.close();

    await tossPlatform.clearLocalData();

    const fresh = await tossPlatform.createLocalStore();
    const value = await fresh.transaction('readonly', (tx) => tx.kv.get<string>('profile:id'));
    expect(value).toBeUndefined();
    await fresh.close();
  });

  describe('T-7-039 web 뒤로가기 가드', () => {
    it('isBackGuardState: 가드 엔트리만 true다', () => {
      expect(isBackGuardState({ offsideBackGuard: true })).toBe(true);
      expect(isBackGuardState({ offsideBackGuard: false })).toBe(false);
      expect(isBackGuardState(null)).toBe(false);
      expect(isBackGuardState(undefined)).toBe(false);
    });

    it('armBackGuard: 아직 가드 위가 아니면 엔트리를 하나 쌓는다', () => {
      const { host, state } = createFakeBackGuardHost('/');
      armBackGuard(host);
      expect(state.entries).toHaveLength(2);
      expect(isBackGuardState(host.getState())).toBe(true);
    });

    it('armBackGuard: 이미 가드 위면(StrictMode·HMR 재실행) 다시 쌓지 않는다', () => {
      const { host, state } = createFakeBackGuardHost('/');
      armBackGuard(host);
      armBackGuard(host);
      expect(state.entries).toHaveLength(2);
    });

    it('popstate: 핸들러가 처리했다고(true) 하면 가드를 재적재하고 실제로는 물러나지 않는다', () => {
      const { host, state, simulateBrowserBack } = createFakeBackGuardHost('/');
      armBackGuard(host);
      simulateBrowserBack(); // 물리 뒤로가기가 가드 엔트리를 이미 소비한 상태
      const handled = vi.fn(() => true);
      handleBackGuardPopState(host, [handled]);
      expect(handled).toHaveBeenCalledOnce();
      expect(state.backCalls).toBe(0);
      expect(state.entries).toHaveLength(2); // 소비된 엔트리 자리에 새 가드를 다시 쌓았다
      expect(isBackGuardState(host.getState())).toBe(true);
    });

    it('popstate: 등록된 핸들러가 전부 false면(이미 첫 화면) 가드를 다시 쌓지 않고 한 번 더 물러난다', () => {
      const { host, state, simulateBrowserBack } = createFakeBackGuardHost('/');
      armBackGuard(host);
      simulateBrowserBack();
      handleBackGuardPopState(host, [() => false, () => false]);
      expect(state.backCalls).toBe(1);
      expect(state.entries).toHaveLength(1); // 재적재하지 않음
    });

    it('popstate: 핸들러가 하나도 없어도 전부 false와 같이 처리해 물러난다', () => {
      const { host, state, simulateBrowserBack } = createFakeBackGuardHost('/');
      armBackGuard(host);
      simulateBrowserBack();
      handleBackGuardPopState(host, []);
      expect(state.backCalls).toBe(1);
    });

    it('web 채널 lifecycle.onBackPressed: 등록·해제가 가능하다(실제 popstate 연결은 web/index.ts 모듈 로드가 맡는다)', () => {
      const handler = () => true;
      const unsubscribe = webPlatform.lifecycle.onBackPressed(handler);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
});
