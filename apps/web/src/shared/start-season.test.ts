// SCR-005 단위 테스트. canPlanNextSeason은 계약·임대 복귀 결정이 남아 있으면 다음 시즌 계획에
// 진입하지 못하게 막는다. 사용자 결정(2026-09-13, D-77) 후 시뮬레이션 모드는 더 이상 선택지가
// 아니라 FIXED_SIMULATION_MODE 하나로 고정된다.
import type { CareerState } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { canPlanNextSeason, FIXED_SIMULATION_MODE } from './start-season.js';

function stateWith(seasonHistory: CareerState['seasonHistory'], contractTeamId: string | null): CareerState {
  return {
    seasonHistory,
    contract: contractTeamId === null ? null : ({ teamId: contractTeamId } as CareerState['contract']),
  } as unknown as CareerState;
}

describe('canPlanNextSeason', () => {
  it('계약·임대 복귀 결정이 남아 있으면 다음 시즌 계획에 진입하지 않는다', () => {
    const state = { ...stateWith([], 'team-a'), status: 'ACTIVE', season: null, pending: null } as CareerState;
    expect(canPlanNextSeason(state)).toBe(true);
    expect(canPlanNextSeason({ ...state, pending: { kind: 'LOAN_RETURN', options: ['RETURN'], buyOptionMinor: null } })).toBe(false);
    expect(canPlanNextSeason({ ...state, contract: null })).toBe(false);
  });
});

describe('FIXED_SIMULATION_MODE', () => {
  it('사용자 결정(2026-09-13, D-77): 항상 FAST다', () => {
    expect(FIXED_SIMULATION_MODE).toBe('FAST');
  });
});
