import { describe, expect, it } from 'vitest';
import type { CareerState, Ruleset } from '@offside/domain';
import { buildCareerSeasonNarratives } from './career-season-narrative.js';

const ruleset = {
  teams: [{ id: 'club-a', name: '청연 FC' }],
} as unknown as Ruleset;

function baseState(overrides: Partial<CareerState> = {}): CareerState {
  return {
    clubHistory: [],
    seasonHistory: [],
    season: null,
    ...overrides,
  } as unknown as CareerState;
}

const result = {
  playerStats: {
    appearances: { total: 14, zeroMinute: 2 },
    minutes: 900,
    ratedMatches: 10,
    ratingSumTenths: 760,
    injuries: 1,
  },
  competitions: [],
  baseOvr: { before: 70, after: 74 },
};

describe('career season narrative', () => {
  it('keeps an empty career deterministic and truthful', () => {
    expect(buildCareerSeasonNarratives(baseState(), ruleset, 2026)).toEqual([]);
  });

  it('includes stored facts for completed and ongoing seasons', () => {
    const state = baseState({
      clubHistory: [
        {
          teamId: 'club-a',
          teamName: '청연 FC',
          kind: 'PERMANENT',
          fromSeasonIndex: 1,
          toSeasonIndex: null,
        } as never,
      ],
      seasonHistory: [{ index: 1, teamId: 'club-a', result } as never],
      season: { index: 2, teamId: 'club-a' } as never,
    });
    const narratives = buildCareerSeasonNarratives(state, ruleset, 2026);
    expect(narratives).toHaveLength(2);
    expect(narratives[0]?.sentence).toContain('12경기 출전');
    expect(narratives[0]?.sentence).toContain('부상 기록 1회');
    expect(narratives[1]?.sentence).toContain('시즌 진행 중 · 결산 전 확정 기록 없음');
  });
});
