// SCR-005 RULE-TIME-003 기본 모드 규칙(단위 테스트). defaultSimulationMode는 seasonHistory·
// contract만 읽으므로 그 두 필드만 채운 최소 CareerState로 검증한다.
import type { CareerState, SimulationMode } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { canPlanNextSeason, defaultSimulationMode } from './start-season.js';

function stateWith(seasonHistory: CareerState['seasonHistory'], contractTeamId: string | null): CareerState {
  return {
    seasonHistory,
    contract: contractTeamId === null ? null : ({ teamId: contractTeamId } as CareerState['contract']),
  } as unknown as CareerState;
}

describe('defaultSimulationMode', () => {
  it('계약·임대 복귀 결정이 남아 있으면 다음 시즌 계획에 진입하지 않는다', () => {
    const state = { ...stateWith([], 'team-a'), status: 'ACTIVE', season: null, pending: null } as CareerState;
    expect(canPlanNextSeason(state)).toBe(true);
    expect(canPlanNextSeason({ ...state, pending: { kind: 'LOAN_RETURN', options: ['RETURN'], buyOptionMinor: null } })).toBe(false);
    expect(canPlanNextSeason({ ...state, contract: null })).toBe(false);
  });
  it('첫 프로 시즌(seasonHistory 비어있음)이면 CHAPTER다', () => {
    expect(defaultSimulationMode(stateWith([], 'team-a'), 'FAST')).toBe('CHAPTER');
  });

  it('새 팀 첫 시즌(직전 시즌 teamId와 계약 teamId가 다름)이면 CHAPTER다', () => {
    const history = [
      { index: 1, simulationMode: 'FAST', teamId: 'team-a', competitions: [], settledAtRevision: 10 },
    ] as unknown as CareerState['seasonHistory'];
    expect(defaultSimulationMode(stateWith(history, 'team-b'), 'FAST')).toBe('CHAPTER');
  });

  it('같은 팀에서 이어가는 시즌이면 프로필 기본값을 쓴다', () => {
    const history = [
      { index: 1, simulationMode: 'CHAPTER', teamId: 'team-a', competitions: [], settledAtRevision: 10 },
    ] as unknown as CareerState['seasonHistory'];
    expect(defaultSimulationMode(stateWith(history, 'team-a'), 'FAST')).toBe('FAST');
  });

  it('프로필 기본값이 없으면 직전 시즌 모드로 되돌아간다', () => {
    const history = [
      { index: 1, simulationMode: 'CHAPTER', teamId: 'team-a', competitions: [], settledAtRevision: 10 },
    ] as unknown as CareerState['seasonHistory'];
    const profileDefault: SimulationMode | null = null;
    expect(defaultSimulationMode(stateWith(history, 'team-a'), profileDefault)).toBe('CHAPTER');
  });
});
