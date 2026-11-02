import { beforeEach, expect, it, vi } from 'vitest';
const { open, byId, state } = vi.hoisted(() => ({
  open: vi.fn(),
  byId: vi.fn(),
  state: { sharedCareer: '', screen: 'home' },
}));
vi.mock('./legend.js', () => ({ openPublicLegend: open, openPublicLegendById: byId }));
vi.mock('./state.svelte.js', () => ({ appState: state }));
import { openPublicLegendById } from './openLegend.js';
import { routeSharedCareer } from './sharedCareerRoute.js';
beforeEach(() => {
  vi.clearAllMocks();
  state.screen = 'home';
  state.sharedCareer = '';
});
it('forwards IDs and async failures to the existing detail opener', async () => {
  byId.mockResolvedValueOnce(undefined);
  await openPublicLegendById('career');
  expect(byId).toHaveBeenCalledWith('career');
  byId.mockRejectedValueOnce(new Error('offline'));
  await expect(openPublicLegendById('career')).rejects.toThrow('offline');
});
it('routes shared links synchronously before rendering, preserving case normalization', () => {
  const uuid = 'ABCDEF00-1234-1234-1234-ABCDEF123456';
  vi.stubGlobal('window', { location: { pathname: '/career/' + uuid } });
  try {
    routeSharedCareer();
    expect(state).toMatchObject({ sharedCareer: uuid.toLowerCase(), screen: 'shared' });
  } finally {
    vi.unstubAllGlobals();
  }
});
