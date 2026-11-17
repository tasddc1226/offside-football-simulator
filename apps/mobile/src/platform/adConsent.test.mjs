/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({
  gather: vi.fn(),
  inTest: vi.fn(),
  request: vi.fn(),
  order: [],
  os: 'android',
  granted: false,
  status: 'granted',
  app: 'active',
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return f.os;
    },
  },
  AppState: {
    get currentState() {
      return f.app;
    },
    addEventListener: (_e, cb) => {
      setTimeout(() => {
        f.app = 'active';
        cb('active');
      }, 0);
      return { remove() {} };
    },
  },
}));
vi.mock('expo-tracking-transparency', () => ({
  isAvailable: () => true,
  getTrackingPermissionsAsync: () => Promise.resolve({ granted: f.granted, status: f.status }),
  requestTrackingPermissionsAsync: f.request,
}));
vi.mock('react-native-google-mobile-ads', () => ({
  default: () => ({
    setRequestConfiguration: () => Promise.resolve(),
    initialize: () => Promise.resolve(),
  }),
  AdsConsent: { gatherConsent: f.gather },
  AdsConsentStatus: { NOT_REQUIRED: 'NOT_REQUIRED', OBTAINED: 'OBTAINED' },
}));
vi.mock('@offside/app-core/i18n/core', () => ({ deviceLocales: () => ['ko-KR'] }));
vi.mock('./adPersonalization', () => ({ allowPersonalizedAds: f.inTest }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.os = 'android';
  f.granted = false;
  f.status = 'granted';
  f.app = 'active';
  f.order.length = 0;
});

describe('ad request options', () => {
  it('stays non-personalized before consent and outside the test', async () => {
    f.gather.mockResolvedValue({ canRequestAds: true, status: 'NOT_REQUIRED' });
    f.inTest.mockReturnValue(false);
    const m = await import('./adConsent');
    expect(m.adRequestOptions()).toEqual({ requestNonPersonalizedAdsOnly: true });
    expect(await m.askConsent()).toBe(true);
    expect(m.adRequestOptions()).toEqual({ requestNonPersonalizedAdsOnly: true });
  });

  it('opens only for the test group and passes the consent region', async () => {
    f.gather.mockResolvedValue({ canRequestAds: true, status: 'OBTAINED' });
    f.inTest.mockReturnValue(true);
    const m = await import('./adConsent');
    await m.askConsent();
    expect(f.inTest).toHaveBeenCalledWith({
      os: 'android',
      locales: ['ko-KR'],
      consentRequired: true,
    });
    expect(m.adRequestOptions()).toEqual({ requestNonPersonalizedAdsOnly: false });
  });

  it('does not draw when ads cannot be requested', async () => {
    f.gather.mockResolvedValue({ canRequestAds: false, status: 'REQUIRED' });
    const m = await import('./adConsent');
    expect(await m.askConsent()).toBe(false);
    expect(f.inTest).not.toHaveBeenCalled();
    expect(m.adRequestOptions()).toEqual({ requestNonPersonalizedAdsOnly: true });
  });

  it('passes the iOS tracking permission (T-11-698)', async () => {
    f.os = 'ios';
    f.granted = true;
    f.gather.mockResolvedValue({ canRequestAds: true, status: 'NOT_REQUIRED' });
    f.inTest.mockReturnValue(true);
    const m = await import('./adConsent');
    await m.askConsent();
    expect(f.inTest).toHaveBeenCalledWith({
      os: 'ios',
      locales: ['ko-KR'],
      consentRequired: false,
      tracking: true,
    });
    expect(m.adRequestOptions()).toEqual({ requestNonPersonalizedAdsOnly: false });
  });

  it('asks ATT itself before AdMob consent when undetermined (T-11-740)', async () => {
    vi.useFakeTimers();
    f.os = 'ios';
    f.status = 'undetermined';
    f.app = 'background';
    f.request.mockImplementation(async () => {
      f.order.push('att');
      return { granted: true, status: 'granted' };
    });
    f.gather.mockImplementation(async () => {
      f.order.push('ump');
      return { canRequestAds: true, status: 'NOT_REQUIRED' };
    });
    f.inTest.mockReturnValue(true);
    const m = await import('./adConsent');
    const done = m.askConsent();
    await vi.runAllTimersAsync();
    expect(await done).toBe(true);
    vi.useRealTimers();
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(f.order).toEqual(['att', 'ump']);
    expect(f.inTest).toHaveBeenCalledWith(expect.objectContaining({ tracking: true }));
  });

  it('does not ask again once answered, and never on Android', async () => {
    f.os = 'ios';
    f.status = 'denied';
    f.gather.mockResolvedValue({ canRequestAds: true, status: 'NOT_REQUIRED' });
    f.inTest.mockReturnValue(false);
    const t = await import('./tracking');
    expect(await t.askTracking()).toBe(false);
    expect(f.request).not.toHaveBeenCalled();
    vi.resetModules();
    f.os = 'android';
    f.status = 'undetermined';
    const t2 = await import('./tracking');
    expect(await t2.askTracking()).toBe(false);
    expect(f.request).not.toHaveBeenCalled();
  });
});
