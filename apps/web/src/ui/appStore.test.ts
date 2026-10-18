import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IOS_APP_STORE_URL } from '@offside/app-core/links';
import { appTarget } from './inapp.js';

vi.mock('../analytics/index.js', () => ({ trackAppStoreClick: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_APPLE_PROVIDER_TOKEN', '123456');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('entry campaign survives lazy store UI loading', () => {
  it('keeps only the original allowlisted campaign after SPA navigation', async () => {
    vi.stubGlobal('location', {
      href: 'https://offside.invalid/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a&fbclid=PRIVATE&email=PRIVATE#PRIVATE',
    });
    const entry = await import('../analytics/entry-campaign.js');
    expect(entry.entryCampaign).toBe(
      '?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a',
    );
    expect(entry.entryCampaign).not.toContain('PRIVATE');
    vi.stubGlobal('location', {
      href: 'https://offside.invalid/?utm_source=threads&utm_campaign=launch',
    });
    const store = await import('./appStore.js');
    expect(store.appStoreUrl()).toBe(`${IOS_APP_STORE_URL}?pt=123456&ct=os1.b.3.4.e&mt=8`);
    expect(store.appStoreUrl()).not.toContain('PRIVATE');
  });

  it('does not acquire a campaign added only after boot', async () => {
    vi.stubGlobal('location', { href: 'https://offside.invalid/' });
    await import('../analytics/entry-campaign.js');
    vi.stubGlobal('location', {
      href: 'https://offside.invalid/?utm_source=meta&utm_campaign=global_test',
    });
    expect((await import('./appStore.js')).appStoreUrl()).toBe(IOS_APP_STORE_URL);
  });

  it('preserves OS routing without loading the store implementation', () => {
    expect(appTarget('iPhone Safari')).toBe('ios');
    expect(appTarget('Android Chrome')).toBe('android');
    expect(appTarget('Desktop Chrome')).toBe('both');
  });
});
