/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({ gather: vi.fn(), inTest: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
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
});
