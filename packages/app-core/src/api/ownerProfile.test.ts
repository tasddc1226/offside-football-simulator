import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearApiCache, configureApi } from './client.js';
import { fetchOwnerTitles, fetchOwnerProfileByTeam, putOwnerTitle } from './ownerProfile.js';

afterEach(() => {
  clearApiCache();
  vi.unstubAllGlobals();
});
describe('owner title request memoization', () => {
  it('coalesces hall/profile reads and invalidates both after a selection', async () => {
    configureApi({ baseUrl: 'http://localhost:8787', auth: () => ({}) });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await Promise.all([fetchOwnerTitles(), fetchOwnerTitles()]);
    await fetchOwnerTitles();
    expect(fetch).toHaveBeenCalledTimes(1);
    await Promise.all([fetchOwnerProfileByTeam('team'), fetchOwnerProfileByTeam('team')]);
    expect(fetch).toHaveBeenCalledTimes(2);
    await putOwnerTitle('owner-developer');
    await fetchOwnerTitles();
    await fetchOwnerProfileByTeam('team');
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});
