// SCR-015/SCR-006 순수 파생 함수 단위 테스트(브리프 10번): 포지션군 4종의 "무관 지표 미포함",
// 미집계 규칙(평균 평점·패스 성공률), 원인 라벨용 최대 원인, 지난 시즌 비교 대상 유무를 검증한다.
import { loadRuleset } from '@offside/content';
import type { CareerState, PositionStatsTotals, SeasonResult, SeasonSummary } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { deriveSeasonResultView } from './season-result-view.js';

const ruleset = loadRuleset('1.0.0');
const TEAM_ID = 'seorabeol-united'; // 1부리그 소속 실제 팀(룰셋 데이터, 픽스처 아님).
const YOUTH_TEAM_ID = 'hangang-u18';

function totalsFor(group: PositionStatsTotals['group']): PositionStatsTotals {
  switch (group) {
    case 'FW':
      return { group: 'FW', goals: 12, assists: 4, xgCenti: 950, shots: 40, offsides: 6 };
    case 'MF':
      return { group: 'MF', assists: 8, chancesCreated: 20, progressivePasses: 60, passesAttempted: 0, passesCompleted: 0, ballRecoveries: 30 };
    case 'DF':
      return { group: 'DF', tackles: 45, interceptions: 30, aerialsWon: 22, goalsConcededInvolved: 18, cleanSheet: 10 };
    case 'GK':
      return { group: 'GK', saves: 60, psxgMinusGoalsCenti: 320, cleanSheet: 12, crossesClaimed: 15, buildUpPasses: 90 };
  }
}

function seasonResult(overrides: Partial<SeasonResult> = {}): SeasonResult {
  return {
    index: 1,
    simulationMode: 'FAST',
    teamId: TEAM_ID,
    competitions: [
      { competitionId: 'LEAGUE', kind: 'LEAGUE', played: 30, won: 18, drawn: 6, lost: 6, goalsFor: 55, goalsAgainst: 30, position: 2, cupRound: null },
      { competitionId: 'CUP', kind: 'CUP', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 5, goalsAgainst: 3, position: null, cupRound: 'R2' },
    ],
    playerStats: {
      group: 'FW',
      appearances: { total: 28, started: 24, sub: 4, zeroMinute: 2, out: 2 },
      minutes: 2100,
      ratingSumTenths: 28 * 68,
      ratedMatches: 28,
      yellow: 3,
      red: 0,
      injuries: 1,
      totals: totalsFor('FW'),
    },
    selectionSummary: { squadRoleAtStart: 'ROTATION', squadRoleAtEnd: 'STARTER', started: 24, sub: 4, zeroMinute: 2, out: 2, minutes: 2100, possibleMinutes: 2700, finalRank: 2 },
    roleChanges: [{ step: 6, type: 'ROLE_CHANGE', decision: 'ACCEPT' }],
    promiseFulfilment: { promised: 'ROTATION', delivered: 'STARTER', fulfilled: true, minutesShareBp: 7000 },
    attributeDeltas: [
      { key: 'shooting', delta: 3, causes: [{ cause: 'TRAINING', centi: 250 }, { cause: 'MINUTES', centi: 50 }] },
      { key: 'pace', delta: -1, causes: [{ cause: 'AGE_DECLINE', centi: -100 }] },
    ],
    baseOvr: { before: 61, after: 64 },
    stateDeltas: {
      form: { before: 55, after: 50 },
      fitness: { before: 70, after: 80 },
      morale: { before: 60, after: 60 },
      managerTrust: { before: 40, after: 48 },
    },
    chapters: [
      {
        chapterId: 'CHP-MATCH-001',
        version: 1,
        step: 9,
        matchId: 'm-9',
        importance: 'MAJOR',
        trigger: 'DEBUT',
        decisions: [{ decisionId: 'd1', optionId: 'o1', outcomeId: 'out1', outcomeKind: 'SUCCESS' }],
        ratingDeltaTenths: 5,
      },
    ],
    stepSummaries: [],
    hash: 'hash-season-1',
    ...overrides,
  };
}

