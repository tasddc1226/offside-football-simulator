import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { buildSchedule, findLeague } from './schedule.js';
import { buildInitialCompetitions } from './season.js';
import {
  applyMatchToCompetitions,
  applyMatchToPlayerStats,
  applyPlayedMatch,
  computeLeaguePosition,
  initialSeasonPlayerStats,
  markCupEliminated,
  stepMatchResultsFor,
  type SeasonMatchBooks,
} from './season-stats.js';
import type { CompetitionRecord, MatchRecord } from './types.js';

const team = rulesetProto.teams.find((candidate) => candidate.id === 'seoul-tier1')!;
const league = findLeague(rulesetProto, team.leagueId);
const calendar = rulesetProto.leagueCalendar;
const schedule = buildSchedule(rulesetProto, team);

function buildMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: '1-3-0',
    step: 3,
    order: 0,
    competitionId: 'LEAGUE',
    kind: 'LEAGUE',
    round: null,
    opponent: { id: 'league-tier1-opp-1', name: '상대', strength: 60 },
    home: true,
    result: { goalsFor: 2, goalsAgainst: 1, outcome: 'WIN' },
    appearance: 'START',
    outReason: null,
    minutes: 90,
    involvement: 60,
    stats: { group: 'FW', goals: 1, assists: 0, xgCenti: 50, shots: 3, offsides: 0 },
    ratingTenths: 70,
    cards: { yellow: 0, red: false },
    injuredOff: false,
    chapterId: null,
    ...overrides,
  };
}

describe('applyMatchToPlayerStats', () => {
  it('appearances·minutes·ratingSum·카드·부상·totals를 정확히 누적한다', () => {
    const initial = initialSeasonPlayerStats('FW');
    const match = buildMatch();
    const next = applyMatchToPlayerStats(initial, match);
    expect(next.appearances).toEqual({ total: 1, started: 1, sub: 0, zeroMinute: 0, out: 0 });
    expect(next.minutes).toBe(90);
    expect(next.ratingSumTenths).toBe(70);
    expect(next.ratedMatches).toBe(1);
    expect(next.yellow).toBe(0);
    expect(next.red).toBe(0);
    expect(next.injuries).toBe(0);
    expect(next.totals).toEqual({ group: 'FW', goals: 1, assists: 0, xgCenti: 50, shots: 3, offsides: 0 });
  });

  it('0분 경기는 zeroMinute·out으로 집계되고 ratedMatches는 늘지 않는다', () => {
    const initial = initialSeasonPlayerStats('FW');
    const match = buildMatch({ appearance: 'OUT', outReason: 'NOT_SELECTED', minutes: 0, ratingTenths: null, result: { goalsFor: 0, goalsAgainst: 0, outcome: 'DRAW' }, stats: { group: 'FW', goals: 0, assists: 0, xgCenti: 0, shots: 0, offsides: 0 } });
    const next = applyMatchToPlayerStats(initial, match);
    expect(next.appearances).toEqual({ total: 1, started: 0, sub: 0, zeroMinute: 1, out: 1 });
    expect(next.ratedMatches).toBe(0);
    expect(next.ratingSumTenths).toBe(0);
  });

  it('카드·부상이 여러 경기에 걸쳐 누적된다', () => {
    let stats = initialSeasonPlayerStats('DF');
    stats = applyMatchToPlayerStats(
      stats,
      buildMatch({ stats: { group: 'DF', tackles: 1, interceptions: 1, aerialsWon: 1, goalsConcededInvolved: 0, cleanSheet: true }, cards: { yellow: 1, red: false } }),
    );
    stats = applyMatchToPlayerStats(
      stats,
      buildMatch({
        id: '1-4-0',
        stats: { group: 'DF', tackles: 2, interceptions: 0, aerialsWon: 1, goalsConcededInvolved: 1, cleanSheet: false },
        cards: { yellow: 0, red: true },
        injuredOff: true,
      }),
    );
    expect(stats.yellow).toBe(1);
    expect(stats.red).toBe(1);
    expect(stats.injuries).toBe(1);
    expect(stats.totals).toEqual({ group: 'DF', tackles: 3, interceptions: 1, aerialsWon: 2, goalsConcededInvolved: 1, cleanSheet: 1 });
  });
});

