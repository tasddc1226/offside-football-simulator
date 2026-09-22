import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { careerQueryOptions } from './use-career.js';

const mocks = vi.hoisted(() => ({ load: vi.fn(), cache: vi.fn(), ensure: vi.fn() }));
vi.mock('./engine.js', () => ({
  getAppEngine: async () => ({
    client: { loadCareer: mocks.load },
    store: {
      transaction: async (_mode: unknown, fn: (tx: unknown) => unknown) =>
        fn({ kv: { get: async () => 'current-owner' } }),
    },
  }),
}));
vi.mock('./annual.js', () => ({ cacheAnnualCareer: (...args: unknown[]) => mocks.cache(...args) }));
vi.mock('../api/profile.js', () => ({
  ensureProfile: (...args: unknown[]) => mocks.ensure(...args),
}));
const saved = {
  ok: true,
  career: {
    id: 'owned-server',
    authority: 'SERVER_ANNUAL',
    ownerProfileId: 'current-owner',
    revision: 9,
  },
  snapshot: { state: { status: 'ACTIVE' } },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ensure.mockResolvedValue(true);
  mocks.cache.mockResolvedValue({});
});
describe('independent annual deep-link cache recovery', () => {
  it('recovers a missing local career by owned canonical GET before resolving the route query', async () => {
    mocks.load
      .mockResolvedValueOnce({ ok: false, error: { code: 'CAREER_NOT_FOUND' } })
      .mockResolvedValue(saved);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(client.fetchQuery(careerQueryOptions('owned-server'))).resolves.toEqual({
      record: saved.career,
      state: saved.snapshot.state,
    });
    expect(mocks.cache).toHaveBeenCalledWith('current-owner', 'owned-server', undefined, false);
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it('rejects an old-owner cached annual deep link when new-owner canonical access fails', async () => {
    mocks.load.mockResolvedValue({
      ...saved,
      career: { ...saved.career, ownerProfileId: 'old-owner' },
    });
    mocks.cache.mockRejectedValue(new Error('not owned'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(client.fetchQuery(careerQueryOptions('owned-server'))).rejects.toThrow(
      'not owned',
    );
    expect(mocks.cache).toHaveBeenCalledWith('current-owner', 'owned-server', undefined, false);
  });
});
