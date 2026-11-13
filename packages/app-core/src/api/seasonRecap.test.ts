import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./client.js', () => ({ cachedGet: vi.fn(), hasSessionHint: vi.fn() }));
vi.mock('../seasonRecap.js', () => ({ recapSeen: vi.fn() }));
import { cachedGet, hasSessionHint } from './client.js';
import { recapSeen } from '../seasonRecap.js';
import { recapUnseen } from './seasonRecap.js';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(hasSessionHint).mockReturnValue(true);
});
describe('recap unread indicator', () => {
  it('does not request any data for an already seen season', async () => {
    vi.mocked(recapSeen).mockReturnValue(true);
    expect(await recapUnseen('2026-10-10T00:00:00Z')).toBe(false);
    expect(cachedGet).not.toHaveBeenCalled();
  });
  it('uses only the lightweight availability response', async () => {
    vi.mocked(recapSeen).mockReturnValue(false);
    vi.mocked(cachedGet).mockResolvedValue({
      ok: true,
      data: { tier: { season: 0, tier: 'gold' } },
    });
    expect(await recapUnseen('2026-10-10T00:00:00Z')).toBe(true);
    expect(cachedGet).toHaveBeenCalledExactlyOnceWith('/v1/owner/recap-status', 60_000);
  });
  it('does not show an unread dot for pending or missing recaps', async () => {
    vi.mocked(cachedGet).mockResolvedValue({ ok: true, data: { tier: null } });
    expect(await recapUnseen('2026-10-10T00:00:00Z')).toBe(false);
  });
  it('T-11-724 does not ask when the device has no session yet', async () => {
    vi.mocked(recapSeen).mockReturnValue(false);
    vi.mocked(hasSessionHint).mockReturnValue(false);
    expect(await recapUnseen('2026-10-10T00:00:00Z')).toBe(false);
    expect(cachedGet).not.toHaveBeenCalled();
  });
});
