/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({
  os: 'ios',
  available: true,
  stored: null,
  sessionChanged: null,
  retirement: null,
  player: { id: 'player-a', alias: 'Player' },
  authenticate: vi.fn(),
  getPlayer: vi.fn(),
  submit: vi.fn(),
  dashboard: vi.fn(),
  read: vi.fn(),
  invalidate: vi.fn(),
  save: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return f.os;
    },
  },
}));
vi.mock('expo', () => ({
  requireOptionalNativeModule: () =>
    f.available
      ? {
          authenticate: f.authenticate,
          getPlayer: f.getPlayer,
          submitProgress: f.submit,
          showDashboard: f.dashboard,
        }
      : null,
}));
vi.mock('valtio', () => ({ proxy: (x) => x }));
vi.mock('@offside/game/storage', () => ({ loadKey: () => f.stored, saveKey: f.save }));
vi.mock('@offside/app-core/api/client', () => ({
  cachedGet: f.read,
  invalidateApiCache: f.invalidate,
}));
vi.mock('@offside/app-core/outbox', () => ({
  onRetirementSynced: (fn) => {
    f.retirement = fn;
  },
}));
vi.mock('./session', () => ({
  ensureSession: async () => true,
  onSessionChanged: (fn) => {
    f.sessionChanged = fn;
  },
}));

const data = (extra = {}) => ({
  ok: true,
  data: {
    profileId: 'owner-a',
    legendScore: 250,
    achievements: ['first_retirement', 'first_ballon'],
    ...extra,
  },
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.os = 'ios';
  f.available = true;
  f.stored = null;
  f.player = { id: 'player-a', alias: 'Player' };
  f.authenticate.mockImplementation(async () => f.player);
  f.getPlayer.mockImplementation(async () => f.player);
  f.read.mockResolvedValue(data());
  f.submit.mockResolvedValue(true);
  f.dashboard.mockResolvedValue(true);
});

describe('Game Center consent and identity boundaries', () => {
  it('does nothing on Android or old runtimes without the module', async () => {
    f.os = 'android';
    let m = await import('./gameCenter.ts');
    expect(m.gameCenter.available).toBe(false);
    expect(await m.connectGameCenter()).toBe(false);
    vi.resetModules();
    f.os = 'ios';
    f.available = false;
    m = await import('./gameCenter.ts');
    expect(await m.connectGameCenter()).toBe(false);
    expect(f.authenticate).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
  });
  it('requires explicit connection; retirement never opens sign-in', async () => {
    const m = await import('./gameCenter.ts');
    f.retirement();
    expect(f.authenticate).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
    expect(await m.connectGameCenter()).toBe(true);
    expect(f.submit).toHaveBeenCalledWith(
      'player-a',
      'com.offsidelab.app.leaderboard.career_legend.v1',
      250,
      [
        'com.offsidelab.app.achievement.first_retirement',
        'com.offsidelab.app.achievement.first_ballon',
      ],
    );
    expect(await m.syncGameCenter()).toBe(true);
    expect(f.submit).toHaveBeenCalledOnce();
    expect(m.gameCenter.synced).toBe(true);
  });
  it('drops a response after the OFFSIDE session changes', async () => {
    const hold = deferred();
    f.read.mockReturnValueOnce(hold.promise);
    const m = await import('./gameCenter.ts');
    const connecting = m.connectGameCenter();
    await vi.waitFor(() => expect(f.read).toHaveBeenCalledOnce());
    f.sessionChanged();
    hold.resolve(data());
    expect(await connecting).toBe(false);
    expect(f.submit).not.toHaveBeenCalled();
    expect(m.gameCenter.connected).toBe(false);
  });
  it('does not submit progress to a Game Center player that changed during the request', async () => {
    f.getPlayer.mockResolvedValue({ id: 'player-b', alias: 'Other' });
    const m = await import('./gameCenter.ts');
    expect(await m.connectGameCenter()).toBe(false);
    expect(f.submit).not.toHaveBeenCalled();
    expect(m.gameCenter.error).toBe('changed');
  });
  it('keeps an upload failure retryable and still opens the dashboard', async () => {
    const m = await import('./gameCenter.ts');
    await m.connectGameCenter();
    f.read.mockResolvedValue(data({ legendScore: 300 }));
    f.submit.mockRejectedValue(new Error('offline'));
    expect(await m.openGameCenter('achievements')).toBe(true);
    expect(m.gameCenter.error).toBe('sync');
    expect(f.dashboard).toHaveBeenCalledWith(
      'player-a',
      'com.offsidelab.app.leaderboard.career_legend.v1',
      true,
    );
    f.submit.mockResolvedValue(true);
    expect(await m.syncGameCenter()).toBe(true);
    expect(m.gameCenter.error).toBe(null);
  });
  it('re-reads once when a retirement is accepted during an in-flight snapshot', async () => {
    const m = await import('./gameCenter.ts');
    await m.connectGameCenter();
    f.read.mockClear();
    const hold = deferred();
    f.read.mockReturnValueOnce(hold.promise).mockResolvedValue(data({ legendScore: 400 }));
    const syncing = m.syncGameCenter();
    await vi.waitFor(() => expect(f.read).toHaveBeenCalledOnce());
    f.retirement();
    hold.resolve(data({ legendScore: 300 }));
    await syncing;
    await vi.waitFor(() =>
      expect(f.submit).toHaveBeenLastCalledWith(
        'player-a',
        'com.offsidelab.app.leaderboard.career_legend.v1',
        400,
        expect.any(Array),
      ),
    );
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it('disconnects locally and rejects a pending submission without resetting Apple achievements', async () => {
    const m = await import('./gameCenter.ts');
    await m.connectGameCenter();
    const hold = deferred();
    f.read.mockReturnValueOnce(hold.promise);
    const syncing = m.syncGameCenter();
    await vi.waitFor(() => expect(f.read).toHaveBeenCalledTimes(2));
    m.disconnectGameCenter();
    hold.resolve(data({ legendScore: 500 }));
    await syncing;
    expect(f.submit).toHaveBeenCalledOnce();
    expect(m.gameCenter.connected).toBe(false);
    expect(f.save).toHaveBeenLastCalledWith('ft_game_center_connection', null);
  });
});