function summary(result: SeasonResult): SeasonSummary {
  return { index: result.index, simulationMode: result.simulationMode, teamId: result.teamId, competitions: result.competitions, settledAtRevision: result.index * 10, result };
}

function baseState(overrides: Partial<CareerState>): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_test',
    status: 'ACTIVE',
    stage: 'PRO',
    age: 22,
    currentStep: 1,
    seasonPhase: 'SETTLEMENT',
    simulationMode: 'FAST',
    attributes: {} as CareerState['attributes'],
    growthCarryCenti: {} as CareerState['growthCarryCenti'],
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 12, squadStatus: 0, positionProficiency: 0 },
    relationships: { managerTrust: 8, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    careerTags: [],
    careerTagGrants: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: '김서준', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT', position: 'ST', archetypeId: 'inside-forward', backgroundId: 'club-academy' },
      profile: {
        name: '김서준',
        gender: 'UNSPECIFIED',
        nationalityCode: 'KR',
        preferredFoot: 'LEFT',
        preferredPosition: 'ST',
        primaryPosition: 'ST',
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
        truePotential: 78,
        scoutedPotentialMin: 65,
        scoutedPotentialMax: 80,
        baseOvr: 64,
      },
    },
    pending: null,
    contract: null,
    clubHistory: [],
    timeline: [],
    season: null,
    seasonHistory: [],
    health: { episodes: [] },
    relationshipLog: [],
    memoryTags: { managerTrust: [], captain: [], rival: [], fans: [], agent: [] },
    reputation: { popularityCenti: 5000, mediaCenti: 5000 },
    ...overrides,
  };
}

