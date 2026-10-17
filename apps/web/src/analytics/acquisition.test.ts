import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';
const api = vi.hoisted(() => ({ hint: false, getProfile: vi.fn() }));
vi.mock('@offside/app-core/api/client', () => ({
  cachedGet: async () => ({ ok: false }),
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
    vi.stubEnv('VITE_ACQUISITION_ENABLED', 'true');
    vi.stubGlobal('localStorage', store());
    vi.stubGlobal('sessionStorage', store());
    vi.stubGlobal('location', {
      href: 'https://offside.invalid/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a&fbclid=PRIVATE',
    });
    api.hint = false;
    api.getProfile.mockResolvedValue({ ok: true });
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
