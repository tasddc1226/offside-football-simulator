import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS } from '../schema/ruleset.ts';
import { CONDITION_FIELDS, SEASON_STATS, resolveConditionField } from '../schema/condition.ts';
import { buildConditionContext } from './condition-context.ts';
import { buildTestState, TEST_DRAFT, TEST_PROFILE, timelineEntry } from './build-test-state.ts';
import type { Contract } from '@offside/domain';

const TEST_CONTRACT: Contract = {
  id: 'CTR-1',
  offerId: 'OFR-1-0',
  teamId: 'hangang-u18',
  teamName: '한강 FC U18',
  leagueTier: 'YOUTH',
  lengthSeasons: 2,
  wageMinorPerWeek: 0,
  signingBonusMinor: 0,
  rolePromise: 'STARTER',
  shirtNumber: 9,
  signatureType: 'AUTO',
  signedAtRevision: 1,
  kind: 'PERMANENT',
  appearancePromise: { minutesShareBp: 6000 },
  positionPlan: 'ST',
  suspended: false,
  loan: null,
  promiseBreaches: 0,
  signedSeasonIndex: 1,
};

describe('buildConditionContext: DSL 필드 전수 존재', () => {
  const context = buildConditionContext(buildTestState());

  it.each(CONDITION_FIELDS.map((field) => field.path))('정적 필드 %s가 컨텍스트에 있다', (path) => {
    expect(resolveConditionField(path)).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(context, path)).toBe(true);
  });

  it.each(ATTRIBUTE_KEYS.map((key) => `player.attributes.${key}`))('동적 필드 %s가 컨텍스트에 있다', (path) => {
    expect(resolveConditionField(path)).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(context, path)).toBe(true);
  });

  it.each(SEASON_STATS.map((stat) => `season.stats.${stat}`))('동적 필드 %s가 컨텍스트에 있다', (path) => {
    expect(resolveConditionField(path)).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(context, path)).toBe(true);
  });
});

describe('buildConditionContext: 매핑', () => {
  it('career.currentRole은 contract가 없으면 RESERVE다', () => {
    const context = buildConditionContext(buildTestState({ contract: null }));
    expect(context['career.currentRole']).toBe('RESERVE');
  });

  it('career.currentRole은 contract.rolePromise를 따른다', () => {
    const context = buildConditionContext(buildTestState({ contract: TEST_CONTRACT }));
    expect(context['career.currentRole']).toBe('STARTER');
  });

  it('player 필드는 profile이 null(DRAFT)이면 빈 문자열·0이다', () => {
    const context = buildConditionContext(buildTestState({ player: { draft: TEST_DRAFT, profile: null } }));
    expect(context['player.primaryPosition']).toBe('');
    expect(context['player.positionGroup']).toBe('');
    expect(context['player.archetypeId']).toBe('');
    expect(context['player.baseOvr']).toBe(0);
  });

  it('player.positionGroup은 포지션을 그룹으로 매핑한다', () => {
    const context = buildConditionContext(buildTestState({ player: { draft: TEST_DRAFT, profile: TEST_PROFILE } }));
    expect(context['player.positionGroup']).toBe('FWD');
  });

  it('season.tags는 Phase 1에서 항상 빈 배열이다', () => {
    const context = buildConditionContext(buildTestState());
    expect(context['season.tags']).toEqual([]);
  });
});

// T-3-001 D-53: 트랙 A·B 조건 DSL 화이트리스트 예약.
describe('buildConditionContext: T-3-001 신규 필드', () => {
  it('contract가 없으면 contract.* 신규 필드는 전부 NOT_MODELED 기본값이다', () => {
    const context = buildConditionContext(buildTestState({ contract: null }));
    expect(context['contract.kind']).toBe('');
    expect(context['contract.seasonsRemaining']).toBe(0);
    expect(context['contract.isLastSeason']).toBe(0);
    expect(context['contract.promiseBreaches']).toBe(0);
    expect(context['contract.onLoan']).toBe(0);
    expect(context['contract.leagueTier']).toBe('');
  });

  it('contract가 있으면 kind·leagueTier·onLoan·promiseBreaches를 그대로 낸다', () => {
    const context = buildConditionContext(
      buildTestState({ contract: { ...TEST_CONTRACT, promiseBreaches: 2 } }),
    );
    expect(context['contract.kind']).toBe('PERMANENT');
    expect(context['contract.leagueTier']).toBe('YOUTH');
    expect(context['contract.onLoan']).toBe(0);
    expect(context['contract.promiseBreaches']).toBe(2);
  });

  it('contract.onLoan은 kind가 LOAN이면 1이다', () => {
    const context = buildConditionContext(
      buildTestState({
        contract: {
          ...TEST_CONTRACT,
          kind: 'LOAN',
          loan: { parentTeamId: 'seoul-tier1', seasons: 1, wageShareBp: 5000, buyOptionMinor: null },
        },
      }),
    );
    expect(context['contract.onLoan']).toBe(1);
  });

  // career-06-settled처럼 시즌을 한 번 지난 상태를 합성해 lengthSeasons − 1을 확인한다.
  it('contract.seasonsRemaining은 서명 이후 SEASON_STARTED 횟수만큼 lengthSeasons에서 뺀다', () => {
    const contract = { ...TEST_CONTRACT, lengthSeasons: 3, signedAtRevision: 1 };
    const context = buildConditionContext(
      buildTestState({
        contract,
        timeline: [
          timelineEntry({ kind: 'CONTRACT_SIGNED', revision: 1 }),
          timelineEntry({ kind: 'SEASON_STARTED', revision: 2 }),
        ],
      }),
    );
    expect(context['contract.seasonsRemaining']).toBe(contract.lengthSeasons - 1);
    expect(context['contract.isLastSeason']).toBe(0);
  });

  it('contract.isLastSeason은 seasonsRemaining이 1 이하일 때만 1이다', () => {
    const contract = { ...TEST_CONTRACT, lengthSeasons: 1, signedAtRevision: 1 };
    const context = buildConditionContext(
      buildTestState({
        contract,
        timeline: [timelineEntry({ kind: 'CONTRACT_SIGNED', revision: 1 })],
      }),
    );
    expect(context['contract.seasonsRemaining']).toBe(1);
    expect(context['contract.isLastSeason']).toBe(1);
  });

  it('career.permanentTransfers·career.clubsCount는 clubHistory에서 유도된다', () => {
    const context = buildConditionContext(
      buildTestState({
        clubHistory: [
          { teamId: 'a', teamName: 'A', leagueTier: 'YOUTH', kind: 'PERMANENT', fromSeasonIndex: 1, toSeasonIndex: 2, endReason: 'TRANSFERRED', contractId: 'CTR-1' },
          { teamId: 'b', teamName: 'B', leagueTier: 1, kind: 'PERMANENT', fromSeasonIndex: 3, toSeasonIndex: null, endReason: null, contractId: 'CTR-2' },
        ],
      }),
    );
    expect(context['career.permanentTransfers']).toBe(1);
    expect(context['career.clubsCount']).toBe(2);
  });

  it('트랙 B 예약 필드는 전부 NOT_MODELED 기본값이다', () => {
    const context = buildConditionContext(buildTestState());
    expect(context['health.activeSeverity']).toBe('');
    expect(context['health.recurrenceRiskBp']).toBe(0);
    expect(context['health.majorInjuries']).toBe(0);
    expect(context['reputation.popularityCenti']).toBe(0);
    expect(context['season.manager.tenureSeasons']).toBe(0);
    expect(context['season.manager.id']).toBe('');
    expect(context['season.stats.recentFormAvg']).toBe(0);
  });
});
