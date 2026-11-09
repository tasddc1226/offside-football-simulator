import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';
import type { CommerceObservation } from '@offside/app-core/commerceStage';

// 강화권 · 스카우트권 구매 퍼널(commerce_stage) 웹 어댑터. 실제 browser.ts · index.ts를 쓰고 gtag 큐 · 스크립트 삽입 · fetch는
// 스텁으로 막는다(실제 GA4 전송 없음). 보내는 값 · 동의 · 계정 · gtag 실패가 결제 쪽 호출자에게 새지 않는지 본다.
vi.mock('./acquisition.js', () => ({
  recordAcquisition: vi.fn(),
  setAcquisitionConsent: vi.fn(async () => {}),
  acquisitionEnabled: () => false,
}));
vi.mock('../consent-region.js', () => ({ consentByDefault: () => false }));
vi.mock('../ui/adLanding.js', () => ({ landingClickId: () => null }));

const HOST = 'qa.offside.invalid';
type Win = Record<string, unknown> & { dataLayer?: ArrayLike<unknown>[]; fbq: unknown };
let win: Win;
let storage: Map<string, string>;
let networkCalls: unknown[][];

function stubBrowser() {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
  });
  const location = { hostname: HOST, origin: `https://${HOST}`, href: `https://${HOST}/` };
  win = { location, addEventListener: vi.fn(), fbq: vi.fn() };
  vi.stubGlobal('window', win);
  vi.stubGlobal('location', location);
  vi.stubGlobal('document', {
    referrer: '',
    cookie: '',
    head: { append: () => {} },
    createElement: () => ({ dataset: {} }),
  });
  vi.stubGlobal('navigator', {
    locks: { request: (_k: string, fn: () => unknown) => Promise.resolve().then(fn) },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (...args: unknown[]) => {
      networkCalls.push(args);
      throw new Error('network is not allowed in this test');
    }),
  );
}
const commerceCalls = () =>
  (win.dataLayer ?? [])
    .map((a) => Array.from(a))
    .filter((a) => a[0] === 'event' && a[1] === 'commerce_stage')
    .map((a) => a[2] as Record<string, unknown>);
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const obs: CommerceObservation = {
  stage: 'checkout_request',
  item: 'scout',
  entry: 'shop',
  store: 'xsolla',
  packSize: 5,
};

async function bootBrowser(consent: 'granted' | 'denied' | null) {
  if (consent) storage.set(CONSENT_KEY, consent);
  const mod = await import('./browser.js');
  mod.initializeAnalytics('shop');
  if (consent === 'granted')
    await vi.waitFor(() => {
      expect((win.dataLayer ?? []).length).toBeGreaterThan(0);
    });
  return mod;
}

