import { describe, expect, it } from 'vitest';
import {
  evaluateCareerMilestones,
  evaluateSeasonAwards,
  realAppearances,
} from './awards.js';
import type { CareerState, Ruleset, SeasonPlayerStats, SeasonResult } from './index.js';

const groups = ['GK', 'DF', 'MF', 'FW'] as const;

function stats(group: (typeof groups)[number], minutes = 900): SeasonPlayerStats {
  const appearances = { total: minutes === 0 ? 4 : 12, started: minutes === 0 ? 0 : 10, sub: minutes === 0 ? 0 : 2, zeroMinute: minutes === 0 ? 4 : 0, out: 0 };
  const common = { group, appearances, minutes, ratingSumTenths: minutes === 0 ? 0 : 1020, ratedMatches: minutes === 0 ? 0 : 12, yellow: 0, red: 0, injuries: 0 };
  if (group === 'GK') return { ...common, totals: { group, saves: 40, psxgMinusGoalsCenti: 500, cleanSheet: 10, crossesClaimed: 15, buildUpPasses: 50 } };
  if (group === 'DF') return { ...common, totals: { group, tackles: 45, interceptions: 35, aerialsWon: 40, goalsConcededInvolved: 0, cleanSheet: 10 } };
  if (group === 'MF') return { ...common, totals: { group, assists: 12, chancesCreated: 50, progressivePasses: 80, passesAttempted: 500, passesCompleted: 450, ballRecoveries: 40 } };
  return { ...common, totals: { group, goals: 25, assists: 12, xgCenti: 2_400, shots: 80, offsides: 3 } };
}

function result(group: (typeof groups)[number], index = 1, minutes = 900): SeasonResult {
  const playerStats = stats(group, minutes);
  return {
    index,
    simulationMode: 'FAST',
    teamId: 'team-player',
    managerId: 'manager',
    captaincyAtEnd: 'NONE',
    competitions: [{ competitionId: 'league-1', kind: 'LEAGUE', played: 12, won: 8, drawn: 2, lost: 2, goalsFor: 25, goalsAgainst: 8, position: 1, cupRound: null }],
    finalLeagueTable: {
      policyVersion: '1.0.0', leagueId: 'league-1', leagueName: 'Test League', seasonIndex: index, teamId: 'team-player', completedRounds: 12,
      rows: [1, 2, 3, 4].map((rank) => [rank, rank === 1 ? 'team-player' : `team-${rank}`, `Team ${rank}`, 12, 8, 2, 2, 25, 8, 17, 26] as [number, string, string, number, number, number, number, number, number, number, number]),
    },
    playerStats,
    selectionSummary: { squadRoleAtStart: 'ROTATION', squadRoleAtEnd: 'STARTER', started: playerStats.appearances.started, sub: playerStats.appearances.sub, zeroMinute: playerStats.appearances.zeroMinute, out: 0, minutes, possibleMinutes: 1080, finalRank: 1 },
    roleChanges: [],
    promiseFulfilment: { promised: 'ROTATION', delivered: 'STARTER', fulfilled: true, minutesShareBp: 8000 },
    attributeDeltas: [],
    baseOvr: { before: 70, after: 71 },
    stateDeltas: { form: { before: 0, after: 0 }, fitness: { before: 0, after: 0 }, morale: { before: 0, after: 0 }, managerTrust: { before: 50, after: 50 } },
    chapters: [],
    stepSummaries: [],
    hash: 'fixture',
  };
}

function state(history: CareerState['seasonHistory'] = [], group: (typeof groups)[number] = 'FW'): CareerState {
  const matchStats = group === 'GK'
    ? { group, saves: 6, psxgMinusGoalsCenti: 60, cleanSheet: true, crossesClaimed: 2, buildUpPasses: 5 }
    : group === 'DF'
      ? { group, tackles: 6, interceptions: 4, aerialsWon: 5, goalsConcededInvolved: 0, cleanSheet: true }
      : group === 'MF'
        ? { group, assists: 1, chancesCreated: 6, progressivePasses: 8, passesAttempted: 40, passesCompleted: 35, ballRecoveries: 5 }
        : { group, goals: 2, assists: 1, xgCenti: 180, shots: 6, offsides: 0 };
  return {
    age: 19,
    rulesetVersion: '3.4.0',
    contentPackVersion: '0.13.0',
    seasonHistory: history,
    player: { profile: { name: 'Test Player', primaryPosition: group === 'GK' ? 'GK' : group === 'DF' ? 'CB' : group === 'MF' ? 'CM' : 'ST' } },
    season: { matches: Array.from({ length: 12 }, () => ({ kind: 'LEAGUE', minutes: 90, ratingTenths: 85, stats: matchStats })) },
    nationalTeam: { callUps: [], debuted: false, pendingDebut: null },
    clubHistory: [],
  } as unknown as CareerState;
}

