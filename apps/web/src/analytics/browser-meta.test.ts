import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY, type Career } from '@offside/app-core/analytics-model';

// Meta FirstSeason은 완료 시즌 수가 1일 때만 보낸다. game-actions는 시즌이 끝날 때마다
// analytics.firstSeason을 부르므로, 웹 어댑터(browser.ts)가 시즌 1인지 직접 거른다.
// 같은 시즌 1 재호출의 Meta 중복 제거는 이번 수정 범위 밖이다. 기존 GA4 once 장부는 그대로 둔다.
// 실제 browser.ts · meta.ts · analytics-tracker · player-metrics를 그대로 쓰고, 밖으로 나가는 길
// (gtag 큐 · fbq · 스크립트 삽입 · fetch)은 모두 스텁으로 막아 실제 GA4 · Meta 전송은 없다.
const acq = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock('./acquisition.js', () => ({
  recordAcquisition: acq.record,
  setAcquisitionConsent: vi.fn(async () => {}),
  acquisitionEnabled: () => false,
}));
vi.mock('../consent-region.js', () => ({ consentByDefault: () => false }));
vi.mock('../ui/adLanding.js', () => ({ landingClickId: () => null }));

const AD_CONSENT_KEY = 'offside_ad_consent_v1';
const HOST = 'qa.offside.invalid';

type Win = Record<string, unknown> & {
  dataLayer?: ArrayLike<unknown>[];
  fbq: ReturnType<typeof vi.fn>;
};
let win: Win;
let storage: Map<string, string>;
let appended: unknown[];
let networkCalls: unknown[][];

const career = (n: number, cid = 'career-a'): Career => ({
  cid,
  year: 2026 + n,
  pos: 'FW',
  trait: 'early',
  career: Array.from({ length: n }, () => ({})),
  retired: false,
});

function stubBrowser(fresh = true) {
  if (fresh) storage = new Map();
  appended = [];
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
    head: { append: (el: unknown) => appended.push(el) },
    createElement: () => ({ dataset: {} }),
  });
  vi.stubGlobal('navigator', {
    locks: { request: (_key: string, fn: () => unknown) => Promise.resolve().then(fn) },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (...args: unknown[]) => {
      networkCalls.push(args);
      throw new Error('network is not allowed in this test');
    }),
  );
}

function setConsentStorage(kind: 'accepted' | 'unset' | 'rejected' | 'analytics-only') {
  if (kind === 'unset') return;
  storage.set(CONSENT_KEY, kind === 'rejected' ? 'denied' : 'granted');
  storage.set(AD_CONSENT_KEY, kind === 'accepted' ? 'granted' : 'denied');
}

async function boot() {
  const mod = await import('./browser.js');
  mod.initializeAnalytics('game');
  // loadTag는 트래커를 동적 import한 뒤에 gtag 큐를 만든다.
  await vi.waitFor(() => {
    if (storage.get(CONSENT_KEY) === 'granted') expect(gaEvents()).toContain('page_view');
  });
  return mod;
}

const gaCalls = () =>
  (win.dataLayer ?? []).map((a) => Array.from(a)).filter((a) => a[0] === 'event') as [
    string,
    string,
    Record<string, unknown>,
  ][];
const gaEvents = () => gaCalls().map((a) => a[1]);
const metaEvents = () =>
  win.fbq.mock.calls.filter((c) => c[0] === 'trackCustom').map((c) => c[1] as string);
