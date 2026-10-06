/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({
  platform: 'ios',
  values: new Map(),
  history: null,
  permission: { granted: false, status: 'undetermined' },
  native: true,
  permissions: vi.fn(),
  available: vi.fn(),
  request: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock('expo-notifications', () => ({ getPermissionsAsync: f.permissions }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return f.platform;
    },
  },
  Linking: { openURL: f.open },
}));
vi.mock('valtio', () => ({ proxy: (state) => state }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.2' } } }));
vi.mock('expo', () => ({ requireOptionalNativeModule: () => (f.native ? {} : null) }));
vi.mock('expo-store-review', () => ({ isAvailableAsync: f.available, requestReview: f.request }));
vi.mock('@offside/game/storage', () => ({ loadKey: () => f.history, saveKey: f.save }));
vi.mock('./setup', () => ({
  kv: {
    getBoolean: (key) => f.values.get(key),
    getNumber: (key) => f.values.get(key),
    set: (key, value) => f.values.set(key, value),
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.platform = 'ios';
  f.values.clear();
  f.history = null;
  f.native = true;
  f.permission = { granted: false, status: 'undetermined' };
  f.permissions.mockImplementation(async () => f.permission);
  f.available.mockResolvedValue(true);
  f.request.mockResolvedValue(undefined);
  f.open.mockResolvedValue(undefined);
  f.save.mockImplementation((_key, history) => {
    f.history = history;
    return true;
  });
});

describe('native push consent offer', () => {
  it('reads permission once without requesting OS permission or registering a token', async () => {
    const p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    await p.checkPushOffer();
    expect(p.pushOffer.eligible).toBe(true);
    expect(f.permissions).toHaveBeenCalledOnce();
  });
  it('does not resurface after dismissal and reopening the app', async () => {
    let p = await import('./pushOffer.ts');
    p.dismissPushOffer();
    vi.resetModules();
    p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    expect(p.pushOffer.handled).toBe(true);
    expect(f.permissions).not.toHaveBeenCalled();
  });
  it('keeps later hidden across restart, then offers again after seven days', async () => {
    let now = 1_800_000_000_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      let p = await import('./pushOffer.ts');
      await p.checkPushOffer();
      p.snoozePushOffer();
      expect(p.pushOffer.handled).toBe(false);
      expect(p.pushOffer.eligible).toBe(false);
      const until = now + p.PUSH_OFFER_SNOOZE_MS;
      vi.resetModules();
      p = await import('./pushOffer.ts');
      now = until - 1;
      await p.checkPushOffer();
      expect(p.pushOffer.eligible).toBe(false);
      expect(f.permissions).toHaveBeenCalledOnce();
      now = until;
      await p.checkPushOffer();
      expect(p.pushOffer.eligible).toBe(true);
      expect(f.permissions).toHaveBeenCalledTimes(2);
      await p.checkPushOffer();
      expect(f.permissions).toHaveBeenCalledTimes(2);
    } finally {
      clock.mockRestore();
    }
  });
  it('checks blocked permission again when a snooze expires without restarting', async () => {
    let now = 1_800_000_000_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const p = await import('./pushOffer.ts');
      await p.checkPushOffer();
      p.snoozePushOffer();
      f.permission = { granted: false, status: 'denied', canAskAgain: false };
      now += p.PUSH_OFFER_SNOOZE_MS;
      await p.checkPushOffer();
      expect(p.pushOffer.eligible).toBe(false);
      expect(f.permissions).toHaveBeenCalledTimes(2);
    } finally {
      clock.mockRestore();
    }
  });
  it('preserves explicit and legacy permanent dismissal even after a snooze expires', async () => {
    const p = await import('./pushOffer.ts');
    p.snoozePushOffer();
    p.dismissPushOffer();
    f.values.set('offside_push_offer_snoozed_until', 0);
    vi.resetModules();
    const reopened = await import('./pushOffer.ts');
    await reopened.checkPushOffer();
    expect(reopened.pushOffer.handled).toBe(true);
    expect(f.permissions).not.toHaveBeenCalled();
  });
  it('does not re-prompt an OS denial, unsupported platform or permission error', async () => {
    f.permission = { granted: false, status: 'denied' };
    let p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    expect(p.pushOffer.eligible).toBe(false);
    vi.resetModules();
    f.platform = 'web';
    p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    expect(p.pushOffer.eligible).toBe(false);
    vi.resetModules();
    f.platform = 'android';
    f.permissions.mockRejectedValue(new Error('Native error'));
    p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    expect(p.pushOffer.eligible).toBe(false);
  });
  it('offers app consent when OS permission was previously granted but app opt-in is absent', async () => {
    f.platform = 'android';
    f.permission = { granted: true, status: 'granted' };
    const p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    expect(p.pushOffer.eligible).toBe(true);
  });
  it('offers on fresh Android when notifications are disabled but OS permission can still be requested', async () => {
    f.platform = 'android';
    f.permission = { granted: false, status: 'denied', canAskAgain: true };
    const p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    expect(p.pushOffer.eligible).toBe(true);
    p.dismissPushOffer();
    vi.resetModules();
    const reopened = await import('./pushOffer.ts');
    await reopened.checkPushOffer();
    expect(reopened.pushOffer.handled).toBe(true);
    expect(f.permissions).toHaveBeenCalledOnce();
  });
  it.each(['ios', 'android'])('hides a blocked OS permission on %s', async (platform) => {
    f.platform = platform;
    f.permission = { granted: false, status: 'denied', canAskAgain: false };
    const p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    expect(p.pushOffer.eligible).toBe(false);
  });
  it('does not treat an iOS denial as a fresh Android permission', async () => {
    f.permission = { granted: false, status: 'denied', canAskAgain: true };
    const p = await import('./pushOffer.ts');
    await p.checkPushOffer();
    expect(p.pushOffer.eligible).toBe(false);
  });
});

describe('native store review adapter', () => {
  it.each(['ios', 'android'])(
    'uses the native review flow on %s after a career',
    async (platform) => {
      f.platform = platform;
      const r = await import('./review.ts');
      expect(await r.reviewPrompt.afterCareer('career-1', () => true)).toBe(true);
      expect(f.request).toHaveBeenCalledOnce();
      expect(f.open).not.toHaveBeenCalled();
    },
  );
  it('skips automatic review on an old binary with no module', async () => {
    f.native = false;
    const r = await import('./review.ts');
    expect(await r.reviewPrompt.afterCareer('career-1', () => true)).toBe(false);
    expect(f.request).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });
  it.each(['ios', 'android'])(
    'opens the correct %s store directly for an explicit settings action',
    async (platform) => {
      f.platform = platform;
      const r = await import('./review.ts');
      await r.openReviewStore();
      expect(f.open).toHaveBeenCalledWith(
        platform === 'ios'
          ? 'https://apps.apple.com/kr/app/id6817463687?action=write-review'
          : 'https://play.google.com/store/apps/details?id=com.offsidelab.app&showAllReviews=true',
      );
      expect(f.request).not.toHaveBeenCalled();
      expect(await r.reviewPrompt.afterCareer('career-1', () => true)).toBe(false);
    },
  );
  it('leaves the automatic review cooldown untouched if the explicit store link fails', async () => {
    f.open.mockRejectedValue(new Error('No store'));
    const r = await import('./review.ts');
    await expect(r.openReviewStore()).rejects.toThrow('No store');
    expect(f.save).not.toHaveBeenCalled();
  });
  it('does not report an opened store page as a link failure if local history storage is full', async () => {
    f.save.mockReturnValue(false);
    const r = await import('./review.ts');
    await expect(r.openReviewStore()).resolves.toBeUndefined();
    expect(await r.reviewPrompt.afterCareer('career-1', () => true)).toBe(false);
    expect(f.request).not.toHaveBeenCalled();
  });
});
