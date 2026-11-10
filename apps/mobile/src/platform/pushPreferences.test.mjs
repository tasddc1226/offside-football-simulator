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
const defaults = {
  match: true,
  cup: true,
  league: true,
  market: true,
  friend: true,
  reward: true,
  attendance: true,
  comeback: true,
  notice: true,
  release: true,
};
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
    expect(f.api).toHaveBeenLastCalledWith('/v1/push/preferences?v=2', {
      method: 'PUT',
      body: '{"market":false}',
    });
    f.api.mockResolvedValueOnce({ ok: false, error: { message: '저장 실패' } });
    await p.setPushPreference('market', true);
    expect(p.pushPreferencesState.values.market).toBe(false);
    expect(p.pushPreferencesState.error).toBe('저장 실패');
    expect(p.pushPreferencesState.saving).toBeNull();
  });
  it('asks for the topic shape and reads an old server shape as topics', async () => {
    const p = await import('./pushPreferences');
    f.api.mockResolvedValueOnce({
      ok: true,
      data: { notice: true, release: false, team: false, market: true, social: true, nudge: false },
    });
    await p.loadPushPreferences();
    expect(f.api).toHaveBeenCalledWith('/v1/push/preferences?v=2');
    expect(p.pushPreferencesState.values).toEqual({
      ...defaults,
      match: false,
      cup: false,
      league: false,
      attendance: false,
      comeback: false,
      release: false,
    });
    f.api.mockResolvedValueOnce({ ok: true, data: { ...defaults, cup: false } });
    await p.setPushPreference('cup', false);
    expect(p.pushPreferencesState.values.cup).toBe(false);
    expect(p.pushPreferencesState.values.match).toBe(true);
  });
  it('saves picked topics in one request and reports failure without throwing', async () => {
    const p = await import('./pushPreferences');
    const picked = { ...defaults, attendance: false, comeback: false };
    f.api.mockResolvedValueOnce({ ok: true, data: picked });
    expect(await p.savePushTopics(picked)).toBe(true);
    expect(f.api).toHaveBeenCalledExactlyOnceWith('/v1/push/preferences?v=2', {
      method: 'PUT',
      body: JSON.stringify(picked),
    });
    expect(p.pushPreferencesState.values.attendance).toBe(false);
    // 방금 저장한 값이 있으니 설정 화면을 열어도 다시 읽지 않는다.
    await p.loadPushPreferences();
    expect(f.api).toHaveBeenCalledOnce();
    f.api.mockResolvedValueOnce({ ok: false, error: { message: '저장 실패' } });
    expect(await p.savePushTopics(picked)).toBe(false);
    f.api.mockRejectedValueOnce(new Error('offline'));
    expect(await p.savePushTopics(picked)).toBe(false);
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
    finish({ ok: true, data: { ...defaults, cup: false } });
    await old;
    expect(p.pushPreferencesState.values.cup).toBe(true);
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
    const old = p.setPushPreference('friend', false);
    await p.setPushPreference('cup', false);
    expect(f.api).toHaveBeenCalledTimes(2);
    f.token = 'account-b';
    f.changed();
    await p.loadPushPreferences();
    finish({ ok: true, data: { ...defaults, friend: false } });
    await old;
    expect(p.pushPreferencesState.values.friend).toBe(true);
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
