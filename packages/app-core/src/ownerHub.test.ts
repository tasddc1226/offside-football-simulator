import { describe, expect, it } from 'vitest';
import type { OwnerTeamResponse } from './api/team.js';
import { ownerLockedText, ownerSummary, ownerTeamCard, ownerTeamEmptyText } from './ownerHub.js';

const base: OwnerTeamResponse = {
  season: 1,
  current: 1,
  seasons: [
    { id: 0, name: '프리시즌' },
    { id: 1, name: '시즌 1' },
  ],
  team: null,
  players: [],
  lastManager: null,
  matchesLeft: 10,
  matchesPerDay: 10,
};
const slot = (careerId: string | null) => ({
  slot: 'ST' as const,
  careerId,
  name: '',
  pos: null,
  rating: 50,
  fit: 1,
});
const team = (filled: boolean) => ({
  id: 'tem_00000000-0000-4000-8000-000000000001',
  season: 1,
  name: '팀',
  manager: '감독',
  formation: '4-3-3' as const,
  slots: Array.from({ length: 11 }, (_, i) => slot(filled && i === 0 ? 'c1' : null)),
  ovr: 60,
  lines: { atk: 60, mid: 60, def: 60, gk: 60 },
  rating: 1000,
  record: { w: 1, d: 0, l: 2 },
  likes: 0,
  views: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

describe('ownerSummary', () => {
  it('선수 수 · 점수 합 · 결번 수 · 구단 가치', () => {
    expect(ownerSummary([])).toEqual({ players: 0, score: 0, retired: 0, value: 0 });
    expect(
      ownerSummary([
        { stats: { score: 100 }, rn: 7, value: 300_000 },
        { stats: { score: 50 }, rn: null, value: 51_000 },
        { stats: { score: 25 }, value: 0 },
      ]),
    ).toEqual({ players: 3, score: 175, retired: 1, value: 351_000 });
  });
});

describe('ownerTeamCard', () => {
  it('지금 시즌 팀이 있고 경기가 남았으면 막는 이유가 없다', () => {
    const c = ownerTeamCard({ ...base, team: team(true) });
    expect(c.season).toBe('시즌 1');
    expect(c.playHint).toBeNull();
  });
  it('팀이 없거나 유스뿐이거나 경기를 다 치렀으면 이유를 준다', () => {
    expect(ownerTeamCard(base).playHint).toMatch(/저장/);
    expect(ownerTeamCard({ ...base, team: team(false) }).playHint).toMatch(/한 명 이상/);
    expect(ownerTeamCard({ ...base, team: team(true), matchesLeft: 0 }).playHint).toMatch(
      /모두 치렀/,
    );
  });
  it('휴식기(current null)엔 경기할 수 없다', () => {
    expect(ownerTeamCard({ ...base, current: null, team: team(true) }).playHint).toMatch(/휴식기/);
  });
  it('팀이 없을 때 안내는 넣을 수 있는 선수 수를 말한다', () => {
    expect(ownerTeamEmptyText(ownerTeamCard({ ...base, players: [] }))).toMatch(/생기면/);
    const players = [{ careerId: 'c1' }, { careerId: 'c2' }] as OwnerTeamResponse['players'];
    expect(ownerTeamEmptyText(ownerTeamCard({ ...base, players }))).toContain('2명');
  });
});

describe('ownerLockedText', () => {
  it('이 기기의 은퇴 선수 수를 넣는다', () => {
    expect(ownerLockedText(3)).toContain('은퇴한 선수 3명으로');
    expect(ownerLockedText(0)).toContain('은퇴한 선수로 팀을');
  });
});
