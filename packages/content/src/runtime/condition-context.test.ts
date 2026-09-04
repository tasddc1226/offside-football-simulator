import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS } from '../schema/ruleset.ts';
import { CONDITION_FIELDS, SEASON_STATS, resolveConditionField } from '../schema/condition.ts';
import { buildConditionContext } from './condition-context.ts';
import { buildTestState, TEST_DRAFT, TEST_PROFILE, timelineEntry } from './build-test-state.ts';
import type { Contract, FootballSeason } from '@offside/domain';

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

  // PR #48 리뷰 수정: seasonsRemaining은 "지금 진행 중인 시즌 뒤에 남은 시즌 수"다 — 2시즌 계약을
  // 시즌 1 시작 전에 서명하면 시즌 1 진행 중 remaining 1(마지막 아님), 시즌 2 진행 중 remaining
  // 0(마지막). isLastSeason은 시즌이 실제로 진행 중일 때만(season !== null) remaining === 0으로 판단한다.
  it('contract.isLastSeason은 시즌 1 진행 중(마지막 아님)이면 0이다(2시즌 계약)', () => {
    const contract = { ...TEST_CONTRACT, lengthSeasons: 2, signedAtRevision: 1 };
    const context = buildConditionContext(
      buildTestState({
        contract,
        season: buildSeasonStub(),
        timeline: [
          timelineEntry({ kind: 'CONTRACT_SIGNED', revision: 1 }),
          timelineEntry({ kind: 'SEASON_STARTED', revision: 2 }),
        ],
      }),
    );
    expect(context['contract.seasonsRemaining']).toBe(1);
    expect(context['contract.isLastSeason']).toBe(0);
  });

  it('contract.isLastSeason은 시즌 2(마지막) 진행 중이면 1이다(같은 2시즌 계약)', () => {
    const contract = { ...TEST_CONTRACT, lengthSeasons: 2, signedAtRevision: 1 };
    const context = buildConditionContext(
      buildTestState({
        contract,
        season: buildSeasonStub(),
        timeline: [
          timelineEntry({ kind: 'CONTRACT_SIGNED', revision: 1 }),
          timelineEntry({ kind: 'SEASON_STARTED', revision: 2 }),
          timelineEntry({ kind: 'SEASON_STARTED', revision: 3 }),
        ],
      }),
    );
    expect(context['contract.seasonsRemaining']).toBe(0);
    expect(context['contract.isLastSeason']).toBe(1);
  });

  it('contract.isLastSeason은 시즌 사이(season === null)면 seasonsRemaining이 0이어도 0이다', () => {
    const contract = { ...TEST_CONTRACT, lengthSeasons: 2, signedAtRevision: 1 };
    const context = buildConditionContext(
      buildTestState({
        contract,
        season: null,
        timeline: [
          timelineEntry({ kind: 'CONTRACT_SIGNED', revision: 1 }),
          timelineEntry({ kind: 'SEASON_STARTED', revision: 2 }),
          timelineEntry({ kind: 'SEASON_STARTED', revision: 3 }),
        ],
      }),
    );
    expect(context['contract.seasonsRemaining']).toBe(0);
    expect(context['contract.isLastSeason']).toBe(0);
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

  // T-4-001: health.*·season.manager.*는 이제 실제 값을 낸다(활성 에피소드·manager 없음 →
  // NOT_MODELED와 같은 형태의 기본값). reputation.popularityCenti는 CareerState 기본값(5000)을
  // 그대로 낸다 — 더 이상 NOT_MODELED가 아니다. season.stats.recentFormAvg만 T-4-003 몫으로 남는다.
  it('트랙 B 필드는 에피소드·manager가 없으면 기본값이다(reputation 제외)', () => {
    const context = buildConditionContext(buildTestState());
    expect(context['health.activeSeverity']).toBe('');
    expect(context['health.recurrenceRiskBp']).toBe(0);
    expect(context['health.majorInjuries']).toBe(0);
    expect(context['reputation.popularityCenti']).toBe(5000);
    expect(context['season.manager.tenureSeasons']).toBe(0);
    expect(context['season.manager.id']).toBe('');
    expect(context['season.stats.recentFormAvg']).toBe(0);
  });

  it('health.*는 활성(ACTIVE) 에피소드가 있으면 그 값을 낸다', () => {
    const context = buildConditionContext(
      buildTestState({
        health: {
          episodes: [
            {
              id: 'INJ-1',
              severity: 'MAJOR',
              bodyPart: 'KNEE',
              occurredAt: { seasonIndex: 1, step: 3, matchId: 'M-1' },
              diagnosisRange: { minMatches: 4, maxMatches: 8 },
              rehab: null,
              recurrenceRiskBp: 1200,
              recurrenceChecksRemaining: 0,
              status: 'ACTIVE',
              permanentDelta: null,
              remainingMatches: 3,
            },
          ],
        },
      }),
    );
    expect(context['health.activeSeverity']).toBe('MAJOR');
    expect(context['health.recurrenceRiskBp']).toBe(1200);
    expect(context['health.majorInjuries']).toBe(1);
    expect(context['health.injuryEpisode']).toBe('1');
    expect(context['health.recurrenceRisk']).toBe(12);
  });

  it('health.activeSeverity는 RECOVERED 에피소드는 무시한다(활성 아님)', () => {
    const context = buildConditionContext(
      buildTestState({
        health: {
          episodes: [
            {
              id: 'INJ-1',
              severity: 'MINOR',
              bodyPart: 'ANKLE',
              occurredAt: { seasonIndex: 1, step: 1, matchId: 'M-0' },
              diagnosisRange: { minMatches: 1, maxMatches: 2 },
              rehab: 'STANDARD',
              recurrenceRiskBp: 300,
              recurrenceChecksRemaining: 0,
              status: 'RECOVERED',
              permanentDelta: null,
              remainingMatches: 0,
            },
          ],
        },
      }),
    );
    expect(context['health.activeSeverity']).toBe('');
    expect(context['health.injuryEpisode']).toBe('0');
    expect(context['health.majorInjuries']).toBe(0);
  });

  it('season.manager.*는 season.manager가 있으면 그 값을 낸다', () => {
    const context = buildConditionContext(
      buildTestState({
        season: { ...buildSeasonStub(), manager: { id: 'team-1-mgr-1', name: '박태식', preferredArchetypeIds: [], tenureSeasons: 2, trustBase: 50 } },
      }),
    );
    expect(context['season.manager.id']).toBe('team-1-mgr-1');
    expect(context['season.manager.tenureSeasons']).toBe(2);
  });
});

