// SCR-005 단위 테스트. canPlanNextSeason은 계약·임대 복귀 결정이 남아 있으면 다음 시즌 계획에
// 진입하지 못하게 막는다. 사용자 결정(2026-09-13, D-77) 후 시뮬레이션 모드는 더 이상 선택지가
// 아니라 FIXED_SIMULATION_MODE 하나로 고정된다.
import type { CareerState } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { screenForCareer } from './career-route.js';
import { canPlanNextSeason, FIXED_SIMULATION_MODE, isRetirementDecisionRequiredError } from './start-season.js';

function stateWith(seasonHistory: CareerState['seasonHistory'], contractTeamId: string | null): CareerState {
  return {
    seasonHistory,
    contract: contractTeamId === null ? null : ({ teamId: contractTeamId } as CareerState['contract']),
  } as unknown as CareerState;
}

function ruleset170Boundary(injuryMissedMatches: number): CareerState {
  const lastSeason = {
    result: {
      playerStats: { appearances: { total: 33 }, minutes: 950 },
      selectionSummary: { possibleMinutes: 2970 },
      legacy: { injuryMissedMatches },
    },
  } as CareerState['seasonHistory'][number];
  return {
    ...stateWith([lastSeason], 'team-a'),
    status: 'ACTIVE',
    age: 36,
    season: null,
    pending: null,
    state: { fitness: 80 } as CareerState['state'],
    contract: { teamId: 'team-a', signedSeasonIndex: 2, lengthSeasons: 1 } as CareerState['contract'],
    retirement: { policyVersion: '1.0.0', marketOffers: 2, lastChanceConsumed: false, lastChanceSeasonIndex: null },
    nationalityRuleState: { moduleId: 'DEFAULT', exceptions: [] },
    rulesetVersion: '1.7.0',
    contentPackVersion: '0.6.4',
    careerId: 'stored-1-7-0',
  } as CareerState;
}

describe('canPlanNextSeason', () => {
  it('계약·임대 복귀 결정이 남아 있으면 다음 시즌 계획에 진입하지 않는다', () => {
    const state = { ...stateWith([], 'team-a'), status: 'ACTIVE', season: null, pending: null, nationalityRuleState: { moduleId: 'DEFAULT', exceptions: [] }, rulesetVersion: '1.0.0' } as CareerState;
    expect(canPlanNextSeason(state)).toBe(true);
    expect(canPlanNextSeason({ ...state, pending: { kind: 'LOAN_RETURN', options: ['RETURN'], buyOptionMinor: null } })).toBe(false);
    expect(canPlanNextSeason({ ...state, contract: null })).toBe(false);
  });

  it('저장된 1.7.0/0.6.4 규칙으로 은퇴 임계에 닿은 경계는 SCR-025로 보낸다', () => {
    const state = ruleset170Boundary(22);
    expect(canPlanNextSeason(state)).toBe(false);
    expect(screenForCareer(state)).toEqual({ screenId: 'SCR-025', params: { careerId: 'stored-1-7-0' } });
  });

  it('같은 저장 1.7.0/0.6.4 쌍에서 은퇴 임계 미만이면 시즌 계획을 허용한다', () => {
    expect(canPlanNextSeason(ruleset170Boundary(0))).toBe(true);
  });

  it('은퇴 임계여도 미응답 OFFERS는 기존 시장 결정 화면을 우선한다', () => {
    const state = { ...ruleset170Boundary(22), pending: { kind: 'OFFERS', offers: [], market: { openedAtRevision: 1, seasonIndex: 1, reason: 'EXPIRED', safeOfferId: null } } } as CareerState;
    expect(canPlanNextSeason(state)).toBe(false);
    expect(screenForCareer(state).screenId).toBe('SCR-017');
  });
});

describe('isRetirementDecisionRequiredError', () => {
  it('START_SEASON의 정확한 은퇴 결정 사유만 식별한다', () => {
    expect(isRetirementDecisionRequiredError({ code: 'VALIDATION_FAILED', details: { reason: 'RETIREMENT_DECISION_REQUIRED' } })).toBe(true);
    expect(isRetirementDecisionRequiredError({ code: 'VALIDATION_FAILED', details: { reason: 'MARKET_OPEN' } })).toBe(false);
    expect(isRetirementDecisionRequiredError({ code: 'CAREER_REVISION_CONFLICT', details: { reason: 'RETIREMENT_DECISION_REQUIRED' } })).toBe(false);
  });
});

describe('FIXED_SIMULATION_MODE', () => {
  it('사용자 결정(2026-09-13, D-77): 항상 FAST다', () => {
    expect(FIXED_SIMULATION_MODE).toBe('FAST');
  });
});
