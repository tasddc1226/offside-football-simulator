/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({
  values: new Map(),
  token: 'session-a',
  changed: undefined,
  api: vi.fn(),
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: async (_a, token) => `hash-${token}`,
}));
vi.mock('@offside/app-core/api/client', () => ({ apiFetch: f.api }));
vi.mock('./session', () => ({
  sessionToken: () => f.token,
  onSessionChanged: (fn) => {
    f.changed = fn;
  },
}));
vi.mock('./setup', () => ({
  kv: {
    getString: (key) => f.values.get(key),
    set: (key, value) => f.values.set(key, value),
    remove: (key) => f.values.delete(key),
  },
}));
beforeEach(() => {
  vi.resetModules();
  f.values.clear();
  f.token = 'session-a';
  f.api.mockReset().mockResolvedValue({ ok: true });
});
const rows = () => JSON.parse(f.values.get('offside_push_interactions') ?? '[]');
describe('push click operational buffer', () => {
  it('sends click before destination, keeps unrelated API caches, and persists no session token', async () => {
    const t = await import('./pushTracking.ts');
    await Promise.all([
      t.trackPushInteraction('ntf_own', 'click'),
      t.trackPushInteraction('ntf_own', 'target_open'),
    ]);
    expect(f.api.mock.calls.map(([, opts]) => JSON.parse(opts.body).event)).toEqual([
      'click',
      'target_open',
    ]);
    expect(f.api.mock.calls.every(([, opts]) => opts.keepCache)).toBe(true);
    expect(rows()).toEqual([]);
  });
  it('keeps an offline click once and retries on the next foreground flush', async () => {
    f.api.mockResolvedValue({ ok: false, error: { retryable: true } });
    const t = await import('./pushTracking.ts');
    await t.trackPushInteraction('ntf_offline', 'click');
    await t.trackPushInteraction('ntf_offline', 'click');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).not.toHaveProperty('token');
    f.api.mockResolvedValue({ ok: true });
    await t.flushPushInteractions();
    expect(rows()).toEqual([]);
  });
  it('drops expired entries and another account buffer across relaunch', async () => {
    f.values.set(
      'offside_push_interactions',
      JSON.stringify([
        {
          id: 'ntf_old',
          event: 'click',
          occurredAt: new Date(Date.now() - 86400_001).toISOString(),
          sessionHash: 'hash-session-a',
        },
        {
          id: 'ntf_foreign',
          event: 'click',
          occurredAt: new Date().toISOString(),
          sessionHash: 'hash-session-b',
        },
      ]),
    );
    const t = await import('./pushTracking.ts');
    await t.flushPushInteractions();
    expect(f.api).not.toHaveBeenCalled();
    expect(rows()).toEqual([]);
  });
  it('account change during an outstanding send clears only old events and prevents a stale removal', async () => {
    let finish;
    f.api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const t = await import('./pushTracking.ts');
    const old = t.trackPushInteraction('ntf_old', 'click');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    f.token = 'session-b';
    f.changed();
    const fresh = t.trackPushInteraction('ntf_new', 'click');
    finish({ ok: true });
    await Promise.all([old, fresh]);
    await t.flushPushInteractions();
    expect(f.api.mock.calls.filter(([path]) => path.includes('ntf_new'))).toHaveLength(1);
    expect(rows()).toEqual([]);
  });
  it('drops invalid IDs, no-session events and permanent failures without blocking navigation', async () => {
    const t = await import('./pushTracking.ts');
    await t.trackPushInteraction('https://foreign', 'click');
    f.token = null;
    await t.trackPushInteraction('ntf_own', 'click');
    expect(f.api).not.toHaveBeenCalled();
    f.token = 'session-a';
    f.api.mockResolvedValue({ ok: false, error: { retryable: false } });
    await t.trackPushInteraction('ntf_own', 'click');
    expect(rows()).toEqual([]);
  });
});
