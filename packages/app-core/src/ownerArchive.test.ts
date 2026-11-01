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
it('automatically opens selected closed seasons and reuses records without collapsing', async () => {
  const a = new OwnerArchive();
  await a.load();
  expect(a.state.season).toBe(1);
  expect(fetchSeasonRecap).not.toHaveBeenCalled();
  await a.select(0);
  expect(a.state.expanded).toBe(true);
  expect(markRecapSeen).toHaveBeenCalledWith(0);
  await a.expand();
  expect(a.state.expanded).toBe(true);
  await a.select(1);
  await a.select(0);
  expect(fetchSeasonRecap).toHaveBeenCalledTimes(1);
  expect(a.state.detail).toEqual(detail);
});
it('does not display or mark a late response after choosing another season, but reuses it later', async () => {
  const a = new OwnerArchive();
  await a.load();
  let resolve!: (value: { ok: true; data: SeasonRecapResponse }) => void;
  vi.mocked(fetchSeasonRecap).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const pending = a.select(0);
  await a.select(1);
  resolve({ ok: true, data: detail });
  await pending;
  expect(a.state.season).toBe(1);
  expect(a.state.detail).toBeNull();
  expect(markRecapSeen).not.toHaveBeenCalled();
  await a.select(0);
  expect(fetchSeasonRecap).toHaveBeenCalledTimes(1);
  expect(a.state.detail).toEqual(detail);
  expect(markRecapSeen).toHaveBeenCalledWith(0);
});
it('coalesces an unfinished detail request when returning to the same season', async () => {
  const a = new OwnerArchive();
  await a.load();
  let resolve!: (value: { ok: true; data: SeasonRecapResponse }) => void;
  vi.mocked(fetchSeasonRecap).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const first = a.select(0);
  await a.select(1);
  const second = a.select(0);
  expect(fetchSeasonRecap).toHaveBeenCalledTimes(1);
  resolve({ ok: true, data: detail });
  await Promise.all([first, second]);
  expect(a.state.detail).toEqual(detail);
  expect(a.state.detailLoading).toBe(false);
});
it('loads a preferred closed season immediately, retries errors and ignores work after disposal', async () => {
  const a = new OwnerArchive();
  vi.mocked(fetchSeasonRecap).mockResolvedValueOnce({
    ok: false,
    error: { code: 'UNAVAILABLE', message: 'unavailable', retryable: true },
  });
  await a.load(0);
  expect(a.state.expanded).toBe(true);
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
