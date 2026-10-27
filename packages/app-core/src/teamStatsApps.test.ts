import { describe, expect, it } from 'vitest';
import type { TeamStatsResponse } from './api/team.js';
import { statsPlayerRows } from './teamStats.js';

const base = (over: Partial<TeamStatsResponse>): TeamStatsResponse => ({
  season: 2,
  matches: 4,
  capped: false,
  total: { w: 2, d: 1, l: 1, gf: 5, ga: 3 },
  players: [
    { careerId: 'a', name: 'A', goals: 3, assists: 0, apps: 4, pos: 'ST' },
    { careerId: 'b', name: 'B', goals: 1, assists: 4, apps: 2, pos: 'AM' },
    { careerId: 'g', name: 'G', goals: 0, assists: 0, apps: 4, pos: 'GK' },
    { careerId: null, name: '유스 선수', goals: 0, assists: 0, apps: 1 },
  ],
  days: [],
  opponents: [],
  xiMatches: 4,
  ...over,
});

describe('T-11-518 시즌 통계 선수 줄', () => {
  it('모든 경기에 명단이 있으면 자리 · 경기당 골을 붙이고 정렬을 바꾼다', () => {
    const { rows, showApps, note } = statsPlayerRows(base({}), 'goals');
    expect(showApps).toBe(true);
    expect(note).toBe('출전은 선발로 뛴 경기예요.');
    expect(rows.map((r) => r.sub)).toEqual([
      'ST · 경기당 0.75골',
      'AM · 경기당 0.50골',
      'GK · 골 없음',
      '빈 자리를 채운 경기',
    ]);
    expect(statsPlayerRows(base({}), 'assists').rows[0]!.p.careerId).toBe('b');
    expect(statsPlayerRows(base({}), 'apps').rows.map((r) => r.p.careerId)).toEqual([
      'a',
      'g',
      'b',
      null,
    ]);
  });

  it('명단이 없는 경기가 섞이면 경기당 골을 빼고 안내한다', () => {
    const { rows, note } = statsPlayerRows(base({ matches: 10 }), 'goals');
    expect(rows[0]!.sub).toBe('ST');
    expect(note).toContain('최근 4경기');
  });

  it('옛 응답이면 출전 칸을 숨긴다', () => {
    const { rows, showApps, note } = statsPlayerRows(base({ xiMatches: undefined }), 'apps');
    expect(showApps).toBe(false);
    expect(note).toBeNull();
    expect(rows[0]!.apps).toBeNull();
    expect(rows[0]!.p.careerId).toBe('a');
  });
});