const count = (list: string[], name: string) => list.filter((e) => e === name).length;
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('Meta FirstSeason은 시즌 1에서만', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123');
    vi.stubEnv('VITE_GA4_HOSTNAME', HOST);
    vi.stubEnv('VITE_META_PIXEL_ID', '1234567890');
    acq.record.mockClear();
    networkCalls = [];
    stubBrowser();
  });
  afterEach(() => {
    // 모든 케이스에서 네트워크 요청이 한 번도 없었다(새로고침으로 fetch 스텁을 바꾼 케이스 포함).
    expect(networkCalls).toEqual([]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    [0, 0],
    [1, 1],
    [2, 0],
    [3, 0],
  ])('완료 시즌 %i개면 Meta FirstSeason %i번', async (n, expected) => {
    setConsentStorage('accepted');
    const { analytics } = await boot();
    analytics.firstSeason(career(n));
    expect(count(metaEvents(), 'FirstSeason')).toBe(expected);
    expect(count(gaEvents(), 'first_season_complete')).toBe(n === 1 ? 1 : 0);
  });

  it('시즌 1 → 2 → 3을 이어서 마쳐도 Meta · GA4 첫 시즌은 한 번, GA4 3시즌 이정표는 그대로', async () => {
    setConsentStorage('accepted');
    const { analytics } = await boot();
    for (const n of [1, 2, 3]) analytics.firstSeason(career(n));
    expect(count(metaEvents(), 'FirstSeason')).toBe(1);
    expect(count(gaEvents(), 'first_season_complete')).toBe(1);
    const milestones = gaCalls().filter((c) => c[1] === 'career_progress_milestone');
    expect(milestones.map((c) => c[2].milestone_seasons)).toEqual([3]);
  });

  it('시즌 1을 이 탭에서 보지 못한 채 후속 시즌부터 들어오면 Meta FirstSeason을 보내지 않는다', async () => {
    setConsentStorage('accepted');
    const { analytics } = await boot();
    analytics.firstSeason(career(2));
    analytics.firstSeason(career(3));
    analytics.firstSeason(career(4));
    expect(metaEvents()).not.toContain('FirstSeason');
    expect(gaEvents()).not.toContain('first_season_complete');
  });

  it('GA4로 넘기는 값은 그대로다(첫 시즌 매개변수)', async () => {
    setConsentStorage('accepted');
    const { analytics } = await boot();
    analytics.firstSeason(career(1));
    const first = gaCalls().find((c) => c[1] === 'first_season_complete');
    expect(first?.[2]).toMatchObject({
      position: 'FW',
      player_trait: 'early',
      career_origin: 'preexisting_or_unknown',
      client_platform: 'web',
      send_to: 'G-TEST123',
    });
  });

  it('GA4 첫 시즌 once는 새로고침 뒤에도 유지되고, 새 커리어는 다시 보낸다', async () => {
    setConsentStorage('accepted');
    let { analytics } = await boot();
    analytics.firstSeason(career(1, 'career-a'));
    expect(count(gaEvents(), 'first_season_complete')).toBe(1);

    // 같은 저장소로 새 탭(모듈 다시 불러오기).
    vi.resetModules();
    stubBrowser(false);
    ({ analytics } = await boot());
    analytics.firstSeason(career(1, 'career-a'));
    expect(gaEvents()).not.toContain('first_season_complete');

    analytics.firstSeason(career(1, 'career-b'));
    expect(count(gaEvents(), 'first_season_complete')).toBe(1);
    expect(count(metaEvents(), 'FirstSeason')).toBe(2);
    analytics.firstSeason(career(2, 'career-b'));
    expect(count(metaEvents(), 'FirstSeason')).toBe(2);
  });

  it.each(['unset', 'rejected'] as const)(
    '동의 %s면 GA4 · Meta 모두 보내지 않는다',
    async (kind) => {
      setConsentStorage(kind);
      const { analytics, trackAppStoreClick } = await boot();
      analytics.start(career(0), null);
      for (const n of [1, 2]) analytics.firstSeason(career(n));
      trackAppStoreClick('home', 'ios');
      await flush();
      expect(win.fbq).not.toHaveBeenCalled();
      expect(win.dataLayer).toBeUndefined();
      expect(appended).toEqual([]);
    },
  );

  it('이용 분석만 동의하고 광고 측정은 거절하면 GA4만 보낸다', async () => {
    setConsentStorage('analytics-only');
    const { analytics } = await boot();
    analytics.firstSeason(career(1));
    expect(gaEvents()).toContain('first_season_complete');
    expect(win.fbq).not.toHaveBeenCalled();
  });

  it('CareerStart · AppStoreClick · 시즌 지표는 기존대로다', async () => {
    setConsentStorage('accepted');
    const { analytics, trackAppStoreClick } = await boot();
    const s0 = career(0);
    analytics.start(s0, null);
    expect(count(metaEvents(), 'CareerStart')).toBe(1);
    expect(gaEvents()).toContain('career_start');
    expect(acq.record).toHaveBeenCalledWith('start');

    analytics.complete({ cid: s0.cid, year: s0.year!, phase: 1, matches: 5 });
    for (const n of [1, 2]) analytics.firstSeason(career(n));
    await vi.waitFor(() => expect(gaEvents()).toContain('player_first_season'));
    expect(count(gaEvents(), 'player_first_play')).toBe(1);
    expect(count(gaEvents(), 'player_first_season')).toBe(1);

    trackAppStoreClick('home', 'android');
    expect(count(metaEvents(), 'AppStoreClick')).toBe(1);
    const click = gaCalls().find((c) => c[1] === 'app_store_click');
    expect(click?.[2]).toMatchObject({ place: 'home', store: 'android' });
    expect(acq.record).toHaveBeenCalledWith('store_click');

    expect(metaEvents()).toEqual(['CareerStart', 'FirstSeason', 'AppStoreClick']);
  });

  it('동의를 철회하면 첫 시즌 · 후속 시즌 · 기존 이벤트를 막고, 다시 동의한 뒤 시즌 2는 Meta FirstSeason을 보내지 않는다', async () => {
    setConsentStorage('accepted');
    const { analytics, setConsent, trackAppStoreClick } = await boot();
    analytics.firstSeason(career(1));
    expect(metaEvents()).toEqual(['FirstSeason']);

    setConsent('denied');
    expect(storage.get(CONSENT_KEY)).toBe('denied');
    expect(storage.get(AD_CONSENT_KEY)).toBe('denied');
    expect(win.fbq).toHaveBeenCalledWith('consent', 'revoke');
    const metaBefore = metaEvents().length;
    analytics.start(career(0, 'career-b'), null);
    analytics.firstSeason(career(1, 'career-b'));
    analytics.firstSeason(career(2));
    trackAppStoreClick('home', 'ios');
    await flush();
    expect(metaEvents()).toHaveLength(metaBefore);
    expect(gaEvents()).toEqual([]);

    setConsent('granted');
    await vi.waitFor(() => expect(gaEvents()).toContain('page_view'));
    expect(win.fbq).toHaveBeenCalledWith('consent', 'grant');
    analytics.firstSeason(career(2));
    expect(count(metaEvents(), 'FirstSeason')).toBe(1);
    expect(gaEvents()).not.toContain('first_season_complete');
    // 다시 동의한 뒤에는 보내는 길이 살아 있다(위의 '안 보냄'이 비어 있는 확인이 아님).
    analytics.start(career(0, 'career-c'), null);
    expect(metaEvents().at(-1)).toBe('CareerStart');
    expect(gaEvents()).toContain('career_start');
  });
});
