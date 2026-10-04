/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => {
  const fixture = {
    values: new Map(),
    listener: undefined,
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
  getExpoPushTokenAsync: f.getExpo,
  setAutoServerRegistrationEnabledAsync: f.autoRegistration,
  setNotificationChannelAsync: async () => {},
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  setNotificationHandler: () => {},
  getLastNotificationResponse: () => null,
  clearLastNotificationResponseAsync: async () => {},
  addNotificationResponseReceivedListener: () => ({ remove() {} }),
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