describe('applyMatchToCompetitions', () => {
  const initial = buildInitialCompetitions(calendar);

  it('LEAGUE 경기는 played·승무패·득실을 누적하고 position을 그대로 반영한다', () => {
    const match = buildMatch();
    const next = applyMatchToCompetitions(initial, match, 5, calendar);
    const leagueRecord = next.find((c) => c.competitionId === 'LEAGUE')!;
    expect(leagueRecord).toEqual({
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 1,
      position: 5,
      cupRound: null,
    });
  });

  it('CUP 경기는 이기거나 비기면 다음 라운드로, 지면 OUT_{round}로 갱신한다', () => {
    const cupMatch = buildMatch({ competitionId: 'CUP', kind: 'CUP', round: 'R1', result: { goalsFor: 1, goalsAgainst: 0, outcome: 'WIN' } });
    const afterWin = applyMatchToCompetitions(initial, cupMatch, null, calendar);
    expect(afterWin.find((c) => c.competitionId === 'CUP')!.cupRound).toBe('R2');

    const drawMatch = buildMatch({ competitionId: 'CUP', kind: 'CUP', round: 'R1', result: { goalsFor: 1, goalsAgainst: 1, outcome: 'DRAW' } });
    const afterDraw = applyMatchToCompetitions(initial, drawMatch, null, calendar);
    expect(afterDraw.find((c) => c.competitionId === 'CUP')!.cupRound).toBe('R2');

    const lossMatch = buildMatch({ competitionId: 'CUP', kind: 'CUP', round: 'R1', result: { goalsFor: 0, goalsAgainst: 1, outcome: 'LOSS' } });
    const afterLoss = applyMatchToCompetitions(initial, lossMatch, null, calendar);
    expect(afterLoss.find((c) => c.competitionId === 'CUP')!.cupRound).toBe('OUT_R1');
  });

  it('FINAL을 이기면 WON으로 끝난다', () => {
    const finalWin = buildMatch({ competitionId: 'CUP', kind: 'CUP', round: 'FINAL', result: { goalsFor: 2, goalsAgainst: 0, outcome: 'WIN' } });
    const next = applyMatchToCompetitions(initial, finalWin, null, calendar);
    expect(next.find((c) => c.competitionId === 'CUP')!.cupRound).toBe('WON');
  });
});

describe('markCupEliminated', () => {
  it('탈락 이후(afterStep보다 뒤) 컵 일정만 skipped:ELIMINATED로 표시하고 리그·이전 컵은 건드리지 않는다', () => {
    const marked = markCupEliminated(schedule, 5);
    const cupEntries = marked.filter((entry) => entry.kind === 'CUP');
    expect(cupEntries.find((entry) => entry.step === 5)!.skipped).toBeUndefined();
    expect(cupEntries.find((entry) => entry.step === 7)!.skipped).toBe('ELIMINATED');
    expect(cupEntries.find((entry) => entry.step === 9)!.skipped).toBe('ELIMINATED');
    expect(cupEntries.find((entry) => entry.step === 11)!.skipped).toBe('ELIMINATED');
    expect(marked.filter((entry) => entry.kind === 'LEAGUE').every((entry) => entry.skipped === undefined)).toBe(true);
  });
});

