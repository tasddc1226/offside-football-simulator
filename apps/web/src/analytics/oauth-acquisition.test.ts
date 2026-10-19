// Web OAuth acquisition regression; all identity and transport calls are local fixtures.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';
const api = vi.hoisted(() => ({ status: vi.fn(), getProfile: vi.fn() }));
vi.mock('@offside/app-core/api/client', () => ({
  cachedGet: (...a: unknown[]) => api.status(...a),
  invalidateApiCache: () => {},
  apiAuth: () => ({ credentials: 'include' }),
  apiBaseUrl: () => 'https://api.fixture.invalid',
  hasSessionHint: () => true,
  getProfile: api.getProfile,
}));
const source = './acquisition.js';
const query = '?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a';
function store() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, v),
    removeItem: (k: string) => m.delete(k),
  };
}
const tick = () => new Promise((r) => setTimeout(r, 15));
let bodies: Record<string, unknown>[];
let account: string;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('VITE_ACQUISITION_ENABLED', 'true');
  vi.stubGlobal('localStorage', store());
  vi.stubGlobal('sessionStorage', store());
  vi.stubGlobal('location', { href: 'https://offside.fixture.invalid/' + query });
  localStorage.setItem(CONSENT_KEY, 'granted');
  bodies = [];
  account = 'guest';
  api.getProfile.mockImplementation(async () => ({
    ok: true,
    data: { id: account, linked: { google: true, apple: false, toss: false } },
  }));
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: false, revision: null },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      bodies.push(b);
      return b.action === 'grant'
        ? Response.json({ profileId: account, granted: true })
        : new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function callback(id: string, granted: boolean) {
  account = id;
  vi.resetModules();
  vi.stubGlobal('location', { href: 'https://offside.fixture.invalid/settings?google=switched' });
  api.status.mockResolvedValue({ ok: true, data: { profileId: id, granted, revision: null } });
  return import(source);
}
it('reproduces lost campaign when acquisition choice is first made after OAuth', async () => {
  await import(source);
  expect(bodies).toHaveLength(0);
  const a = await callback('target', false);
  expect(await a.setAcquisitionConsent('granted')).toBe(true);
  await tick();
  expect(bodies.find((b) => b.action === 'session')).toMatchObject({
    profileId: 'target',
    campaign: '',
  });
});
it('same-profile login records a fresh consented visit, without replaying old events', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  const old = bodies.find((b) => b.action === 'session')!;
  expect(old.campaign).toBe(query);
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  a = await callback('guest', true);
  await a.acquisitionStatus();
  await tick();
  const last = bodies.filter((b) => b.action === 'session').at(-1)!;
  expect(last).toMatchObject({ profileId: 'guest', campaign: query, action: 'session' });
  expect(last.sessionId).not.toBe(old.sessionId);
});
it('existing-account switch requires target consent then records the preserved campaign on a new visit', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  const old = bodies.find((b) => b.action === 'session')!;
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  a = await callback('target', false);
  const n = bodies.length;
  expect(await a.acquisitionStatus()).toBe('unknown');
  await tick();
  expect(bodies.length).toBe(n);
  expect(await a.setAcquisitionConsent('granted')).toBe(true);
  await tick();
  const next = bodies.filter((b) => b.action === 'session').at(-1)!;
  expect(next).toMatchObject({ profileId: 'target', campaign: query, action: 'session' });
  expect(Object.keys(next).sort()).toEqual(
    ['action', 'campaign', 'profileId', 'sessionId', 'version'].sort(),
  );
  const saved = JSON.parse(sessionStorage.getItem('offside_acquisition_session_v1')!);
  expect(Math.abs(Date.now() - saved.at)).toBeLessThan(1000);
  expect(next.sessionId).not.toBe(old.sessionId);
  expect(old).toMatchObject({ profileId: 'guest', campaign: query });
});

