/* global vi, beforeEach, afterEach, describe, it, expect */
const f = vi.hoisted(() => ({
  platform: 'ios',
  owned: false,
  consent: vi.fn(),
  create: vi.fn(),
  ads: [],
  countInterstitial: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { select: (units) => units[f.platform] } }));
vi.mock('react-native-google-mobile-ads', () => ({
  AdEventType: { LOADED: 'loaded', OPENED: 'opened', CLOSED: 'closed', ERROR: 'error' },
  TestIds: { INTERSTITIAL: 'test-interstitial' },
  InterstitialAd: { createForAdRequest: f.create },
}));
vi.mock('./adConsent', () => ({ askConsent: f.consent }));
vi.mock('./adUsage', () => ({ countInterstitial: f.countInterstitial }));
vi.mock('./adFree', () => ({
  adFree: {
    get owned() {
      return f.owned;
    },
  },
}));

beforeEach(() => {
  vi.stubGlobal('__DEV__', false);
  vi.resetModules();
  vi.clearAllMocks();
  f.ads = [];
  f.platform = 'ios';
  f.owned = false;
  f.consent.mockResolvedValue(true);
  f.create.mockImplementation(() => {
    const listeners = new Map();
    const ad = {
      listeners,
      load: vi.fn(),
      show: vi.fn().mockResolvedValue(undefined),
      addAdEventListener: (event, fn) => {
        listeners.set(event, fn);
        return () => listeners.delete(event);
      },
    };
    f.ads.push(ad);
    return ad;
  });
});
afterEach(() => vi.unstubAllGlobals());

const flush = () => new Promise((r) => setTimeout(r, 0));
async function loaded(now = 0) {
  const m = await import('./interstitial');
  m.prepareRetireAd(now);
  await flush();
  f.ads.at(-1).listeners.get('loaded')();
  return m;
}

describe('retire interstitial', () => {
  it.each([
    ['ios', 'ca-app-pub-3797087216173591/7389473145'],
    ['android', 'ca-app-pub-3797087216173591/5709559962'],
  ])('preloads the %s unit and shows it once on retirement', async (platform, unit) => {
    f.platform = platform;
    const m = await loaded(Date.now());
    expect(f.create).toHaveBeenCalledWith(unit, { requestNonPersonalizedAdsOnly: true });
    expect(m.showRetireAd()).toBe(true);
    const ad = f.ads[0];
    expect(ad.show).toHaveBeenCalledOnce();
    expect(m.interstitial.showing).toBe(true);
    ad.listeners.get('opened')();
    expect(f.countInterstitial).toHaveBeenCalledOnce();
    ad.listeners.get('closed')();
    expect(m.interstitial.showing).toBe(false);
    expect(ad.listeners.size).toBe(0);
    // 한 번 쓴 광고는 다시 띄우지 않는다.
    expect(m.showRetireAd()).toBe(false);
  });

  it('does not request again while a fresh ad is waiting', async () => {
    const now = Date.now();
    const m = await loaded(now);
    m.prepareRetireAd(now + 10 * 60_000);
    await flush();
    expect(f.create).toHaveBeenCalledOnce();
    // 50분이 지나면 새로 부른다.
    m.prepareRetireAd(now + 51 * 60_000);
    await flush();
    expect(f.create).toHaveBeenCalledTimes(2);
  });

  it('skips retirement when the ad is not ready or too old instead of showing it late', async () => {
    const m = await import('./interstitial');
    m.prepareRetireAd();
    await flush();
    expect(m.showRetireAd()).toBe(false);
    f.ads[0].listeners.get('loaded')();
    expect(m.showRetireAd(Date.now() + 60 * 60_000)).toBe(false);
    expect(f.ads[0].show).not.toHaveBeenCalled();
  });

  it('never loads for ad-free owners or without consent, and waits after a load error', async () => {
    f.owned = true;
    let m = await import('./interstitial');
    m.prepareRetireAd();
    await flush();
    expect(f.consent).not.toHaveBeenCalled();

    vi.resetModules();
    f.owned = false;
    f.consent.mockResolvedValue(false);
    m = await import('./interstitial');
    m.prepareRetireAd(0);
    await flush();
    expect(f.create).not.toHaveBeenCalled();

    vi.resetModules();
    f.consent.mockResolvedValue(true);
    m = await import('./interstitial');
    const now = Date.now();
    m.prepareRetireAd(now);
    await flush();
    f.ads[0].listeners.get('error')();
    m.prepareRetireAd(now + 60_000);
    await flush();
    expect(f.create).toHaveBeenCalledOnce();
  });

  it('shows at most once every three minutes', async () => {
    const now = Date.now();
    const m = await loaded(now);
    expect(m.showRetireAd(now)).toBe(true);
    f.ads[0].listeners.get('closed')();
    m.prepareRetireAd(now);
    await flush();
    f.ads[1].listeners.get('loaded')();
    expect(m.showRetireAd(now + 60_000)).toBe(false);
    expect(f.ads[1].show).not.toHaveBeenCalled();
  });
});