// isLastSeason 시즌 진행 중 분기 테스트 전용 최소 season 스텁. buildConditionContext는
// season !== null 여부만 본다(select-chapter-candidates.test.ts의 buildSeasonStub과 같은 패턴).
function buildSeasonStub(): FootballSeason {
  return {
    index: 1,
    serviceSeasonId: 'svc-test',
    simulationMode: 'FAST',
    calendarId: 'default',
    currentStep: 3,
    phase: 'LEAGUE',
    steps: [],
    teamId: 'team-1',
    styleId: 'style-1',
    squadRole: 'STARTER',
    squadRoleAtStart: 'STARTER',
    trainingFocus: 'ROLE',
    competitions: [],
    schedule: [],
    matches: [],
    ageReferenceStep: 1,
    squad: { competitors: [] },
    selection: { position: 'ST', slots: 1, benchSlots: 0, candidates: [], playerReason: null },
    playerStats: {
      group: 'FW',
      appearances: { total: 0, started: 0, sub: 0, zeroMinute: 0, out: 0 },
      minutes: 0,
      ratingSumTenths: 0,
      ratedMatches: 0,
      yellow: 0,
      red: 0,
      injuries: 0,
      totals: { group: 'FW', goals: 0, assists: 0, xgCenti: 0, shots: 0, offsides: 0 },
    },
    availability: null,
    lastRatingTenths: null,
    yellowSuspensionCount: 0,
    matchRngState: { s: [1, 2, 3, 4], draws: 0 },
    scheduledEffects: [],
    chapters: [],
    manager: null,
    injuryCount: 0,
  };
}
