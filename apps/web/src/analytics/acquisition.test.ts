import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';
const api = vi.hoisted(() => ({ hint: false, getProfile: vi.fn(), status: vi.fn() }));
vi.mock('@offside/app-core/api/client', () => ({
  cachedGet: (...args: unknown[]) => api.status(...args),
  invalidateApiCache: () => {},
  apiAuth: () => ({ credentials: 'include' }),
  apiBaseUrl: () => 'https://api.offside.invalid',
  hasSessionHint: () => api.hint,
  getProfile: api.getProfile,
}));
const store = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
  };
};
const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
};
describe('first-party consent and delivery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_ACQUISITION_ENABLED', 'true');
    vi.stubGlobal('localStorage', store());
    vi.stubGlobal('sessionStorage', store());
    vi.stubGlobal('location', {
      href: 'https://offside.invalid/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a&fbclid=PRIVATE',
    });
    api.hint = false;
    api.getProfile.mockResolvedValue({ ok: true, data: { id: 'profile-a' } });
    api.status.mockResolvedValue({
      ok: true,
      data: { profileId: 'profile-a', granted: false, revision: null },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it('sends nothing before consent or for an anonymous visit with no session hint', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const a = await import('./acquisition.js');
    a.recordAcquisition('start');
    await a.acquisitionStatus();
    expect(fetcher).not.toHaveBeenCalled();
    localStorage.setItem(CONSENT_KEY, 'granted');
    await a.acquisitionStatus();
    expect(fetcher).not.toHaveBeenCalled();
    expect(api.getProfile).not.toHaveBeenCalled();
  });
  it('retries a failed session using its same id and stops immediately on withdrawal', async () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    const bodies: Record<string, unknown>[] = [];
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        bodies.push(body);
        if (body.action === 'grant')
          return Response.json({ profileId: 'profile-a', granted: true });
        if (body.action === 'session' && fail) {
          fail = false;
          throw new Error('offline');
        }
        return new Response(null, { status: 204 });
      }),
    );
    const a = await import('./acquisition.js');
    expect(await a.setAcquisitionConsent('granted')).toBe(true);
    await tick();
    a.recordAcquisition('start');
    await tick();
    const sessions = bodies.filter((b) => b.sessionId);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.sessionId).toBe(sessions[1]!.sessionId);
    expect(JSON.stringify(bodies)).not.toContain('PRIVATE');
    await a.setAcquisitionConsent('denied');
    const n = bodies.length;
    a.recordAcquisition('start');
    await tick();
    expect(bodies).toHaveLength(n);
    expect(a.acquisitionGranted()).toBe(false);
  });

  it('persists withdrawal before a fresh offline lookup and retries the known original account after reload', async () => {
    api.hint = true;
    localStorage.setItem('offside_acquisition_profile_v1', 'profile-a');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    let a = await import('./acquisition.js');
    expect(await a.setAcquisitionConsent('denied')).toBe(false);
    expect(localStorage.getItem('offside_acquisition_revoke_v1')).toBe('profile-a');
    vi.resetModules();
    const f = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', f);
    a = await import('./acquisition.js');
    expect(await a.acquisitionStatus()).toBe('denied');
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toMatchObject({
      action: 'revoke',
      profileId: 'profile-a',
    });
    expect(localStorage.getItem('offside_acquisition_revoke_v1')).toBeNull();
  });
  it('retains an unknown offline withdrawal without deleting a subsequently switched account', async () => {
    api.hint = true;
    api.status.mockResolvedValue({ ok: false, error: { code: 'NETWORK_ERROR' } });
    let a = await import('./acquisition.js');
    expect(await a.setAcquisitionConsent('denied')).toBe(false);
    expect(localStorage.getItem('offside_acquisition_revoke_v1')).toBe('unresolved');
    vi.resetModules();
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    api.status.mockResolvedValue({ ok: true, data: { profileId: 'profile-b', granted: true } });
    a = await import('./acquisition.js');
    expect(await a.acquisitionStatus()).toBe('denied');
    expect(f).not.toHaveBeenCalled();
    expect(localStorage.getItem('offside_acquisition_revoke_v1')).toBe('unresolved');
  });
  it('explicit withdrawal checks an existing httpOnly account even after its local session hint was cleared', async () => {
    api.hint = false;
    api.status.mockResolvedValue({ ok: true, data: { profileId: 'profile-a', granted: true } });
    const f = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', f);
    const a = await import('./acquisition.js');
    expect(await a.setAcquisitionConsent('denied')).toBe(true);
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toMatchObject({
      action: 'revoke',
      profileId: 'profile-a',
    });
    expect(api.getProfile).not.toHaveBeenCalled();
  });
  it('explicit withdrawal with no server session confirms denial without creating a profile', async () => {
    api.status.mockResolvedValue({ ok: false, error: { code: 'PROFILE_REQUIRED' } });
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const a = await import('./acquisition.js');
    expect(await a.setAcquisitionConsent('denied')).toBe(true);
    expect(localStorage.getItem('offside_acquisition_revoke_v1')).toBeNull();
    expect(api.getProfile).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
  });
  it('cannot resurrect server consent when profile lookup finishes after withdrawal', async () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    let finishProfile!: (value: unknown) => void;
    api.getProfile.mockReturnValue(
      new Promise((resolve) => {
        finishProfile = resolve;
      }),
    );
    api.status.mockResolvedValue({ ok: true, data: { profileId: 'profile-a', granted: false } });
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }),
    );
    const a = await import('./acquisition.js');
    const oldGrant = a.setAcquisitionConsent('granted');
    expect(await a.setAcquisitionConsent('denied')).toBe(true);
    finishProfile({ ok: true, data: { id: 'profile-a' } });
    expect(await oldGrant).toBe(false);
    expect(bodies.map((b) => b.action)).toEqual(['revoke']);
    expect(a.acquisitionGranted()).toBe(false);
  });
  it('drops a queued grant after withdrawal while an older event is in flight', async () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    let finishSession!: (value: Response) => void;
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        if (body.action === 'grant')
          return Response.json({ profileId: 'profile-a', granted: true });
        if (body.action === 'session')
          return new Promise<Response>((resolve) => {
            finishSession = resolve;
          });
        return new Response(null, { status: 204 });
      }),
    );
    const a = await import('./acquisition.js');
    expect(await a.setAcquisitionConsent('granted')).toBe(true);
    await tick();
    const queuedGrant = a.setAcquisitionConsent('granted');
    await tick();
    const withdrawal = a.setAcquisitionConsent('denied');
    finishSession(new Response(null, { status: 204 }));
    expect(await queuedGrant).toBe(false);
    expect(await withdrawal).toBe(true);
    expect(bodies.map((b) => b.action)).toEqual(['grant', 'session', 'revoke']);
  });
  it('replays an offline withdrawal even while analytics remains denied', async () => {
    localStorage.setItem(CONSENT_KEY, 'denied');
    localStorage.setItem('offside_acquisition_revoke_v1', 'profile-a');
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', f);
    const a = await import('./acquisition.js');
    await a.acquisitionStatus();
    expect(f).toHaveBeenCalledOnce();
    expect(localStorage.getItem('offside_acquisition_revoke_v1')).toBeNull();
  });
});
