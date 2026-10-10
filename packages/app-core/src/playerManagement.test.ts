import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerTeamResponse, TeamPlayer } from './api/team.js';
import { fetchOwnerTeam } from './api/team.js';
import { fetchMarketMe, releaseCards } from './api/market.js';
import { invalidateApiCache } from './api/client.js';
import { PlayerManagement, managedPlayers } from './playerManagement.js';

vi.mock('./api/team.js', () => ({ fetchOwnerTeam: vi.fn() }));
vi.mock('./api/market.js', () => ({ fetchMarketMe: vi.fn(), releaseCards: vi.fn() }));
vi.mock('./api/client.js', () => ({ invalidateApiCache: vi.fn() }));
const player = (id: string, extra = {}) =>
  ({ careerId: id, season: 1, raised: true, cardValue: 100, ...extra }) as TeamPlayer;
const team = (season: number, players: TeamPlayer[], slots: { careerId: string }[] = []) =>
  ({ season, current: 1, players, team: { slots } }) as OwnerTeamResponse;
const ok = <T>(data: T) => ({ ok: true as const, data });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchMarketMe).mockResolvedValue(ok({ rules: { releaseRate: 1 } }) as never);
  vi.mocked(fetchOwnerTeam).mockResolvedValue(ok(team(1, [player('a'), player('b')])));
});
describe('owner player release', () => {
  it('filters season cards and protects current starters even in a past season', async () => {
    const older = [
      player('a', { season: 0 }),
      player('b', { season: 0, raised: false }),
      player('c', { season: 0, locked: true }),
      player('d', { season: 0, listing: {} }),
      player('e', { season: 0 }),
      player('wildcard'),
    ];
    vi.mocked(fetchOwnerTeam).mockImplementation(async (season) =>
      ok(season === 0 ? team(0, older) : team(1, [], [{ careerId: 'e' }])),
    );
    const m = new PlayerManagement();
    await m.load(0);
    expect(managedPlayers(team(0, older))).toHaveLength(5);
    expect(m.eligible.map((p) => p.careerId)).toEqual(['a']);
    for (const p of older) m.toggle(p.careerId);
    expect([...m.state.selected]).toEqual(['a']);
  });
  it('caps individual and bulk selection at the API maximum', async () => {
    vi.mocked(fetchOwnerTeam).mockResolvedValue(
      ok(
        team(
          1,
          Array.from({ length: 55 }, (_, i) => player(String(i))),
        ),
      ),
    );
    const m = new PlayerManagement();
    await m.load(1);
    m.selectAll();
    expect(m.state.selected.size).toBe(50);
    m.selectAll();
    expect(m.state.selected.size).toBe(0);
    for (let i = 0; i < 55; i++) m.toggle(String(i));
    expect(m.state.selected.size).toBe(50);
  });
  it('requires confirmation, prevents double submissions and reports actual partial release', async () => {
    const m = new PlayerManagement();
    await m.load(1);
    m.selectAll();
    await m.release();
    expect(releaseCards).not.toHaveBeenCalled();
    let finish!: (value: Awaited<ReturnType<typeof releaseCards>>) => void;
    vi.mocked(releaseCards).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    m.confirm(true);
    const pending = m.release();
    await m.release();
    expect(releaseCards).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
    vi.mocked(fetchOwnerTeam).mockResolvedValue(ok(team(1, [player('b')])));
    finish(ok({ released: 1, amount: 100, balance: 100 }));
    await pending;
    expect(m.state.notice).toContain('1');
    expect(m.state.players.map((p) => p.careerId)).toEqual(['b']);
    expect(m.state.selected.size).toBe(0);
    expect(m.state.busy).toBe(false);
  });
  it('invalidates ownership reads after a conflict and clears the selection', async () => {
    const m = new PlayerManagement();
    await m.load(1);
    m.toggle('a');
    m.confirm(true);
    vi.mocked(releaseCards).mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'changed', retryable: false },
    } as never);
    await m.release();
    expect(invalidateApiCache).toHaveBeenCalledWith('/v1/owner-team');
    expect(m.state.error).toBe('changed');
    expect(m.state.selected.size).toBe(0);
  });
  it('ignores a late response from a previous season', async () => {
    let finish!: (value: Awaited<ReturnType<typeof fetchOwnerTeam>>) => void;
    vi.mocked(fetchOwnerTeam).mockImplementation((season) =>
      season === 0
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(ok(team(1, [player('new')]))),
    );
    const m = new PlayerManagement();
    const old = m.load(0);
    await m.load(1);
    finish(ok(team(0, [player('old', { season: 0 })])));
    await old;
    expect(m.state.season).toBe(1);
    expect(m.state.players[0]?.careerId).toBe('new');
  });
});