function ruleset(): Ruleset {
  return {
    teams: [
      { id: 'team-player', squadStrength: 40 },
      { id: 'team-2', squadStrength: 40 },
      { id: 'team-3', squadStrength: 40 },
      { id: 'team-4', squadStrength: 40 },
    ],
    competitorNames: ['NPC A', 'NPC B', 'NPC C', 'NPC D'],
  } as unknown as Ruleset;
}

describe('candidate 3.4.0 recognition', () => {
  it('counts zero-minute and OUT records as no real appearance', () => {
    expect(realAppearances(stats('FW', 0))).toBe(0);
    expect(realAppearances(stats('FW'))).toBe(12);
    const zeroCareer = state([], 'FW');
    zeroCareer.season = { matches: [] } as unknown as CareerState['season'];
    expect(evaluateSeasonAwards(zeroCareer, ruleset(), result('FW', 1, 0))).toEqual([]);
    expect(evaluateCareerMilestones(zeroCareer, result('FW', 1, 0))).toEqual([]);
    const oneMinuteCareer = state([], 'FW');
    oneMinuteCareer.season = { matches: [{ kind: 'LEAGUE', minutes: 1, ratingTenths: 100, stats: { group: 'FW', goals: 1, assists: 0, xgCenti: 10, shots: 1, offsides: 0 } }] } as unknown as CareerState['season'];
    const oneMinuteAwards = evaluateSeasonAwards(oneMinuteCareer, ruleset(), result('FW', 1, 1));
    expect(oneMinuteAwards.some((award) => award.recipientId === 'PLAYER' && award.awardId === 'SEASON_MVP')).toBe(false);
    const thresholdAwards = evaluateSeasonAwards(state([], 'FW'), ruleset(), result('FW'));
    expect(thresholdAwards.some((award) => award.recipientId === 'PLAYER' && award.awardId === 'SEASON_MVP')).toBe(true);
  });

  it.each(groups)('keeps %s path position-aware and produces an 11-seat Best XI pool', (group) => {
    const current = result(group);
    const awards = evaluateSeasonAwards(state([], group), ruleset(), current);
    expect(awards.filter((award) => award.awardId === 'BEST_XI')).toHaveLength(11);
    expect(awards.every((award) => award.criteria.playerMinutes === 1080)).toBe(true);
  });

  it('uses league-only persisted match goals for scoring leader and remains replay deterministic', () => {
    const current = result('FW');
    const leagueGoals = 25;
    const career = state([], 'FW');
    (career.season as { matches: unknown[] }).matches = [
      { kind: 'LEAGUE', minutes: 90, ratingTenths: 85, stats: { group: 'FW', goals: leagueGoals } },
      { kind: 'CUP', minutes: 90, ratingTenths: 85, stats: { group: 'FW', goals: 99 } },
    ];
    const first = evaluateSeasonAwards(career, ruleset(), current);
    const second = evaluateSeasonAwards(career, ruleset(), current);
    expect(second).toEqual(first);
    const scoring = first.find((award) => award.awardId === 'SCORING_LEADER');
    expect(scoring?.recipientId).toBe('PLAYER');
    expect(scoring?.criteria.playerScore).toBe(leagueGoals);
    expect(current.playerStats.totals.group === 'FW' ? current.playerStats.totals.goals : 0).toBe(25);
  });

  it('grants each threshold only when crossed and does not repeat first appearance or one-club badge', () => {
    const previous = Array.from({ length: 4 }, (_, offset) => ({ ...result('FW', offset + 1), teamId: 'team-player', playerStats: stats('FW', 900) }));
    const current = result('FW', 5);
    const previousSummaries = previous.map((item) => ({ index: item.index, simulationMode: item.simulationMode, teamId: item.teamId, competitions: item.competitions, settledAtRevision: item.index, result: item }));
    const milestones = evaluateCareerMilestones(state(previousSummaries, 'FW'), current);
    expect(milestones.map((milestone) => milestone.milestoneId)).toEqual(['FIVE_SEASON_ONE_CLUB']);
    expect(evaluateCareerMilestones(state([{ ...previousSummaries[0]!, result: { ...previous[0]!, milestones: [{ milestoneId: 'FIRST_APPEARANCE', seasonIndex: 1, criteria: { realAppearances: 12, goals: 25, teamId: 'team-player' } }] } }]), result('FW', 2))).not.toContainEqual(expect.objectContaining({ milestoneId: 'FIRST_APPEARANCE' }));
  });
});
