// UX-014 "우승 연혁" 탭: 리그 1위·컵 우승(cupRound 'WON')만 골라내고, 그 외(준우승·중위권 등)는
// 걸러내는지, 기록이 없으면 빈 배열을 돌려주는지 확인한다.
import type { CareerState, Ruleset } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { buildTrophyList } from './trophies.js';

const ruleset = {
  teams: [{ id: 'team-a', leagueId: 'league-1', leagueTier: 1 }],
  leagues: [{ id: 'league-1', name: '1부 리그' }],
  cups: [{ id: 'cup-1', name: 'FA컵', tiers: [1] }],
} as unknown as Ruleset;

function stateWithHistory(competitions: Array<Record<string, unknown>>): CareerState {
  return {
    seasonHistory: [
      {
        index: 0,
        teamId: 'team-a',
        result: { competitions },
      },
    ],
  } as unknown as CareerState;
}

describe('buildTrophyList', () => {
  it('리그 1위·컵 우승만 트로피로 골라낸다', () => {
    const trophies = buildTrophyList(
      stateWithHistory([
        { competitionId: 'league-1', kind: 'LEAGUE', position: 1, cupRound: null },
        { competitionId: 'cup-1', kind: 'CUP', position: null, cupRound: 'WON' },
      ]),
      ruleset,
    );

    expect(trophies).toHaveLength(2);
    expect(trophies.map((trophy) => trophy.label)).toEqual(['FA컵 우승', '1부 리그 우승']);
  });

  it('우승이 아니면(준우승·중위권 등) 걸러내고, 기록이 없으면 빈 배열이다', () => {
    const trophies = buildTrophyList(
      stateWithHistory([
        { competitionId: 'league-1', kind: 'LEAGUE', position: 4, cupRound: null },
        { competitionId: 'cup-1', kind: 'CUP', position: null, cupRound: 'OUT_FINAL' },
      ]),
      ruleset,
    );

    expect(trophies).toEqual([]);
  });

  it('시즌 기록 자체가 없으면 빈 배열이다', () => {
    expect(buildTrophyList({ seasonHistory: [] } as unknown as CareerState, ruleset)).toEqual([]);
  });
});
