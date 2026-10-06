/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({ api: vi.fn(), changed: undefined, token: 'account-a' }));
vi.mock('valtio', () => ({ proxy: (state) => state }));
vi.mock('@offside/app-core/api/client', () => ({ apiFetch: f.api }));
vi.mock('./session', () => ({
  ensureSession: async () => true,
  sessionToken: () => f.token,
  onSessionChanged: (cb) => {
    f.changed = cb;
  },
}));
const defaults = { notice: true, release: true, team: true, market: true, social: true };
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.token = 'account-a';
  f.api.mockResolvedValue({ ok: true, data: defaults });
});
describe('account feature push preferences', () => {
  it('loads only once per account, including simultaneous screen entries', async () => {
    const p = await import('./pushPreferences');
    await Promise.all([p.loadPushPreferences(), p.loadPushPreferences()]);
    await p.loadPushPreferences();
    expect(f.api).toHaveBeenCalledTimes(1);
    f.token = 'account-b';
    f.changed();
    await p.loadPushPreferences();
    expect(f.api).toHaveBeenCalledTimes(2);
  });
  it('saves a partial preference without registering a device and restores the value on failure', async () => {
    const p = await import('./pushPreferences');
    await p.loadPushPreferences();
    f.api.mockResolvedValueOnce({ ok: true, data: { ...defaults, market: false } });
    await p.setPushPreference('market', false);
    expect(p.pushPreferencesState.values.market).toBe(false);
    expect(f.api).toHaveBeenLastCalledWith('/v1/push/preferences', {
      method: 'PUT',
      body: '{"market":false}',
    });
    f.api.mockResolvedValueOnce({ ok: false, error: { message: '저장 실패' } });
    await p.setPushPreference('market', true);
    expect(p.pushPreferencesState.values.market).toBe(false);
    expect(p.pushPreferencesState.error).toBe('저장 실패');
    expect(p.pushPreferencesState.saving).toBeNull();
  });
  it('discards an old account load response after account switching', async () => {
    const p = await import('./pushPreferences');
    let finish;
    f.api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const old = p.loadPushPreferences();
    await Promise.resolve();
    f.token = 'account-b';
    f.changed();
    await p.loadPushPreferences();
    finish({ ok: true, data: { ...defaults, team: false } });
    await old;
    expect(p.pushPreferencesState.values.team).toBe(true);
    expect(p.pushPreferencesState.loaded).toBe(true);
  });
  it('blocks repeated saves while pending and discards the previous account save response', async () => {
    const p = await import('./pushPreferences');
    await p.loadPushPreferences();
    let finish;
    f.api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const old = p.setPushPreference('social', false);
    await p.setPushPreference('team', false);
    expect(f.api).toHaveBeenCalledTimes(2);
    f.token = 'account-b';
    f.changed();
    await p.loadPushPreferences();
    finish({ ok: true, data: { ...defaults, social: false } });
    await old;
    expect(p.pushPreferencesState.values.social).toBe(true);
    expect(p.pushPreferencesState.saving).toBeNull();
  });
  it('allows retry after a failed initial load', async () => {
    const p = await import('./pushPreferences');
    f.api.mockResolvedValueOnce({ ok: false, error: { message: '연결 실패' } });
    await p.loadPushPreferences();
    expect(p.pushPreferencesState.loaded).toBe(false);
    await p.loadPushPreferences();
    expect(p.pushPreferencesState.loaded).toBe(true);
    expect(p.pushPreferencesState.error).toBe('');
  });
});
