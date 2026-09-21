import { describe, expect, it } from 'vitest';
import { initialSeasonPlayerStats } from './season-stats.js';
import {
  applySettlementReputation,
  computeSettlementPopularityDelta,
  seasonWonTitle,
} from './reputation.js';
import { rulesetProto, runCareerFixture } from './__fixtures__/career-01.js';
import { statGroupOf, type CompetitionRecord, type SeasonResult } from './types.js';

function makeResult(overrides: Partial<SeasonResult> = {}): SeasonResult {
  return {
    index: 1,
    simulationMode: 'FAST',
    teamId: 'team-1',
    managerId: 'manager-1',
    captaincyAtEnd: 'NONE',
    competitions: [],
    playerStats: initialSeasonPlayerStats(statGroupOf('ST')),
    selectionSummary: {
      squadRoleAtStart: 'ROTATION',
      squadRoleAtEnd: 'ROTATION',
      started: 0,
      sub: 0,
      zeroMinute: 0,
      out: 0,
      minutes: 0,
      possibleMinutes: 0,
      finalRank: 1,
    },
    roleChanges: [],
    promiseFulfilment: {
      promised: 'ROTATION',
      delivered: 'ROTATION',
      fulfilled: true,
      minutesShareBp: 0,
    },
    attributeDeltas: [],
    baseOvr: { before: 60, after: 60 },
    stateDeltas: {
      form: { before: 50, after: 50 },
      fitness: { before: 80, after: 80 },
      morale: { before: 60, after: 60 },
      managerTrust: { before: 50, after: 50 },
    },
    chapters: [],
    stepSummaries: [],
    hash: 'test-hash',
    ...overrides,
  };
}

function stats(ratingSumTenths: number, ratedMatches: number): SeasonResult['playerStats'] {
  return { ...initialSeasonPlayerStats(statGroupOf('ST')), ratingSumTenths, ratedMatches };
}

function competition(overrides: Partial<CompetitionRecord>): CompetitionRecord {
  return {
    competitionId: 'COMP-1',
    kind: 'LEAGUE',
    played: 1,
    won: 1,
    drawn: 0,
    lost: 0,
    goalsFor: 1,
    goalsAgainst: 0,
    position: null,
    cupRound: null,
    ...overrides,
  };
}

describe('settlement reputation pure functions', () => {
  it('평균 평점·주전·타이틀이 없으면 decay만 적용한다', () => {
    expect(computeSettlementPopularityDelta(makeResult(), rulesetProto.reputationRules)).toBe(-100);
  });

  it('STARTER 시즌은 starterSeasonCenti를 더한다', () => {
    const result = makeResult({
      selectionSummary: { ...makeResult().selectionSummary, squadRoleAtEnd: 'STARTER' },
    });
    expect(computeSettlementPopularityDelta(result, rulesetProto.reputationRules)).toBe(200);
  });

  it('평균 평점 70 경계에서만 ratingAbove70Centi를 더한다', () => {
    const below = makeResult({ playerStats: stats(690, 10) });
    const at = makeResult({ playerStats: stats(700, 10) });
    expect(computeSettlementPopularityDelta(below, rulesetProto.reputationRules)).toBe(-100);
    expect(computeSettlementPopularityDelta(at, rulesetProto.reputationRules)).toBe(100);
  });

  it('리그 position 1과 컵 WON은 각각 titleCenti를 더한다', () => {
    const leagueWinner = makeResult({ competitions: [competition({ position: 1 })] });
    const cupWinner = makeResult({
      competitions: [competition({ kind: 'CUP', position: null, cupRound: 'WON' })],
    });
    expect(seasonWonTitle(leagueWinner)).toBe(true);
    expect(seasonWonTitle(cupWinner)).toBe(true);
    expect(computeSettlementPopularityDelta(leagueWinner, rulesetProto.reputationRules)).toBe(400);
    expect(computeSettlementPopularityDelta(cupWinner, rulesetProto.reputationRules)).toBe(400);
  });

  it('promotion zone은 실제 승격 이동 없이 후보 ruleset의 평판 보상만 더한다', () => {
    const candidateRuleset = {
      ...rulesetProto,
      reputationRules: {
        ...rulesetProto.reputationRules,
        settlement: { ...rulesetProto.reputationRules.settlement, promotionCenti: 250 },
      },
    };
    const zone = makeResult({
      competitions: [competition({ competitionId: 'league-tier2', position: 2 })],
    });
    const outside = makeResult({
      competitions: [competition({ competitionId: 'league-tier2', position: 3 })],
    });
    const base = computeSettlementPopularityDelta(zone, rulesetProto.reputationRules);
    expect(
      computeSettlementPopularityDelta(zone, candidateRuleset.reputationRules, candidateRuleset),
    ).toBe(base + 250);
    expect(
      computeSettlementPopularityDelta(outside, candidateRuleset.reputationRules, candidateRuleset),
    ).toBe(computeSettlementPopularityDelta(outside, rulesetProto.reputationRules));
  });

  it('결산 적용은 popularity만 clamp하고 media를 불변으로 둔다', () => {
    const base = runCareerFixture();
    const result = makeResult({
      selectionSummary: { ...makeResult().selectionSummary, squadRoleAtEnd: 'STARTER' },
      playerStats: stats(70, 1),
      competitions: [competition({ position: 1 })],
    });
    const high = applySettlementReputation(
      { ...base.state, reputation: { popularityCenti: 9_900, mediaCenti: 4_321 } },
      result,
      rulesetProto,
    );
    const low = applySettlementReputation(
      { ...base.state, reputation: { popularityCenti: 50, mediaCenti: 4_321 } },
      makeResult(),
      rulesetProto,
    );

    expect(high.reputation.popularityCenti).toBe(10_000);
    expect(high.reputation.mediaCenti).toBe(4_321);
    expect(low.reputation.popularityCenti).toBe(0);
    expect(low.reputation.mediaCenti).toBe(4_321);
  });
});
