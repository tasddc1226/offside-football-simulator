import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';

// T-11-779 상품 안내(offer_hint_*) 웹 어댑터. 실제 browser.ts를 쓰고 gtag 큐 · 스크립트 삽입 · fetch는 스텁으로 막는다.
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
const hintCalls = () =>
  (win.dataLayer ?? [])
    .map((a) => Array.from(a))
    .filter((a) => a[0] === 'event' && String(a[1]).startsWith('offer_hint_'))
    .map((a) => [a[1], a[2] as Record<string, unknown>] as const);

async function bootBrowser(consent: 'granted' | 'denied') {
  storage.set(CONSENT_KEY, consent);
  const mod = await import('./browser.js');
  mod.initializeAnalytics('retired');
  if (consent === 'granted')
    await vi.waitFor(() => {
      expect((win.dataLayer ?? []).length).toBeGreaterThan(0);
    });
  return mod;
}

describe('web offer_hint adapter', () => {
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

  it('sends view once per page run, then click and close with the place', async () => {
    const { trackOfferHint } = await bootBrowser('granted');
    trackOfferHint('view', 'pass_retired');
    trackOfferHint('view', 'pass_retired');
    trackOfferHint('click', 'pass_retired', 'go');
    trackOfferHint('close', 'pass_retired');
    trackOfferHint('view', 'PRIVATE' as never);
    const calls = hintCalls();
    expect(calls.map(([name, p]) => [name, p.place, p.step])).toEqual([
      ['offer_hint_view', 'pass_retired', undefined],
      ['offer_hint_click', 'pass_retired', 'go'],
      ['offer_hint_close', 'pass_retired', undefined],
    ]);
    expect(calls[0]?.[1]).toMatchObject({ client_platform: 'web', send_to: 'G-TEST123' });
    // 광고 측정(메타 픽셀)으로는 보내지 않는다.
    expect(win.fbq).not.toHaveBeenCalled();
  });

  it('sends nothing without analytics consent', async () => {
    const { trackOfferHint } = await bootBrowser('denied');
    trackOfferHint('view', 'pass_retired');
    trackOfferHint('click', 'pass_retired', 'go');
    expect(hintCalls()).toEqual([]);
  });

  it('index drops calls before the adapter is loaded', async () => {
    const index = await import('./index.js');
    expect(() => index.trackOfferHint('view', 'pass_retired')).not.toThrow();
    expect(hintCalls()).toEqual([]);
  });
});
