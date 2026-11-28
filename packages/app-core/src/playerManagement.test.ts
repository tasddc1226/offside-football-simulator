import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerTeamResponse, TeamPlayer } from './api/team.js';
import { fetchOwnerTeam } from './api/team.js';
import { fetchMarketMe, releaseCards } from './api/market.js';
import { invalidateApiCache } from './api/client.js';
import {
  PlayerManagement,
  managedPlayers,
  manageView,
  manageNations,
  manageLockTag,
  manageRowInfo,
  forgetManageView,
} from './playerManagement.js';

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
  forgetManageView();
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

describe('T-11-841 owned player filter and sort', () => {
  const list = [
    player('a', { pos: 'FW', nation: 'BR', peak: 88, legendScore: 900, cardValue: 300 }),
    player('b', {
      pos: 'DF',
      nation: null,
      peak: 92,
      legendScore: 500,
      cardValue: 900,
      enhance: 3,
    }),
    player('c', { pos: 'FW', nation: 'KR', peak: 92, legendScore: 700, cardValue: 100 }),
    player('d', {
      pos: 'GK',
      nation: 'BR',
      peak: 70,
      legendScore: 1200,
      cardValue: 50,
      enhance: 5,
    }),
  ];
  it('sorts high to low with peak and score as tie-breakers', () => {
    expect(manageView(list, {}, 'peak').map((p) => p.careerId)).toEqual(['c', 'b', 'a', 'd']);
    expect(manageView(list, {}, 'score').map((p) => p.careerId)).toEqual(['d', 'a', 'c', 'b']);
    expect(manageView(list, {}, 'value').map((p) => p.careerId)).toEqual(['b', 'a', 'c', 'd']);
    expect(manageView(list, {}, 'enhance').map((p) => p.careerId)).toEqual(['d', 'b', 'c', 'a']);
  });
  it('filters by position and nation, reading a missing nation as Korea', () => {
    expect(manageView(list, { pos: 'FW' }, 'peak').map((p) => p.careerId)).toEqual(['c', 'a']);
    expect(manageView(list, { nation: 'KR' }, 'peak').map((p) => p.careerId)).toEqual(['c', 'b']);
    expect(manageView(list, { pos: 'FW', nation: 'BR' }, 'peak').map((p) => p.careerId)).toEqual([
      'a',
    ]);
    expect(manageNations(list)).toEqual([
      { code: 'BR', n: 2 },
      { code: 'KR', n: 2 },
    ]);
  });
  it('bulk select picks only visible releasable players and keeps picks across filters', async () => {
    vi.mocked(fetchOwnerTeam).mockImplementation(async (season) =>
      ok(team(season ?? 1, list, [{ careerId: 'd' }])),
    );
    const m = new PlayerManagement();
    await m.load(1);
    m.setFilter({ nation: 'BR' });
    expect(m.visible.map((p) => p.careerId)).toEqual(['a', 'd']);
    m.selectAll();
    expect([...m.state.selected]).toEqual(['a']);
    m.setFilter({ nation: undefined, pos: 'DF' });
    expect(m.selectedPlayers.map((p) => p.careerId)).toEqual(['a']);
  });
});

describe('T-11-841 search, remembered view and compact rows', () => {
  const list = [
    player('a', { pos: 'FW', publicName: 'Carlos Silva', peak: 90 }),
    player('b', { pos: 'DF', publicName: '김 민재', peak: 95 }),
  ];
  it('searches the shown name ignoring case and spaces', () => {
    expect(manageView(list, { q: 'carlos s' }, 'peak').map((p) => p.careerId)).toEqual(['a']);
    expect(manageView(list, { q: '민재' }, 'peak').map((p) => p.careerId)).toEqual(['b']);
    const renamed = (p: TeamPlayer) => (p.careerId === 'a' ? '호날두' : (p.publicName ?? ''));
    expect(manageView(list, { q: '호날' }, 'peak', renamed).map((p) => p.careerId)).toEqual(['a']);
  });
  it('remembers filter and sort for the next screen visit', () => {
    const first = new PlayerManagement();
    first.setFilter({ pos: 'DF', q: 'kim' });
    first.setSort('score');
    const next = new PlayerManagement();
    expect(next.state.filter).toEqual({ pos: 'DF', q: 'kim' });
    expect(next.state.sort).toBe('score');
  });
  it('shows a short lock tag and keeps OVR out of the row info', () => {
    const lineup = new Set(['s']);
    expect(manageLockTag(player('x', { raised: false }), lineup)).toBe('영입');
    expect(manageLockTag(player('x', { listing: { id: 'l', price: 1 } }), lineup)).toBe('판매 중');
    expect(manageLockTag(player('x', { locked: true }), lineup)).toBe('잠금');
    expect(manageLockTag(player('s'), lineup)).toBe('선발');
    expect(manageLockTag(player('x'), lineup)).toBeNull();
    expect(
      manageRowInfo(
        player('x', { pos: 'DF', dpos: 'CB', peak: 96, legendScore: 2210, enhance: 5 }),
      ),
    ).toBe('CB · 레전드\u00a02,210 · 강화\u00a0+5');
  });
});
