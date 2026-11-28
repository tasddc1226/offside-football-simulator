/* global vi, beforeEach, describe, it, expect */
// T-11-846 Android 구글 로그인이 앱 재시작 · 먼저 돌아온 뒤에도 마저 끝나는지(남긴 기록 + 늦게 온 복귀 주소).
const f = vi.hoisted(() => ({
  os: 'android',
  store: new Map(),
  result: { type: 'success', url: '' },
  fetches: [],
  toasts: [],
  tokens: [],
  funnel: [],
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return f.os;
    },
  },
}));
vi.mock('expo-secure-store', () => ({
  setItemAsync: async (k, v) => void f.store.set(k, v),
  getItemAsync: async (k) => f.store.get(k) ?? null,
  deleteItemAsync: async (k) => void f.store.delete(k),
}));
vi.mock('expo-apple-authentication', () => ({}));
vi.mock('expo-crypto', () => ({
  getRandomBytes: () => new Uint8Array(32).fill(7),
  digestStringAsync: async () => 'Y2hhbGxlbmdl',
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  CryptoEncoding: { BASE64: 'base64' },
}));
vi.mock('expo-linking', () => ({
  parse: (url) => ({
    queryParams: Object.fromEntries(new URL(url.replace('offside://', 'https://x/')).searchParams),
  }),
}));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: async () => f.result }));
vi.mock('@offside/app-core/api/client', () => ({
  apiFetch: async (path, init) => {
    f.fetches.push([path, init?.body ? JSON.parse(init.body) : null]);
    if (path === '/v1/auth/app/google')
      return { ok: true, data: { url: 'https://accounts.google.com/x' } };
    if (path === '/v1/auth/app/exchange')
      return { ok: true, data: { token: 'tok', result: 'linked' } };
    return { ok: false, error: {} };
  },
  clearApiCache: () => {},
}));
vi.mock('@offside/app-core/outbox', () => ({ flushOutbox: async () => {} }));
vi.mock('@offside/app-core/loginText', () => ({
  googleFailText: () => 'fail',
  loginDoneText: () => 'done',
  loginOfflineText: () => 'offline',
}));
vi.mock('@offside/game/hof-store', () => ({ loadHOF: () => [] }));
vi.mock('@offside/app-core/state', () => ({ hofStart: () => ({}) }));
vi.mock('../analytics', () => ({ trackFunnel: (e) => f.funnel.push(e.outcome) }));
vi.mock('../store', () => ({ appState: { screen: 'home' } }));
vi.mock('../game/host', () => ({
  openLocalLegend: () => {},
  refreshAccount: async () => {},
  syncClubCustom: async () => {},
  syncCompCustom: async () => {},
  toast: (m) => f.toasts.push(m),
}));
vi.mock('../game/nav', () => ({ openBoard: () => {} }));
vi.mock('./session', () => ({
  ensureSession: async () => true,
  setSessionToken: async (t) => void f.tokens.push(t),
}));
vi.mock('@offside/app-core/i18n/ko/account', () => ({
  accountText: {
    googleFinishFail: 'finish-fail',
    googleNotFinished: 'not-finished',
    viaGoogle: 'g',
  },
}));

const RETURN = 'offside://auth?google=linked&ticket=tkt';
const exchanges = () => f.fetches.filter(([p]) => p === '/v1/auth/app/exchange');
const settle = () => new Promise((r) => setTimeout(r, 0));

let auth;
let ret;
beforeEach(async () => {
  vi.resetModules();
  f.os = 'android';
  f.store.clear();
  f.fetches = [];
  f.toasts = [];
  f.tokens = [];
  f.funnel = [];
  auth = await import('./auth.ts');
  ret = await import('./authReturn.ts');
  auth.startAuthReturns();
});

describe('T-11-846 Android 구글 로그인 복귀', () => {
  it('먼저 돌아오면(dismiss) 알리고 기록을 남겨, 브라우저에서 마친 뒤 온 주소로 마저 로그인한다', async () => {
    f.result = { type: 'dismiss' };
    await auth.startGoogleLogin(null, 'owner');
    expect(f.toasts).toEqual(['not-finished']);
    expect(f.store.has('ft_google_pending')).toBe(true);
    expect(f.funnel).toEqual(['start', 'cancel']);
    ret.receiveAuthReturn(RETURN);
    await settle();
    await settle();
    expect(exchanges()).toHaveLength(1);
    expect(exchanges()[0][1]).toMatchObject({ ticket: 'tkt' });
    expect(typeof exchanges()[0][1].verifier).toBe('string');
    expect(f.tokens).toEqual(['tok']);
    expect(f.store.has('ft_google_pending')).toBe(false);
    expect(f.funnel).toEqual(['start', 'cancel', 'linked']);
  });

  it('정상 로그인 뒤 같은 주소가 한 번 더 와도 다시 바꾸지 않고 안내도 없다', async () => {
    f.result = { type: 'success', url: RETURN };
    await auth.startGoogleLogin(null, 'owner');
    expect(exchanges()).toHaveLength(1);
    ret.receiveAuthReturn(RETURN);
    await settle();
    expect(exchanges()).toHaveLength(1);
    expect(f.toasts).toEqual(['done']);
  });

  it('앱이 종료됐다 다시 열려도 남긴 기록으로 마저 로그인한다(15분이 지난 기록은 쓰지 않는다)', async () => {
    f.store.set(
      'ft_google_pending',
      JSON.stringify({ verifier: 'v1', back: null, place: 'owner', at: Date.now() - 60_000 }),
    );
    ret.receiveAuthReturn(RETURN);
    await settle();
    await settle();
    expect(exchanges()).toEqual([['/v1/auth/app/exchange', { ticket: 'tkt', verifier: 'v1' }]]);
    f.fetches = [];
    f.store.set(
      'ft_google_pending',
      JSON.stringify({ verifier: 'v2', back: null, place: 'owner', at: Date.now() - 16 * 60_000 }),
    );
    ret.receiveAuthReturn(RETURN);
    await settle();
    expect(exchanges()).toHaveLength(0);
  });

  it('iOS에서 닫으면(cancel) 기록을 지우고 조용히 끝난다', async () => {
    f.os = 'ios';
    f.result = { type: 'cancel' };
    await auth.startGoogleLogin(null, 'owner');
    expect(f.toasts).toEqual([]);
    expect(f.store.has('ft_google_pending')).toBe(false);
  });
});