describe('computeLeaguePosition — 단조성', () => {
  it('순위는 항상 1~teamCount 범위 안에 있다', () => {
    for (const points of [0, 5, 10, 20, 30, 40, 50, 60]) {
      const position = computeLeaguePosition(rulesetProto, league, schedule, team.id, team.squadStrength, 22, points);
      expect(position).toBeGreaterThanOrEqual(1);
      expect(position).toBeLessThanOrEqual(league.teamCount);
    }
  });

  it('승점이 많을수록 순위(숫자)가 같거나 더 좋아진다(단조 비증가)', () => {
    let previousPosition = Number.POSITIVE_INFINITY;
    for (let points = 0; points <= 66; points += 3) {
      const position = computeLeaguePosition(rulesetProto, league, schedule, team.id, team.squadStrength, 22, points);
      expect(position).toBeLessThanOrEqual(previousPosition);
      previousPosition = position;
    }
  });

  it('승점 0이면 최하위권(teamCount)이고, 만점(3×played)이면 1위다', () => {
    const worst = computeLeaguePosition(rulesetProto, league, schedule, team.id, team.squadStrength, 22, 0);
    const best = computeLeaguePosition(rulesetProto, league, schedule, team.id, team.squadStrength, 22, 66);
    expect(worst).toBe(league.teamCount);
    expect(best).toBe(1);
  });
});

describe('applyPlayedMatch — 경기 하나를 시즌 기록에 한 번에 반영', () => {
  it('LEAGUE 경기 반영 시 matches·playerStats·competitions(position 포함)가 함께 갱신된다', () => {
    const books: SeasonMatchBooks = {
      matches: [],
      competitions: buildInitialCompetitions(calendar),
      playerStats: initialSeasonPlayerStats('FW'),
      schedule,
    };
    const match = buildMatch();
    const next = applyPlayedMatch(rulesetProto, team, league, calendar, books, match);
    expect(next.matches).toEqual([match]);
    expect(next.playerStats.appearances.started).toBe(1);
    const leagueRecord = next.competitions.find((c: CompetitionRecord) => c.competitionId === 'LEAGUE')!;
    expect(leagueRecord.played).toBe(1);
    expect(leagueRecord.position).not.toBeNull();
    expect(next.schedule).toBe(schedule);
  });

  it('CUP 경기 패배 시 이후 컵 일정이 ELIMINATED로 표시된다', () => {
    const books: SeasonMatchBooks = {
      matches: [],
      competitions: buildInitialCompetitions(calendar),
      playerStats: initialSeasonPlayerStats('FW'),
      schedule,
    };
    const lossMatch = buildMatch({
      id: '1-5-1',
      step: 5,
      order: 1,
      competitionId: 'CUP',
      kind: 'CUP',
      round: 'R1',
      result: { goalsFor: 0, goalsAgainst: 1, outcome: 'LOSS' },
    });
    const next = applyPlayedMatch(rulesetProto, team, league, calendar, books, lossMatch);
    const cupRecord = next.competitions.find((c: CompetitionRecord) => c.competitionId === 'CUP')!;
    expect(cupRecord.cupRound).toBe('OUT_R1');
    expect(next.schedule.filter((entry) => entry.kind === 'CUP' && entry.step > 5).every((entry) => entry.skipped === 'ELIMINATED')).toBe(true);
  });
});

describe('stepMatchResultsFor', () => {
  it('해당 step의 경기만 order 오름차순으로 StepMatchResult[]를 만든다', () => {
    const matches = [
      buildMatch({ id: 'a', step: 3, order: 1 }),
      buildMatch({ id: 'b', step: 3, order: 0 }),
      buildMatch({ id: 'c', step: 4, order: 0 }),
    ];
    const results = stepMatchResultsFor(matches, 3);
    expect(results.map((r) => r.matchId)).toEqual(['b', 'a']);
    expect(results[0]).toEqual({
      matchId: 'b',
      outcome: matches[1]!.result.outcome,
      goalsFor: matches[1]!.result.goalsFor,
      goalsAgainst: matches[1]!.result.goalsAgainst,
      appearance: matches[1]!.appearance,
      ratingTenths: matches[1]!.ratingTenths,
    });
  });
});
