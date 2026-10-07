/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => {
  const fixture = {
    values: new Map(),
    listener: undefined,
    response: undefined,
    lastResponse: null,
    received: undefined,
    openInbox: vi.fn(),
    openInboxTarget: vi.fn(),
    read: vi.fn(async () => {}),
    refreshFriends: vi.fn(),
    invalidate: vi.fn(),
    rotateDuringFetch: false,
    nativeReads: 0,
    token: 'native-a',
    requests: [],
    releaseType: 5,
    platform: 'ios',
    rejectNullRegistration: false,
  };
  fixture.getReleaseType = vi.fn(async () => fixture.releaseType);
  fixture.autoRegistration = vi.fn(async () => {
    if (fixture.rejectNullRegistration) throw new Error('Native iOS String rejects null');
  });
  fixture.nativeRegistration = vi.fn(async () => {});
  fixture.getExpo = vi.fn(async (options) => {
    // getDevicePushTokenAsync emits even when the APNs token has not changed.
    // Stop an unfixed recursive listener so this regression fails without hanging the runner.
    if (fixture.getExpo.mock.calls.length > 3) throw new Error('Repeated device token requests');
    let data = options.devicePushToken?.data;
    if (!data) {
      fixture.nativeReads++;
      data = fixture.token;
      fixture.listener?.({ type: 'ios', data });
      if (fixture.rotateDuringFetch) {
        fixture.token = 'native-b';
        fixture.listener?.({ type: 'ios', data: fixture.token });
      }
    }
    return { data: `ExpoPushToken[${data}]`, type: 'expo' };
  });
  fixture.api = vi.fn(async (path, options) => {
    fixture.requests.push({ path, body: JSON.parse(options.body) });
    return { ok: true, data: { enabled: options.method !== 'DELETE' } };
  });
  return fixture;
});
vi.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'default',
  getExpoPushTokenAsync: f.getExpo,
  setAutoServerRegistrationEnabledAsync: f.autoRegistration,
  setNotificationChannelAsync: async () => {},
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  setNotificationHandler: () => {},
  getLastNotificationResponse: () => f.lastResponse,
  clearLastNotificationResponseAsync: async () => {},
  addNotificationResponseReceivedListener: (cb) => {
    f.response = cb;
    return { remove() {} };
  },
  addNotificationReceivedListener: (cb) => {
    f.received = cb;
    return { remove() {} };
  },
  addPushTokenListener: (listener) => {
    f.listener = listener;
    return { remove() {} };
  },
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  setItemAsync: async () => {},
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: async (_algorithm, value) => value,
  randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.2' }, easConfig: { projectId: 'test-project' } },
}));
vi.mock('expo-application', () => ({
  ApplicationReleaseType: { SIMULATOR: 1 },
  getIosApplicationReleaseTypeAsync: f.getReleaseType,
}));
vi.mock('expo', () => ({
  requireNativeModule: (name) => {
    if (name !== 'NotificationsServerRegistrationModule')
      throw new Error('Unexpected native module');
    return { setRegistrationInfoAsync: f.nativeRegistration };
  },
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return f.platform;
    },
  },
  AppState: { addEventListener() {} },
}));
vi.mock('valtio', () => ({ proxy: (state) => state }));
vi.mock('@offside/app-core/api/client', () => ({ apiFetch: f.api }));
vi.mock('./session', () => ({
  ensureSession: async () => true,
  sessionToken: () => 'test-session',
  onSessionChanged() {},
}));
vi.mock('./inbox', () => ({
  openInbox: f.openInbox,
  openInboxTarget: f.openInboxTarget,
  inbox: { invalidate: f.invalidate, read: f.read },
}));
vi.mock('./friendPending', () => ({ refreshFriendPending: f.refreshFriends }));
vi.mock('../game/nav', () => ({ openBoard() {} }));
vi.mock('./setup', () => ({
  kv: {
    getString: (key) => f.values.get(key),
    getNumber: (key) => f.values.get(key),
    getBoolean: (key) => f.values.get(key),
    set: (key, value) => f.values.set(key, value),
    remove: (key) => f.values.delete(key),
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.values.clear();
  f.listener = undefined;
  f.lastResponse = null;
  f.rotateDuringFetch = false;
  f.nativeReads = 0;
  f.token = 'native-a';
  f.requests.length = 0;
  f.releaseType = 5;
  f.platform = 'ios';
  f.rejectNullRegistration = false;
});
async function app() {
  const p = await import('./push.ts');
  p.startPush();
  await p.pushRegistration.setEnabled(true);
  return p;
}
describe('native push token event registration', () => {
  it('handles the actual iOS String-only registration bridge when SDK disable sends null', async () => {
    f.releaseType = 1;
    f.rejectNullRegistration = true;
    const p = await app();
    expect(p.pushState).toMatchObject({ enabled: true, busy: false, failed: false });
    expect(f.nativeRegistration).toHaveBeenCalledWith('{"isEnabled":false}');
    expect(f.nativeRegistration.mock.invocationCallOrder[0]).toBeLessThan(
      f.getExpo.mock.invocationCallOrder[0],
    );
    expect(f.getExpo.mock.calls[0][0].development).toBe(true);
    expect(f.api).toHaveBeenCalledOnce();
  });
  it('registers an iOS simulator in APNs sandbox and stops SDK production auto-updates', async () => {
    f.releaseType = 1;
    const p = await app();
    expect(p.pushState).toMatchObject({ enabled: true, busy: false, failed: false });
    expect(f.autoRegistration).toHaveBeenCalledWith(false);
    expect(f.autoRegistration.mock.invocationCallOrder[0]).toBeLessThan(
      f.getExpo.mock.invocationCallOrder[0],
    );
    expect(f.getExpo).toHaveBeenLastCalledWith({
      projectId: 'test-project',
      devicePushToken: undefined,
      development: true,
      url: 'https://exp.host/--/api/v2/push/getExpoPushToken',
    });
    f.listener({ type: 'ios', data: 'native-b' });
    await vi.waitFor(() => expect(p.pushState.busy).toBe(false));
    expect(f.getExpo.mock.calls.at(-1)[0].development).toBe(true);
    expect(f.api).toHaveBeenCalledTimes(2);
  });
  it('leaves Android token routing to the SDK without querying iOS release type', async () => {
    f.platform = 'android';
    await app();
    expect(f.getReleaseType).not.toHaveBeenCalled();
    expect(f.autoRegistration).not.toHaveBeenCalled();
    expect(f.getExpo.mock.calls[0][0]).not.toHaveProperty('development');
    expect(f.getExpo.mock.calls[0][0]).not.toHaveProperty('url');
  });
  it('initial and duplicate APNs events settle with one registration', async () => {
    const p = await app();
    f.listener({ type: 'ios', data: 'native-a' });
    f.listener({ type: 'ios', data: 'native-a' });
    await p.pushRegistration.restore();
    expect(p.pushState).toMatchObject({ enabled: true, busy: false, failed: false });
    expect(f.getExpo).toHaveBeenCalledTimes(1);
    expect(f.api).toHaveBeenCalledTimes(1);
    expect(f.nativeReads).toBe(1);
    expect(f.autoRegistration).not.toHaveBeenCalled();
    expect(f.getExpo.mock.calls[0][0]).not.toHaveProperty('development');
  });
  it('a real rotation registers once using the delivered native token, without reading it again', async () => {
    const p = await app();
    f.listener({ type: 'ios', data: 'native-b' });
    await vi.waitFor(() => expect(p.pushState.busy).toBe(false));
    expect(f.getExpo).toHaveBeenLastCalledWith({
      projectId: 'test-project',
      devicePushToken: { type: 'ios', data: 'native-b' },
    });
    expect(f.requests.map((r) => r.body.token)).toEqual([
      'ExpoPushToken[native-a]',
      'ExpoPushToken[native-b]',
    ]);
    expect(f.nativeReads).toBe(1);
    f.listener({ type: 'ios', data: 'native-b' });
    await p.pushRegistration.restore();
    expect(f.api).toHaveBeenCalledTimes(2);
  });
  it('a token rotated during initial acquisition converges on the newest token and stops', async () => {
    f.rotateDuringFetch = true;
    const p = await app();
    expect(p.pushState).toMatchObject({ enabled: true, busy: false, failed: false });
    expect(f.requests.at(-1).body.token).toBe('ExpoPushToken[native-b]');
    expect(f.api).toHaveBeenCalledTimes(2);
    expect(f.nativeReads).toBe(1);
  });
});

describe('own-device test push cooldown', () => {
  it('blocks a second request and restores the cooldown after restarting', async () => {
    const p = await app();
    const nextTestAt = new Date(Date.now() + 600_000).toISOString();
    f.api.mockResolvedValueOnce({ ok: true, data: { accepted: true, nextTestAt } });
    await p.testOwnPush();
    const requests = f.api.mock.calls.length;
    await expect(p.testOwnPush()).rejects.toThrow('잠시 뒤');
    expect(f.api.mock.calls).toHaveLength(requests);
    vi.resetModules();
    const restarted = await import('./push.ts');
    expect(restarted.pushTestState.nextTestAt).toBe(Date.parse(nextTestAt));
    await expect(restarted.testOwnPush()).rejects.toThrow('잠시 뒤');
    expect(f.api.mock.calls).toHaveLength(requests);
  });
  it('blocks rapid concurrent taps before the request has finished', async () => {
    const p = await app();
    let finish;
    f.api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = p.testOwnPush();
    await expect(p.testOwnPush()).rejects.toThrow('잠시 뒤');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    finish({ ok: true, data: { accepted: true } });
    await first;
    expect(p.pushTestState.busy).toBe(false);
    expect(f.api.mock.calls.filter(([path]) => path === '/v1/push/test')).toHaveLength(1);
  });
  it('persists a pause on an uncertain response or server rate limit', async () => {
    const p = await app();
    f.api.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: '연결하지 못했어요.' },
    });
    await expect(p.testOwnPush()).rejects.toThrow();
    expect(p.pushTestState.nextTestAt).toBeGreaterThan(Date.now());
    expect(p.pushTestState.busy).toBe(false);
  });
});

