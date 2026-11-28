import { describe, expect, it } from 'vitest';
import type { TeamPlayer } from './api/team.js';
import { firstTeamDefaults, firstTeamNote } from './teamOwner.js';

const player = (id: string, extra: Partial<TeamPlayer>) =>
  ({
    careerId: id,
    pos: 'FW',
    dpos: 'ST',
    peak: 80,
    roles: null,
    attrs: null,
    number: null,
    publicName: null,
    legendScore: 0,
    ...extra,
  }) as TeamPlayer;

describe('T-11-842 first team defaults', () => {
  const base = { season: 2, editable: true, lastManager: null, lastTeamName: null };
  it('auto places owned players better than youth and leaves the rest empty', () => {
    const players = [
      player('gk', { pos: 'GK', dpos: 'GK', peak: 80 }),
      player('st', { pos: 'FW', dpos: 'ST', peak: 85 }),
    ];
    const d = firstTeamDefaults({ ...base, players, nickname: null });
    expect(d.slots.filter(Boolean).sort()).toEqual(['gk', 'st']);
    expect(d.slots).toHaveLength(11);
    expect(
      firstTeamDefaults({ ...base, players: [], nickname: null }).slots.every((s) => s === null),
    ).toBe(true);
  });
  it('prefers last season names, then the nickname', () => {
    expect(firstTeamDefaults({ ...base, players: [], nickname: '수영' })).toMatchObject({
      name: '수영 FC',
      manager: '수영',
    });
    expect(
      firstTeamDefaults({
        ...base,
        players: [],
        nickname: '수영',
        lastTeamName: '서울 유나이티드',
        lastManager: '감독님',
      }),
    ).toMatchObject({ name: '서울 유나이티드', manager: '감독님' });
  });
  it('fits names into the allowed lengths or leaves them empty', () => {
    const long = firstTeamDefaults({ ...base, players: [], nickname: 'abcdefghijklmnop' });
    expect(long.name).toBe('abcdefghi FC');
    expect(long.manager).toBe('');
    expect(firstTeamDefaults({ ...base, players: [], nickname: 'a' })).toMatchObject({
      name: 'a FC',
      manager: '',
    });
    expect(firstTeamDefaults({ ...base, players: [], nickname: null })).toMatchObject({
      name: '',
      manager: '',
    });
  });
  it('says only what was filled', () => {
    expect(firstTeamNote(3, true)).toContain('선발');
    expect(firstTeamNote(3, true)).toContain('이름');
    expect(firstTeamNote(3, false)).toContain('팀 이름을 정하고');
    expect(firstTeamNote(0, true)).toContain('팀 이름과 감독 이름');
    expect(firstTeamNote(0, false)).toBeNull();
  });
});
