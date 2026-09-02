import { describe, expect, it, vi } from 'vitest';
import { webPlatform } from './web/index.js';
import { tossPlatform } from './toss/index.js';

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
});
