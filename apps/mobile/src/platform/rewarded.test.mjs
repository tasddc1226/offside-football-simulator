/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({
  platform: 'ios',
  owned: false,
  start: vi.fn(),
  load: vi.fn(),
  show: vi.fn(),
  units: {},
  listeners: new Map(),
}));
vi.mock('react-native-applovin-max', () => {
  const RewardedAd = { loadAd: f.load, showAd: f.show };
  for (const name of ['Loaded', 'Displayed', 'Hidden', 'LoadFailed', 'FailedToDisplay']) {
    RewardedAd[`addAd${name}EventListener`] = (fn) => f.listeners.set(name, fn);
    RewardedAd[`removeAd${name}EventListener`] = () => f.listeners.delete(name);
  }
  RewardedAd.addAdReceivedRewardEventListener = (fn) => f.listeners.set('Reward', fn);
  RewardedAd.removeAdReceivedRewardEventListener = () => f.listeners.delete('Reward');
  return { RewardedAd };
});
vi.mock('./ads', () => ({
  startAds: f.start,
  unitOf: (p) => f.units[p]?.[f.platform],
}));
vi.mock('./adFree', () => ({
  adFree: {
    get owned() {
      return f.owned;
    },
  },
}));
vi.mock('@offside/app-core/i18n/ko/ad', () => ({
  adText: { rewardedUnavailable: 'unavailable' },
}));
const UNITS = {
  candidates: { ios: 'max-candidates-ios', android: 'max-candidates-android' },
  peek: { ios: 'max-peek-ios', android: 'max-peek-android' },
  boost: { ios: 'max-boost-ios', android: 'max-boost-android' },
};
let unit;
/** 지금 재생 중인 단위(또는 지정한 단위)의 MAX 이벤트를 보낸다. */
const fire = (name, adUnitId = unit) => f.listeners.get(name)?.({ adUnitId });
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.listeners.clear();
  f.platform = 'ios';
  f.owned = false;
  f.units = UNITS;
  f.start.mockResolvedValue(true);
});
async function begin(placement = 'candidates') {
  unit = UNITS[placement][f.platform];
  const { claimReward } = await import('./rewarded');
  const grant = vi.fn();
  const result = claimReward(placement, grant, 'skipped');
  await Promise.resolve();
  await Promise.resolve();
  return { grant, result };
}
describe('candidate report rewarded placement', () => {
  it.each(['ios', 'android'])(
    'uses its separate %s unit and grants once after earning and closing',
    async (platform) => {
      f.platform = platform;
      const { grant, result } = await begin();
      expect(f.load).toHaveBeenCalledWith(`max-candidates-${platform}`);
      fire('Loaded');
      expect(f.show).toHaveBeenCalledWith(`max-candidates-${platform}`);
      fire('Displayed');
      fire('Reward');
      expect(grant).not.toHaveBeenCalled();
      fire('Hidden');
      expect(await result).toBe('');
      expect(grant).toHaveBeenCalledOnce();
      expect(f.listeners.size).toBe(0);
    },
  );
  it('ignores events from another ad unit', async () => {
    const { grant, result } = await begin();
    fire('Loaded', 'other');
    fire('Hidden', 'other');
    expect(f.show).not.toHaveBeenCalled();
    expect(f.listeners.size).toBe(6);
    fire('LoadFailed');
    expect(await result).toBe('unavailable');
    expect(grant).not.toHaveBeenCalled();
  });
  it('tells the viewer they skipped when the ad opened but closed before reward', async () => {
    const { grant, result } = await begin();
    fire('Loaded');
    fire('Displayed');
    fire('Hidden');
    expect(await result).toBe('skipped');
    expect(grant).not.toHaveBeenCalled();
  });
  it.each(['LoadFailed', 'FailedToDisplay'])('reports unavailable on %s', async (event) => {
    const { grant, result } = await begin();
    fire(event);
    expect(await result).toBe('unavailable');
    expect(grant).not.toHaveBeenCalled();
  });
  it('does not request an ad when the SDK did not start', async () => {
    f.start.mockResolvedValue(false);
    const { grant, result } = await begin();
    expect(await result).toBe('unavailable');
    expect(f.load).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
  });
  it('has no ad button without a unit', async () => {
    f.units = {};
    const { rewardOffer } = await import('./rewarded');
    expect(rewardOffer('candidates', false)).toBe(null);
    expect(rewardOffer('candidates', true)).toBe('free');
    const { result } = await begin();
    expect(await result).toBe('unavailable');
    expect(f.start).not.toHaveBeenCalled();
  });
  it('grants without an ad for an ad-free purchaser', async () => {
    f.owned = true;
    const { grant, result } = await begin();
    expect(await result).toBe('');
    expect(grant).toHaveBeenCalledOnce();
    expect(f.load).not.toHaveBeenCalled();
  });
});
describe('boost', () => {
  it('has no daily limit', async () => {
    for (let i = 0; i < 25; i++) {
      const { grant, result } = await begin('boost');
      fire('Loaded');
      fire('Displayed');
      fire('Reward');
      fire('Hidden');
      expect(await result).toBe('');
      expect(grant).toHaveBeenCalledOnce();
    }
  });
});