describe('notification inbox routing and unified push subscription', () => {
  it('tracks a push that launches the terminated app', async () => {
    f.lastResponse = {
      actionIdentifier: 'default',
      notification: {
        request: { content: { data: { type: 'offside-news', notificationId: 'ntf_cold' } } },
      },
    };
    await app();
    await vi.waitFor(() =>
      expect(
        f.api.mock.calls.filter(([path]) => path.includes('ntf_cold/interaction')),
      ).toHaveLength(1),
    );
    expect(f.openInbox).toHaveBeenCalledWith('ntf_cold');
  });
  it('tracks OS default response clicks, and never tracks foreground receipt as a click', async () => {
    await app();
    const notification = {
      request: { content: { data: { type: 'offside-notification', notificationId: 'ntf_click' } } },
    };
    f.received(notification);
    f.response({ actionIdentifier: 'dismiss', notification });
    expect(f.api.mock.calls.some(([path]) => path.includes('/interaction'))).toBe(false);
    f.response({ actionIdentifier: 'default', notification });
    await vi.waitFor(() =>
      expect(f.api.mock.calls.filter(([path]) => path.includes('/interaction'))).toHaveLength(1),
    );
    const call = f.api.mock.calls.find(([path]) => path.includes('/interaction'));
    expect(JSON.parse(call[1].body).event).toBe('click');
  });
  it('opens only a validated inbox ID from trusted notification types', async () => {
    await app();
    f.response({
      actionIdentifier: 'default',
      notification: {
        request: {
          content: { data: { type: 'offside-notification', notificationId: 'ntf_safe' } },
        },
      },
    });
    expect(f.openInbox).toHaveBeenCalledWith('ntf_safe');
    f.response({
      actionIdentifier: 'default',
      notification: {
        request: {
          content: {
            data: { type: 'offside-notification', notificationId: 'https://evil.invalid' },
          },
        },
      },
    });
    expect(f.openInbox).toHaveBeenCalledTimes(1);
    f.received({
      request: { content: { data: { type: 'offside-notification', notificationId: 'ntf_next' } } },
    });
    expect(f.invalidate).toHaveBeenCalledTimes(2);
  });
  it('T-11-142 opens a friend notification straight at its validated target and marks it read', async () => {
    await app();
    const target = { type: 'screen', screen: 'team' };
    const data = {
      type: 'offside-notification',
      notificationId: 'ntf_friend',
      kind: 'social',
      target,
    };
    f.received({ request: { content: { data } } });
    expect(f.refreshFriends).toHaveBeenCalledWith(true);
    f.response({ actionIdentifier: 'default', notification: { request: { content: { data } } } });
    expect(f.read).toHaveBeenCalledWith('ntf_friend');
    expect(f.openInboxTarget).toHaveBeenCalledWith(target, 'social', 'ntf_friend');
    expect(f.openInbox).not.toHaveBeenCalled();
    // 대상이 이상하거나 친구 알림이 아니면 지금처럼 알림함을 연다.
    for (const bad of [
      { ...data, notificationId: 'ntf_bad', target: { type: 'url', href: 'https://evil.invalid' } },
      { ...data, notificationId: 'ntf_team', kind: 'team' },
    ])
      f.response({
        actionIdentifier: 'default',
        notification: { request: { content: { data: bad } } },
      });
    expect(f.openInbox.mock.calls).toEqual([['ntf_bad'], ['ntf_team']]);
    expect(f.openInboxTarget).toHaveBeenCalledTimes(1);
  });
  it('re-registers a legacy subscriber even when the removed engagement preference was off', async () => {
    f.values.set('offside_push_engagement', false);
    f.values.set('offside_push_registered', 'ExpoPushToken[native-a]|test-session|1.0.2|false');
    f.values.set('offside_push_registered_at', Date.now());
    const p = await app();
    expect(f.requests.at(-1).path).toBe('/v1/push/device');
    expect(f.requests.at(-1).body).not.toHaveProperty('engagementEnabled');
    expect(p.pushState.enabled).toBe(true);
    await p.pushRegistration.setEnabled(false);
    expect(p.pushState.enabled).toBe(false);
    expect(f.requests.at(-1).path).toBe('/v1/push/device');
  });
});
