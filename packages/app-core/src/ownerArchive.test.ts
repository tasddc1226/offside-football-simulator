import { beforeEach, expect, it, vi } from 'vitest';
import { OwnerArchive } from './ownerArchive.js';
import { fetchOwnerArchive, type OwnerArchiveResponse } from './api/ownerProfile.js';
import { fetchSeasonRecap, type SeasonRecapResponse } from './api/seasonRecap.js';
import { markRecapSeen } from './seasonRecap.js';
vi.mock('./api/ownerProfile.js', () => ({ fetchOwnerArchive: vi.fn() }));
vi.mock('./api/seasonRecap.js', () => ({ fetchSeasonRecap: vi.fn() }));
vi.mock('./api/client.js', () => ({ invalidateApiCache: vi.fn() }));
vi.mock('./seasonRecap.js', () => ({ markRecapSeen: vi.fn() }));
const data = {
  owner: {
    seasons: [
      { season: 0, closed: true },
      { season: 1, closed: false },
    ],
  },
} as OwnerArchiveResponse;
const detail = { season: 0, status: 'ready', recap: null, honors: [] } as SeasonRecapResponse;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchOwnerArchive).mockResolvedValue({ ok: true, data });
  vi.mocked(fetchSeasonRecap).mockResolvedValue({ ok: true, data: detail });
});
it('loads details only when expanded and reuses them across season switches', async () => {
  const a = new OwnerArchive();
  await a.load();
  expect(a.state.season).toBe(1);
  await a.expand();
  expect(fetchSeasonRecap).not.toHaveBeenCalled();
  a.select(0);
  expect(fetchSeasonRecap).not.toHaveBeenCalled();
  await a.expand();
  expect(markRecapSeen).toHaveBeenCalledWith(0);
  a.select(1);
  a.select(0);
  await a.expand();
  expect(fetchSeasonRecap).toHaveBeenCalledTimes(1);
  expect(a.state.detail).toEqual(detail);
});
it('does not apply or mark a late response after choosing another season', async () => {
  const a = new OwnerArchive();
  await a.load(0);
  let resolve!: (value: { ok: true; data: SeasonRecapResponse }) => void;
  vi.mocked(fetchSeasonRecap).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const pending = a.expand();
  a.select(1);
  resolve({ ok: true, data: detail });
  await pending;
  expect(a.state.season).toBe(1);
  expect(a.state.detail).toBeNull();
  expect(markRecapSeen).not.toHaveBeenCalled();
});
it('retries an error, and ignores work after disposal', async () => {
  const a = new OwnerArchive();
  await a.load(0);
  vi.mocked(fetchSeasonRecap).mockResolvedValueOnce({
    ok: false,
    error: { code: 'UNAVAILABLE', message: 'unavailable', retryable: true },
  });
  await a.expand();
  expect(a.state.detailError).toBe(true);
  await a.expand(true);
  expect(a.state.detailError).toBe(false);
  expect(a.state.detail).toEqual(detail);
  const b = new OwnerArchive();
  const load = b.load();
  b.dispose();
  await load;
  expect(b.state.data).toBeNull();
});
