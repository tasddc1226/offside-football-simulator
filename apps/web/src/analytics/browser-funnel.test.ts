import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';
import type { FunnelEvent } from '@offside/app-core/funnelEvents';

// T-11-781 로그인 시도 · 이번 시즌 팀 저장 · 따라가기 안내 단계의 웹 어댑터. 실제 browser.ts · index.ts를 쓰고 gtag 큐 · 스크립트 삽입 ·
// fetch는 스텁으로 막는다(실제 GA4 전송 없음). 동의 없이는 보내지 않고, 허용 목록 값만 나가는지 본다.
vi.mock('./acquisition.js', () => ({
  recordAcquisition: vi.fn(),
  setAcquisitionConsent: vi.fn(async () => {}),
  acquisitionEnabled: () => false,
}));
vi.mock('../consent-region.js', () => ({ consentByDefault: () => false }));
vi.mock('../ui/adLanding.js', () => ({ landingClickId: () => null }));

const HOST = 'qa.offside.invalid';
type Win = Record<string, unknown> & { dataLayer?: ArrayLike<unknown>[] };
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
const NAMES = /^(login_attempt|team_|tutorial_)/;
const calls = () =>
  (win.dataLayer ?? [])
    .map((a) => Array.from(a))
    .filter((a) => a[0] === 'event' && NAMES.test(String(a[1])))
    .map((a) => [a[1], a[2]] as [string, Record<string, unknown>]);
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const tagReady = () =>
  vi.waitFor(() => {
    expect((win.dataLayer ?? []).length).toBeGreaterThan(0);
  });
const start: FunnelEvent = { kind: 'login', outcome: 'start', place: 'retire', provider: 'google' };

describe('web login, season team and tutorial funnel', () => {
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

  it('sends allowlisted values only, folds unknown reasons and drops unknown places', async () => {
    storage.set(CONSENT_KEY, 'granted');
    const mod = await import('./browser.js');
    mod.initializeAnalytics('home');
    await tagReady();
    mod.trackFunnel(start);
    mod.trackFunnel({
      kind: 'login',
      outcome: 'fail',
      place: 'other',
      provider: 'apple',
      reason: 'PRIVATE server text',
    });
    mod.trackFunnel({ ...start, place: 'PRIVATE' as never });
    mod.trackFunnel({ kind: 'team_view', players: 4 });
    mod.trackFunnel({ kind: 'team_view', players: 4 });
    mod.trackFunnel({ kind: 'team_done', starters: 11 });
    mod.trackFunnel({ kind: 'team_fail', reason: 'BLOCKED_WORD', created: true });
    mod.trackFunnel({ kind: 'tutorial', action: 'step', step: 'new' });
    mod.trackFunnel({ kind: 'tutorial', action: 'step', step: 'new' });
    mod.trackFunnel({ kind: 'tutorial', action: 'done', step: 'retire' });
    const pick = (p: Record<string, unknown>) =>
      Object.fromEntries(
        ['place', 'provider', 'outcome', 'reason', 'players', 'starters', 'mode', 'step']
          .filter((k) => k in p)
          .map((k) => [k, p[k]]),
      );
    expect(calls().map(([name, p]) => [name, pick(p)])).toEqual([
      ['login_attempt', { place: 'retire', provider: 'google', outcome: 'start' }],
      ['login_attempt', { place: 'other', provider: 'apple', outcome: 'fail', reason: 'other' }],
      ['team_create_view', { players: '1_4' }],
      ['team_create_done', { starters: '11' }],
      ['team_save_fail', { reason: 'BLOCKED_WORD', mode: 'create' }],
      ['tutorial_step', { step: 'new' }],
      ['tutorial_done', { step: 'retire' }],
    ]);
    expect(calls()[0]![1]).toMatchObject({ client_platform: 'web', send_to: 'G-TEST123' });
    expect(JSON.stringify(calls())).not.toContain('PRIVATE');
  });

  it.each(['denied', null] as const)('sends nothing without analytics consent (%s)', async (c) => {
    if (c) storage.set(CONSENT_KEY, c);
    const mod = await import('./browser.js');
    mod.initializeAnalytics('home');
    mod.trackFunnel(start);
    mod.trackFunnel({ kind: 'tutorial', action: 'step', step: 'new' });
    await flush();
    expect(calls()).toEqual([]);
    // 뒤늦게 동의해도 동의 전 것은 보내지 않는다.
    mod.setConsent('granted');
    await tagReady();
    expect(calls()).toEqual([]);
  });

  it('holds events from before the adapter and the tag are ready (OAuth return) and sends them once', async () => {
    storage.set(CONSENT_KEY, 'granted');
    const index = await import('./index.js');
    // 로그인에서 돌아온 직후: 어댑터를 불러오기 전에 결과가 먼저 온다.
    index.trackFunnel({ kind: 'login', outcome: 'linked', place: 'home', provider: 'google' });
    index.initializeAnalytics('home');
    await tagReady();
    await vi.waitFor(() => {
      expect(calls().map(([name, p]) => [name, p.outcome, p.place])).toEqual([
        ['login_attempt', 'linked', 'home'],
      ]);
    });
  });

  it('drops held events when consent is withdrawn before the tag loads', async () => {
    storage.set(CONSENT_KEY, 'granted');
    const mod = await import('./browser.js');
    mod.initializeAnalytics('home');
    mod.trackFunnel(start); // 태그를 불러오는 중
    mod.setConsent('denied');
    await flush();
    mod.setConsent('granted');
    await tagReady();
    await flush();
    expect(calls()).toEqual([]);
  });
});