describe('web commerce_stage adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123');
    vi.stubEnv('VITE_GA4_HOSTNAME', HOST);
    networkCalls = [];
    stubBrowser();
  });
  afterEach(() => {
    expect(networkCalls).toEqual([]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends only allowlisted fields plus the standard envelope (no ids, price, currency, value, purchase)', async () => {
    const { trackCommerce } = await bootBrowser('granted');
    trackCommerce({
      ...obs,
      orderId: 'wp_0123',
      profileId: 'p1',
      token: 't',
      error: 'boom',
      value: 1100,
      currency: 'KRW',
    } as unknown as CommerceObservation);
    const [p] = commerceCalls();
    expect(p).toMatchObject({
      commerce_contract: '1',
      stage: 'checkout_request',
      offer_item: 'scout',
      entrypoint: 'shop',
      store: 'xsolla',
      pack_size: 5,
      client_platform: 'web',
      send_to: 'G-TEST123',
    });
    for (const k of ['orderId', 'profileId', 'token', 'error', 'value', 'currency', 'items'])
      expect(p).not.toHaveProperty(k);
    expect(String(p?.page_location)).not.toMatch(/webpay|wp_|token/);
    const events = (win.dataLayer ?? []).map((a) => Array.from(a)[1]);
    expect(events).not.toContain('purchase');
    expect(events).not.toContain('in_app_purchase');
    // 광고 측정(메타 픽셀)으로는 보내지 않는다.
    expect(win.fbq).not.toHaveBeenCalled();
  });

  it.each(['denied', null] as const)('sends nothing without analytics consent (%s)', async (c) => {
    const { trackCommerce } = await bootBrowser(c);
    trackCommerce(obs);
    await flush();
    expect(commerceCalls()).toEqual([]);
  });

  it('after revoke nothing is sent, and earlier queued tag entries are dropped', async () => {
    const { trackCommerce, setConsent } = await bootBrowser('granted');
    trackCommerce(obs);
    setConsent('denied');
    expect(commerceCalls()).toEqual([]); // stop()이 이 탭의 gtag 큐를 비운다
    trackCommerce(obs);
    expect(commerceCalls()).toEqual([]);
  });

  it('invalid observations never reach gtag', async () => {
    const { trackCommerce } = await bootBrowser('granted');
    trackCommerce({ ...obs, item: 'reroll' } as unknown as CommerceObservation);
    trackCommerce({ ...obs, stage: 'purchase' } as unknown as CommerceObservation);
    expect(commerceCalls()).toEqual([]);
  });

  it('gtag sync throw and promise rejection never reach the caller', async () => {
    const { trackCommerce } = await bootBrowser('granted');
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      win.gtag = () => {
        throw new Error('blocked');
      };
      expect(() => trackCommerce(obs)).not.toThrow();
      win.gtag = () => Promise.reject(new Error('blocked async'));
      expect(() => trackCommerce(obs)).not.toThrow();
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('index: commerceContext drops delayed stages after consent change or account switch', async () => {
    storage.set(CONSENT_KEY, 'granted');
    const index = await import('./index.js');
    let account: string | null = 'pk_a';
    index.setRetireAccountSource(() => account);
    index.initializeAnalytics('shop');
    const browser = await import('./browser.js');
    await vi.waitFor(() => {
      expect((win.dataLayer ?? []).length).toBeGreaterThan(0);
    });

    const alive = index.commerceContext();
    index.trackCommerce(obs, alive);
    expect(commerceCalls()).toHaveLength(1);

    // 주문 응답을 기다리는 사이 계정이 바뀜 → 늦은 오류는 버린다.
    index.noteRetireAccount(); // 처음 확인된 계정(A)
    const aliveA = index.commerceContext();
    account = 'pk_b';
    index.noteRetireAccount();
    index.trackCommerce({ ...obs, stage: 'checkout_error', reason: 'start_failed' }, alive);
    expect(commerceCalls()).toHaveLength(1);
    // A → B → A로 돌아와도 A 때 시작한 시도는 무효다.
    account = 'pk_a';
    index.noteRetireAccount();
    index.trackCommerce({ ...obs, stage: 'checkout_error', reason: 'start_failed' }, aliveA);
    expect(commerceCalls()).toHaveLength(1);
    // 같은 계정의 확인 결과가 다시 와도(바뀌지 않음) 진행 중 시도는 그대로다.
    const aliveA2 = index.commerceContext();
    index.noteRetireAccount();
    index.trackCommerce({ ...obs, stage: 'checkout_error', reason: 'start_failed' }, aliveA2);
    expect(commerceCalls()).toHaveLength(2);

    // 거절 → 재동의 사이에 시작한 시도의 늦은 단계도 버린다.
    const alive2 = index.commerceContext();
    browser.setConsent('denied');
    browser.setConsent('granted');
    await vi.waitFor(() => {
      expect((win.dataLayer ?? []).length).toBeGreaterThan(0);
    });
    index.trackCommerce({ ...obs, stage: 'checkout_error', reason: 'start_failed' }, alive2);
    expect(commerceCalls()).toEqual([]);
    // 새 맥락의 새 시도는 남는다.
    index.trackCommerce(obs, index.commerceContext());
    expect(commerceCalls()).toHaveLength(1);
  });
});
