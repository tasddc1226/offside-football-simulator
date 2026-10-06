/* global vi, beforeEach, afterEach, describe, it, expect */
const f = vi.hoisted(() => ({
  platform: 'ios',
  owned: false,
  consent: vi.fn(),
  create: vi.fn(),
  listeners: new Map(),
}));
vi.mock('react-native', () => ({ Platform: { select: (units) => units[f.platform] } }));
vi.mock('react-native-google-mobile-ads', () => ({
  AdEventType: { CLOSED: 'closed', ERROR: 'error' },
  RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' },
  TestIds: { REWARDED: 'test-rewarded' },
  RewardedAd: { createForAdRequest: f.create },
}));
vi.mock('./adConsent', () => ({ askConsent: f.consent }));
vi.mock('./adFree', () => ({
  adFree: {
    get owned() {
      return f.owned;
    },
  },
}));
vi.mock('@offside/app-core/i18n/ko/ad', () => ({ adText: { rewardedUnavailable: 'unavailable' } }));
let show;
beforeEach(() => {
  vi.stubGlobal('__DEV__', false);
  vi.resetModules();
  vi.clearAllMocks();
  f.listeners.clear();
  f.platform = 'ios';
  f.owned = false;
  f.consent.mockResolvedValue(true);
  show = vi.fn().mockResolvedValue(undefined);
  f.create.mockImplementation(() => ({
    loaded: true,
    show,
    load: vi.fn(),
    addAdEventListener: (event, fn) => {
      f.listeners.set(event, fn);
      return () => f.listeners.delete(event);
    },
  }));
});
afterEach(() => vi.unstubAllGlobals());
async function begin() {
  const { claimReward } = await import('./rewarded');
  const grant = vi.fn();
  const result = claimReward('candidates', grant, 'skipped');
  await Promise.resolve();
  return { grant, result };
}
describe('candidate report rewarded placement', () => {
  it.each([
    ['ios', 'ca-app-pub-3797087216173591/3708867561'],
    ['android', 'ca-app-pub-3797087216173591/3204550669'],
  ])(
    'uses its separate %s unit and grants once after earning and closing',
    async (platform, unit) => {
      f.platform = platform;
      const { grant, result } = await begin();
      expect(f.create).toHaveBeenCalledWith(unit, { requestNonPersonalizedAdsOnly: true });
      f.listeners.get('loaded')();
      expect(show).toHaveBeenCalledOnce();
      f.listeners.get('earned')();
      expect(grant).not.toHaveBeenCalled();
      f.listeners.get('closed')();
      expect(await result).toBe('');
      expect(grant).toHaveBeenCalledOnce();
      expect(f.listeners.size).toBe(0);
    },
  );
  it.each(['closed', 'error'])('never grants on %s before reward', async (event) => {
    const { grant, result } = await begin();
    f.listeners.get(event)();
    expect(await result).toBe('skipped');
    expect(grant).not.toHaveBeenCalled();
  });
  it('does not request an ad when consent is unavailable', async () => {
    f.consent.mockResolvedValue(false);
    const { grant, result } = await begin();
    expect(await result).toBe('unavailable');
    expect(f.create).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
  });
  it('grants without an ad for an ad-free purchaser', async () => {
    f.owned = true;
    const { grant, result } = await begin();
    expect(await result).toBe('');
    expect(grant).toHaveBeenCalledOnce();
    expect(f.create).not.toHaveBeenCalled();
  });
  it('uses Google test ads in development', async () => {
    vi.stubGlobal('__DEV__', true);
    const { result } = await begin();
    expect(f.create.mock.calls[0][0]).toBe('test-rewarded');
    f.listeners.get('closed')();
    await result;
  });
});
