import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';
import {
  clearOAuthCampaign,
  rememberOAuthCampaign,
  takeOAuthCampaign,
  OAUTH_CAMPAIGN_MS,
  withdrawOAuthCampaign,
} from './oauth-campaign.js';
const KEY = 'offside_acquisition_oauth_v1';
const campaign = '?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a';
const callback = 'https://offside.invalid/settings?google=switched';
function store() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, v),
    removeItem: (k: string) => m.delete(k),
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-18T07:00:00Z'));
  vi.stubGlobal('localStorage', store());
  vi.stubGlobal('sessionStorage', store());
  vi.stubGlobal('window', { opener: null });
  localStorage.setItem(CONSENT_KEY, 'granted');
  localStorage.setItem('offside_acquisition_choice_v1', 'granted');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('stores only allowlisted campaign, provider and time; consumes exactly once', () => {
  rememberOAuthCampaign('google', campaign, true);
  expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({
    provider: 'google',
    campaign,
    at: Date.now(),
  });
  expect(takeOAuthCampaign(callback)?.campaign).toBe(campaign);
  expect(takeOAuthCampaign(callback)).toBeNull();
  expect(sessionStorage.getItem(KEY)).toBeNull();
});
it.each(['analytics', 'account', 'withdrawal', 'server'] as const)(
  'does not store without both current choices and verified source consent: %s',
  (reason) => {
    if (reason === 'analytics') localStorage.setItem(CONSENT_KEY, 'denied');
    if (reason === 'account') localStorage.setItem('offside_acquisition_choice_v1', 'denied');
    if (reason === 'withdrawal') localStorage.setItem('offside_acquisition_revoke_v1', 'pending');
    rememberOAuthCampaign('google', campaign, reason !== 'server');
    expect(sessionStorage.getItem(KEY)).toBeNull();
  },
);
it.each([
  '?utm_source=evil&utm_campaign=global_test',
  campaign + '&fbclid=SECRET',
  campaign + '&email=private@example.com',
  '?utm_source=meta&utm_campaign=<script>',
])('rejects malformed or non-allowlisted context: %s', (value) => {
  rememberOAuthCampaign('google', value, true);
  expect(sessionStorage.getItem(KEY)).toBeNull();
});
it.each([
  '?google=error&reason=cancelled',
  '?google=error&reason=exchange',
  '?apple=linked',
  '?google=linked&apple=linked',
  '?google=unknown',
  '',
])('clears failed, mismatched and ambiguous callbacks: %s', (query) => {
  rememberOAuthCampaign('google', campaign, true);
  expect(takeOAuthCampaign('https://offside.invalid/settings' + query)).toBeNull();
  expect(sessionStorage.getItem(KEY)).toBeNull();
});
it('requires settings callback path and supports the matching Apple return', () => {
  rememberOAuthCampaign('google', campaign, true);
  expect(takeOAuthCampaign('https://offside.invalid/?google=linked')).toBeNull();
  rememberOAuthCampaign('apple', campaign, true);
  expect(takeOAuthCampaign('https://offside.invalid/settings/?apple=linked')?.provider).toBe(
    'apple',
  );
});
it.each([-1, OAUTH_CAMPAIGN_MS])(
  'rejects clock rollback or expired pending navigation: %s',
  (elapsed) => {
    rememberOAuthCampaign('google', campaign, true);
    vi.setSystemTime(Date.now() + elapsed);
    expect(takeOAuthCampaign(callback)).toBeNull();
  },
);
it('withdrawal between departure and return clears the pending navigation', () => {
  rememberOAuthCampaign('google', campaign, true);
  localStorage.setItem(CONSENT_KEY, 'denied');
  expect(takeOAuthCampaign(callback)).toBeNull();
  expect(sessionStorage.getItem(KEY)).toBeNull();
});
it('a fresh tab has no context; a copied opener tab cannot consume the original context', () => {
  expect(takeOAuthCampaign(callback)).toBeNull();
  rememberOAuthCampaign('google', campaign, true);
  const copy = sessionStorage.getItem(KEY)!;
  vi.stubGlobal('sessionStorage', store());
  expect(takeOAuthCampaign(callback)).toBeNull();
  sessionStorage.setItem(KEY, copy);
  vi.stubGlobal('window', { opener: {} });
  expect(takeOAuthCampaign(callback)).toBeNull();
});
it('clears malformed stored values and remains optional when storage is unavailable', () => {
  for (const bad of [
    'null',
    '{}',
    '{',
    JSON.stringify({ provider: 'google', campaign, at: Date.now(), email: 'SECRET' }),
  ]) {
    sessionStorage.setItem(KEY, bad);
    expect(takeOAuthCampaign(callback)).toBeNull();
  }
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw Error('blocked');
    },
    removeItem: () => {
      throw Error('blocked');
    },
    setItem: () => {
      throw Error('blocked');
    },
  });
  expect(() => rememberOAuthCampaign('google', campaign, true)).not.toThrow();
  expect(() => clearOAuthCampaign()).not.toThrow();
  expect(takeOAuthCampaign(callback)).toBeNull();
});

it('does not restore when its one-time storage entry cannot be removed', () => {
  rememberOAuthCampaign('google', campaign, true);
  const raw = sessionStorage.getItem(KEY);
  vi.stubGlobal('sessionStorage', {
    getItem: () => raw,
    removeItem: () => {
      throw Error('blocked');
    },
    setItem: () => {
      throw Error('blocked');
    },
  });
  expect(takeOAuthCampaign(callback)).toBeNull();
});

it('an ad-opened source tab can detach its opener at explicit consented login and return in that tab', () => {
  const tab = { opener: {} };
  vi.stubGlobal('window', tab);
  rememberOAuthCampaign('google', campaign, true);
  expect(tab.opener).toBeNull();
  expect(takeOAuthCampaign(callback)?.campaign).toBe(campaign);
});

it('keeps login optional when an opener cannot be detached; no continuation is stored', () => {
  const tab = {};
  Object.defineProperty(tab, 'opener', {
    get: () => ({}),
    set: () => {
      throw Error('blocked');
    },
  });
  vi.stubGlobal('window', tab);
  expect(() => rememberOAuthCampaign('google', campaign, true)).not.toThrow();
  expect(sessionStorage.getItem(KEY)).toBeNull();
});

it('remembers withdrawal while this tab is away, even after a later grant restores both choices', () => {
  rememberOAuthCampaign('google', campaign, true);
  const old = sessionStorage.getItem(KEY)!;
  vi.setSystemTime(Date.now() + 1000);
  // Another tab's UI withdraws while the original page is unloaded at the provider.
  withdrawOAuthCampaign();
  localStorage.setItem('offside_acquisition_choice_v1', 'denied');
  localStorage.setItem('offside_acquisition_choice_v1', 'granted');
  sessionStorage.setItem(KEY, old);
  expect(takeOAuthCampaign(callback)).toBeNull();
  vi.setSystemTime(Date.now() + 1);
  rememberOAuthCampaign('google', campaign, true);
  expect(takeOAuthCampaign(callback)?.campaign).toBe(campaign);
});
