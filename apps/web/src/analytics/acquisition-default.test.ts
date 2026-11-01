import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';

// T-11-597 유럽 · 영국 · 스위스 밖에서는 한 번도 고른 적 없는 프로필의 유입 연결을 묻지 않고 켠다.
const api = vi.hoisted(() => ({ getProfile: vi.fn(), status: vi.fn(), byDefault: true }));
vi.mock('@offside/app-core/api/client', () => ({
  cachedGet: (...args: unknown[]) => api.status(...args),
  invalidateApiCache: () => {},
  apiAuth: () => ({ credentials: 'include' }),
  apiBaseUrl: () => 'https://api.offside.invalid',
  hasSessionHint: () => true,
  getProfile: api.getProfile,
}));
vi.mock('../consent-region.js', () => ({ consentByDefault: () => api.byDefault }));
const store = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
  };
};

describe('T-11-597 유입 연결 기본 켜기', () => {
  let actions: string[];
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_ACQUISITION_ENABLED', 'true');
    vi.stubGlobal('localStorage', store());
    vi.stubGlobal('sessionStorage', store());
    vi.stubGlobal('location', { href: 'https://offside.invalid/?utm_source=meta&utm_medium=paid' });
    localStorage.setItem(CONSENT_KEY, 'granted');
    api.byDefault = true;
    api.getProfile.mockResolvedValue({ ok: true, data: { id: 'profile-a' } });
    actions = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { action: string };
        actions.push(body.action);
        return body.action === 'grant'
          ? Response.json({ profileId: 'profile-a', granted: true, revision: crypto.randomUUID() })
          : new Response(null, { status: 204 });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  const status = (data: { granted: boolean; revision: string | null }) =>
    api.status.mockResolvedValue({ ok: true, data: { profileId: 'profile-a', ...data } });

  it('서버 기록이 없는 프로필은 묻지 않고 켠다', async () => {
    status({ granted: false, revision: null });
    const a = await import('./acquisition.js');
    expect(await a.acquisitionStatus()).toBe('granted');
    expect(actions).toContain('grant');
  });
  it('철회 표식이 있거나 이 브라우저에서 거절했으면 켜지 않는다', async () => {
    status({ granted: false, revision: crypto.randomUUID() });
    let a = await import('./acquisition.js');
    expect(await a.acquisitionStatus()).not.toBe('granted');
    status({ granted: false, revision: null });
    vi.resetModules();
    localStorage.setItem('offside_acquisition_choice_v1', 'denied');
    a = await import('./acquisition.js');
    expect(await a.acquisitionStatus()).toBe('denied');
    expect(actions).not.toContain('grant');
  });
  it('먼저 묻는 지역이나 이용 분석을 끈 브라우저는 그대로 묻는다', async () => {
    status({ granted: false, revision: null });
    api.byDefault = false;
    let a = await import('./acquisition.js');
    expect(await a.acquisitionStatus()).toBe('unknown');
    api.byDefault = true;
    vi.resetModules();
    localStorage.setItem(CONSENT_KEY, 'denied');
    a = await import('./acquisition.js');
    expect(await a.acquisitionStatus()).toBe('denied');
    expect(actions).not.toContain('grant');
  });
});