describe('deriveSeasonResultView', () => {
  it('seasonHistory[index]가 없으면 null이다', () => {
    expect(deriveSeasonResultView(baseState({ seasonHistory: [] }), 0, ruleset)).toBeNull();
  });

  it('profile이 없으면(아직 확정 전) null이다', () => {
    const state = baseState({ seasonHistory: [summary(seasonResult())], player: { draft: baseState({}).player.draft, profile: null } });
    expect(deriveSeasonResultView(state, 0, ruleset)).toBeNull();
  });

  it('FW: 득점·도움·xG·슈팅·오프사이드만 담고 다른 그룹 지표는 없다', () => {
    const state = baseState({ seasonHistory: [summary(seasonResult())] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.positionCard).toEqual({ group: 'FW', goals: 12, assists: 4, xgCenti: 950, shots: 40, offsides: 6 });
  });

  it('MF: 패스 시도가 0이면 패스 성공률은 미집계(null)다', () => {
    const result = seasonResult({ playerStats: { ...seasonResult().playerStats, group: 'MF', totals: totalsFor('MF') } });
    const state = baseState({ seasonHistory: [summary(result)] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.positionCard).toEqual({
      group: 'MF',
      assists: 8,
      chancesCreated: 20,
      progressivePasses: 60,
      passesAttempted: 0,
      passesCompleted: 0,
      passSuccessRatePercent: null,
      ballRecoveries: 30,
    });
  });

  it('MF: 패스 시도가 있으면 성공률을 반올림 퍼센트로 계산한다', () => {
    const totals: PositionStatsTotals = {
      group: 'MF',
      assists: 8,
      chancesCreated: 20,
      progressivePasses: 60,
      passesAttempted: 200,
      passesCompleted: 150,
      ballRecoveries: 30,
    };
    const result = seasonResult({ playerStats: { ...seasonResult().playerStats, group: 'MF', totals } });
    const state = baseState({ seasonHistory: [summary(result)] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.positionCard).toMatchObject({ group: 'MF', passSuccessRatePercent: 75 });
  });

  it('DF: 태클·인터셉트·공중볼·실점 관여·클린시트만 담는다', () => {
    const result = seasonResult({ playerStats: { ...seasonResult().playerStats, group: 'DF', totals: totalsFor('DF') } });
    const state = baseState({ seasonHistory: [summary(result)] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.positionCard).toEqual({ group: 'DF', tackles: 45, interceptions: 30, aerialsWon: 22, goalsConcededInvolved: 18, cleanSheet: 10 });
  });

  it('GK: 세이브·PSxG−실점·클린시트·크로스 처리·빌드업 패스만 담는다', () => {
    const result = seasonResult({ playerStats: { ...seasonResult().playerStats, group: 'GK', totals: totalsFor('GK') } });
    const state = baseState({ seasonHistory: [summary(result)] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.positionCard).toEqual({ group: 'GK', saves: 60, psxgMinusGoalsCenti: 320, cleanSheet: 12, crossesClaimed: 15, buildUpPasses: 90 });
  });

  it('ratedMatches가 0이면 평균 평점은 미집계(null)다', () => {
    const result = seasonResult({ playerStats: { ...seasonResult().playerStats, ratedMatches: 0, ratingSumTenths: 0 } });
    const state = baseState({ seasonHistory: [summary(result)] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.common.avgRatingTenths).toBeNull();
  });

  it('ratedMatches가 있으면 반올림한 평균 평점(tenths)을 담는다', () => {
    const state = baseState({ seasonHistory: [summary(seasonResult())] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.common.avgRatingTenths).toBe(68);
  });

  it('원인별 centi 합의 절대값이 가장 큰 원인을 topCause로 고른다(TRAINING 250+50=300 > AGE_DECLINE -100)', () => {
    const state = baseState({ seasonHistory: [summary(seasonResult())] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.topCause).toBe('TRAINING');
  });

  it('attributeDeltas가 비어 있으면 topCause는 null이다', () => {
    const result = seasonResult({ attributeDeltas: [] });
    const state = baseState({ seasonHistory: [summary(result)] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.topCause).toBeNull();
    expect(view?.attributeDeltaGroups).toEqual([]);
  });

  it('첫 시즌(index 0)은 previousResult가 없다(지난 시즌 비교 불가)', () => {
    const state = baseState({ seasonHistory: [summary(seasonResult({ index: 1 }))] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.previousResult).toBeNull();
  });

  it('두 번째 시즌은 previousResult에 직전 시즌 result가 담긴다', () => {
    const first = seasonResult({ index: 1, hash: 'hash-1' });
    const second = seasonResult({ index: 2, hash: 'hash-2' });
    const state = baseState({ seasonHistory: [summary(first), summary(second)] });
    const view = deriveSeasonResultView(state, 1, ruleset);
    expect(view?.previousResult?.hash).toBe('hash-1');
  });

  it('YOUTH 팀 소속이면 isYouth가 true이고 정찰 범위를 담는다', () => {
    const result = seasonResult({ teamId: YOUTH_TEAM_ID });
    const state = baseState({ seasonHistory: [summary(result)] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.isYouth).toBe(true);
    expect(view).toMatchObject({ scoutedPotentialMin: 65, scoutedPotentialMax: 80 });
  });

  it('리그 순위가 없으면(집계 전) "—", 있으면 "N위/M팀"이다', () => {
    const noPosition = seasonResult({ competitions: [{ ...seasonResult().competitions[0]!, position: null }] });
    const state = baseState({ seasonHistory: [summary(noPosition)] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.teamRecords[0]?.standingText).toBe('—');

    const withPosition = baseState({ seasonHistory: [summary(seasonResult())] });
    const withView = deriveSeasonResultView(withPosition, 0, ruleset);
    expect(withView?.teamRecords[0]?.standingText).toBe(`2위/${ruleset.leagues.find((l) => l.id === 'league-tier1')?.teamCount}팀`);
  });

  it('컵 라운드는 한글 라벨로 보여준다(R2 → "2라운드")', () => {
    const state = baseState({ seasonHistory: [summary(seasonResult())] });
    const view = deriveSeasonResultView(state, 0, ruleset);
    expect(view?.teamRecords[1]).toMatchObject({ kind: 'CUP', standingText: '2라운드' });
  });
});
