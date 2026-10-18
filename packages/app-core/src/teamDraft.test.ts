import { describe, expect, it, vi } from 'vitest';
import type { OwnerTeam } from '@offside/contracts';
import { MANAGER_NAME_MAX, TEAM_NAME_MAX } from '@offside/contracts/owner-team';
import { createTeamDraftStore, teamDraftBase, type TeamDraft } from './teamDraft.js';

const draft = (): TeamDraft => ({
  base: 'null',
  value: {
    name: '',
    manager: '',
    formation: '4-3-3',
    slots: Array<string | null>(11).fill(null),
    coach: null,
  },
});

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn((key: string) => values.get(key)),
    set: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    remove: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}

describe('team draft compatibility across web and mobile', () => {
  it('loads an existing v1 payload, including empty names and the coach field', () => {
    const disk = storage();
    const existing = draft();
    disk.values.set('ft_team_draft_v1:owner', JSON.stringify(existing));
    const store = createTeamDraftStore(disk);
    expect(disk.get).not.toHaveBeenCalled();
    expect(store.readTeamDraft('owner')).toEqual(existing);
    store.writeTeamDraft('owner', existing);
    expect(disk.set).toHaveBeenCalledWith('ft_team_draft_v1:owner', JSON.stringify(existing));
    // A fresh store restores it without the old instance's memory fallback.
    expect(createTeamDraftStore(disk).readTeamDraft('owner')).toEqual(existing);
  });

  it.each([
    null,
    { base: 1, value: draft().value },
    { base: 'null', value: { ...draft().value, slots: [] } },
    { base: 'null', value: { ...draft().value, name: 'x'.repeat(TEAM_NAME_MAX + 1) } },
    { base: 'null', value: { ...draft().value, manager: 'x'.repeat(MANAGER_NAME_MAX + 1) } },
    { base: 'null', value: { ...draft().value, formation: 'unknown' } },
    { base: 'null', value: { ...draft().value, unexpected: true } },
  ])('rejects an invalid stored payload: %j', (invalid) => {
    const disk = storage();
    disk.values.set('ft_team_draft_v1:owner', JSON.stringify(invalid));
    expect(createTeamDraftStore(disk).readTeamDraft('owner')).toBeNull();
  });

  it('recovers from malformed JSON and storage errors using an isolated deep copy', () => {
    const broken = {
      get: () => {
        throw new Error('unavailable');
      },
      set: () => {
        throw new Error('quota');
      },
      remove: () => {
        throw new Error('unavailable');
      },
    };
    const store = createTeamDraftStore(broken);
    const original = draft();
    store.writeTeamDraft('owner', original);
    original.value.slots[0] = 'changed';
    expect(store.readTeamDraft('owner')).toEqual(draft());
    expect(store.readTeamDraft('another-owner')).toBeNull();
    expect(createTeamDraftStore(broken).readTeamDraft('owner')).toBeNull();
    store.writeTeamDraft('owner', null);
    expect(store.readTeamDraft('owner')).toBeNull();

    const disk = storage();
    const malformed = createTeamDraftStore(disk);
    malformed.writeTeamDraft('owner', draft());
    disk.values.set('ft_team_draft_v1:owner', '{');
    expect(malformed.readTeamDraft('owner')).toEqual(draft());
  });

  it('removes only the named owner draft from storage and memory', () => {
    const disk = storage();
    const store = createTeamDraftStore(disk);
    store.writeTeamDraft('one', draft());
    store.writeTeamDraft('two', draft());
    store.writeTeamDraft('one', null);
    expect(disk.remove).toHaveBeenCalledWith('ft_team_draft_v1:one');
    expect(store.readTeamDraft('one')).toBeNull();
    expect(store.readTeamDraft('two')).toEqual(draft());
  });

  it('keeps match results outside the draft conflict key and detects actual lineup edits', () => {
    const team: OwnerTeam = {
      id: 'team',
      season: 1,
      name: 'Team',
      manager: 'Coach',
      formation: '4-3-3',
      slots: Array.from({ length: 11 }, () => ({
        slot: 'ST',
        careerId: null,
        name: 'Youth',
        pos: null,
        rating: 50,
        fit: 1,
      })),
      ovr: 60,
      lines: { atk: 60, mid: 60, def: 60, gk: 60 },
      rating: 1000,
      record: { w: 0, d: 0, l: 0 },
      likes: 0,
      views: 0,
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
    };
    expect(teamDraftBase(null)).toBe('null');
    expect(teamDraftBase({ ...team, rating: 1200, views: 3 })).toBe(teamDraftBase(team));
    expect(teamDraftBase({ ...team, name: 'Other' })).not.toBe(teamDraftBase(team));
    expect(
      teamDraftBase({
        ...team,
        slots: team.slots.map((s, i) => (i === 0 ? { ...s, careerId: 'player' } : s)),
      }),
    ).not.toBe(teamDraftBase(team));
  });
});