it('restores only after server confirms the callback provider is linked', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  a = await callback('target', false);
  api.getProfile.mockResolvedValue({
    ok: true,
    data: { id: 'target', linked: { google: false, apple: true, toss: false } },
  });
  const n = bodies.length;
  await a.acquisitionStatus();
  await tick();
  expect(bodies.length).toBe(n);
  expect((await import('./oauth-campaign.js')).oauthEntryCampaign('')).toBe('');
});
it('a target account with its own prior server grant can record, without copying the source grant', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  const n = bodies.length;
  a = await callback('target', true);
  await a.acquisitionStatus();
  await tick();
  expect(bodies.slice(n).map((b) => b.action)).toEqual(['session']);
  expect(bodies.at(-1)).toMatchObject({ profileId: 'target', campaign: query });
});
it('withdrawal while callback identity is being checked cannot restore or transmit the campaign', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  a = await callback('target', false);
  let resolve!: (v: unknown) => void;
  api.getProfile.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const n = bodies.length;
  const status = a.acquisitionStatus();
  await a.setAcquisitionConsent('denied');
  resolve({
    ok: true,
    data: { id: 'target', linked: { google: true, apple: false, toss: false } },
  });
  expect(await status).toBe('denied');
  expect(bodies.slice(n).every((b) => b.action === 'revoke' && b.profileId === 'guest')).toBe(true);
  expect((await import('./oauth-campaign.js')).oauthEntryCampaign('')).toBe('');
});
it('another account replacing the verified callback target cannot inherit its campaign', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  a = await callback('target', true);
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'replacement', granted: true, revision: null },
  });
  await a.acquisitionStatus();
  await tick();
  expect(bodies.at(-1)).toMatchObject({ profileId: 'replacement', campaign: '' });
});
it('duplicate callback reload uses the existing new session, never creates a second restored touch', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  a = await callback('target', true);
  await a.acquisitionStatus();
  await tick();
  const id = bodies.at(-1)!.sessionId;
  const lookups = api.getProfile.mock.calls.length;
  a = await callback('target', true);
  await a.acquisitionStatus();
  await tick();
  expect(bodies.at(-1)!.sessionId).toBe(id);
  expect(api.getProfile.mock.calls.length).toBe(lookups);
});

it('withdrawal followed by re-consent cannot revive an identity check already in flight', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  a = await callback('target', false);
  let resolve!: (v: unknown) => void;
  api.getProfile.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const status = a.acquisitionStatus();
  await a.setAcquisitionConsent('denied');
  // Another tab has completed a new grant before the older identity lookup returns.
  localStorage.setItem('offside_acquisition_choice_v1', 'granted');
  resolve({
    ok: true,
    data: { id: 'target', linked: { google: true, apple: false, toss: false } },
  });
  expect(await status).toBe('denied');
  expect((await import('./oauth-campaign.js')).oauthEntryCampaign('')).toBe('');
  await a.setAcquisitionConsent('granted');
  await tick();
  expect(bodies.at(-1)).toMatchObject({ profileId: 'target', campaign: '' });
});

it('uses the queued storage event withdrawal even if storage already holds a later grant', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  let storageEvent!: (e: { key: string; newValue: string | null }) => void;
  vi.stubGlobal('window', {
    opener: null,
    addEventListener: (kind: string, fn: typeof storageEvent) => {
      if (kind === 'storage') storageEvent = fn;
    },
  });
  a = await callback('target', true);
  let resolve!: (v: unknown) => void;
  api.getProfile.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const status = a.acquisitionStatus();
  // Both events arrived before this tab was scheduled. Reading storage alone misses denial.
  storageEvent({ key: 'offside_acquisition_choice_v1', newValue: 'denied' });
  storageEvent({ key: 'offside_acquisition_choice_v1', newValue: 'granted' });
  resolve({
    ok: true,
    data: { id: 'target', linked: { google: true, apple: false, toss: false } },
  });
  expect(await status).toBe('denied');
  expect((await import('./oauth-campaign.js')).oauthEntryCampaign('')).toBe('');
});

it('App Store buttons use the verified continuation while the eager boot snapshot remains unchanged', async () => {
  let a = await import(source);
  await a.setAcquisitionConsent('granted');
  await tick();
  api.status.mockResolvedValue({
    ok: true,
    data: { profileId: 'guest', granted: true, revision: null },
  });
  await a.prepareAcquisitionOAuth('google', 'guest');
  a = await callback('target', false);
  await a.acquisitionStatus();
  await a.setAcquisitionConsent('granted');
  await tick();
  expect((await import('./entry-campaign.js')).entryCampaign).toBe('');
  vi.stubEnv('VITE_APPLE_PROVIDER_TOKEN', '123456');
  const { appStoreUrl } = await import('../ui/appStore.js');
  const url = new URL(appStoreUrl());
  expect(url.searchParams.get('pt')).toBe('123456');
  expect(url.searchParams.get('ct')).toBe('os1.b.3.4.e');
  await a.setAcquisitionConsent('denied');
  expect(new URL(appStoreUrl()).searchParams.has('ct')).toBe(false);
});
