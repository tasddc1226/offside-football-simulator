import { compareCodePoints } from './canonical.js';
import { roll100, rollInt, seedRng, type RngState } from './rng.js';
import { buildLeagueFixtures, buildLeagueRoster } from './schedule.js';
import type { League, Ruleset, Team } from './ruleset.js';
import type {
  CompetitionRecord,
  FinalLeagueTable,
  LeagueFixture,
  LeagueFixtureResult,
  LeagueSeasonLedger,
  MatchRecord,
  ScheduleEntry,
  StandingRow,
} from './types.js';

function fixtureScore(
  ruleset: Ruleset,
  ledger: LeagueSeasonLedger,
  fixture: LeagueFixture,
): LeagueFixtureResult {
  const home = ledger.teams.find((team) => team.teamId === fixture.homeTeamId);
  const away = ledger.teams.find((team) => team.teamId === fixture.awayTeamId);
  if (home === undefined || away === undefined) {
    throw new RangeError(`fixtureScore: fixture '${fixture.fixtureId}'의 팀 snapshot이 없다.`);
  }
  const rules = ruleset.matchRules;
  const diff = home.strength - away.strength + rules.homeBonus;
  const resultRow = rules.resultTable.find((row) => diff >= row.diffMin && diff <= row.diffMax);
  if (resultRow === undefined) {
    throw new RangeError(`fixtureScore: diff ${diff}를 담는 resultTable 구간이 없다.`);
  }
  let rng: RngState = seedRng(
    `league:${ledger.policyVersion}:${ledger.seasonIndex}:${ledger.leagueId}:${ledger.seed.join(',')}:${fixture.fixtureId}`,
  );
  const outcomeRoll = roll100(rng);
  rng = outcomeRoll.state;
  const outcome = outcomeRoll.value <= resultRow.win
    ? 'HOME_WIN'
    : outcomeRoll.value <= resultRow.win + resultRow.draw
      ? 'DRAW'
      : 'AWAY_WIN';

  let homeGoals: number;
  let awayGoals: number;
  if (outcome === 'DRAW') {
    const drawn = rollInt(rng, rules.scoreTable.drawGoals.length);
    rng = drawn.state;
    homeGoals = rules.scoreTable.drawGoals[drawn.value]!;
    // 기존 playMatch와 같은 고정 팀 결과 draw 수를 유지하되 값은 사용하지 않는다.
    rollInt(rng, rules.scoreTable.loserGoalsRaw.length);
    awayGoals = homeGoals;
  } else {
    const winner = rollInt(rng, rules.scoreTable.winnerGoals.length);
    rng = winner.state;
    const loser = rollInt(rng, rules.scoreTable.loserGoalsRaw.length);
    const winnerGoals = rules.scoreTable.winnerGoals[winner.value]!;
    const loserGoals = Math.min(rules.scoreTable.loserGoalsRaw[loser.value]!, winnerGoals - 1);
    homeGoals = outcome === 'HOME_WIN' ? winnerGoals : loserGoals;
    awayGoals = outcome === 'AWAY_WIN' ? winnerGoals : loserGoals;
  }
  return {
    fixtureId: fixture.fixtureId,
    round: fixture.round,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeGoals,
    awayGoals,
  };
}

function fixtureMap(ledger: LeagueSeasonLedger): Map<string, LeagueFixture> {
  return new Map(
    buildLeagueFixtures(ledger.seasonIndex, ledger.leagueId, ledger.teams).map((fixture) => [fixture.fixtureId, fixture]),
  );
}

export function assertLeagueLedgerInvariant(ledger: LeagueSeasonLedger): void {
  const rosterIds = new Set<string>();
  for (const team of ledger.teams) {
    if (rosterIds.has(team.teamId)) throw new RangeError(`league ledger: roster team '${team.teamId}' 중복.`);
    rosterIds.add(team.teamId);
  }
  if (!ledger.teams.some((team) => team.teamId === ledger.teamId)) {
    throw new RangeError(`league ledger: 소속 팀 '${ledger.teamId}'이 roster에 없다.`);
  }
  const known = fixtureMap(ledger);
  const resultIds = new Set<string>();
  for (const result of ledger.results) {
    if (resultIds.has(result.fixtureId)) throw new RangeError(`league ledger: fixture '${result.fixtureId}' 결과 중복.`);
    resultIds.add(result.fixtureId);
    const fixture = known.get(result.fixtureId);
    if (
      fixture === undefined ||
      fixture.round !== result.round ||
      fixture.homeTeamId !== result.homeTeamId ||
      fixture.awayTeamId !== result.awayTeamId
    ) {
      throw new RangeError(`league ledger: fixture '${result.fixtureId}' identity 불일치.`);
    }
    if (
      !Number.isSafeInteger(result.homeGoals) || result.homeGoals < 0 ||
      !Number.isSafeInteger(result.awayGoals) || result.awayGoals < 0
    ) {
      throw new RangeError(`league ledger: fixture '${result.fixtureId}' 스코어가 비정상이다.`);
    }
  }
  const completed = new Set<number>();
  for (const round of ledger.completedRounds) {
    if (completed.has(round)) throw new RangeError(`league ledger: 완료 round ${round} 중복.`);
    completed.add(round);
  }
  const rounds = new Set([...known.values()].map((fixture) => fixture.round));
  for (const round of completed) {
    if (!rounds.has(round)) throw new RangeError(`league ledger: 존재하지 않는 완료 round ${round}.`);
  }
  for (const round of rounds) {
    const expected = [...known.values()].filter((fixture) => fixture.round === round).length;
    const actual = ledger.results.filter((result) => result.round === round).length;
    if (actual !== 0 && actual !== expected) {
      throw new RangeError(`league ledger: round ${round} 결과가 부분 집합 ${actual}/${expected}이다.`);
    }
    if (completed.has(round) !== (actual === expected)) {
      throw new RangeError(`league ledger: round ${round} 완료 표식(${completed.has(round)})과 결과 ${actual}/${expected} 불일치.`);
    }
  }
}

export function createLeagueSeasonLedger(
  ruleset: Ruleset,
  team: Team,
  league: League,
  seasonIndex: number,
  seed: RngState['s'],
): LeagueSeasonLedger | undefined {
  const policy = ruleset.leagueLedgerRules;
  if (policy === undefined) return undefined;
  const teams = buildLeagueRoster(ruleset, team, league);
  if (teams.length > policy.maxTeamCount) {
    throw new RangeError(`createLeagueSeasonLedger: teamCount ${teams.length}가 최대 ${policy.maxTeamCount}를 초과한다.`);
  }
  const ledger: LeagueSeasonLedger = {
    policyVersion: policy.policyVersion,
    leagueId: league.id,
    leagueName: league.name,
    seasonIndex,
    teamId: team.id,
    seed: [...seed] as [number, number, number, number],
    teams,
    results: [],
    completedRounds: [],
  };
  assertLeagueLedgerInvariant(ledger);
  return ledger;
}

export function recordPlayerLeagueResult(
  ledger: LeagueSeasonLedger,
  entry: ScheduleEntry,
  match: MatchRecord,
): LeagueSeasonLedger {
  if (entry.kind !== 'LEAGUE' || entry.fixtureId === undefined || entry.leagueRound === undefined) return ledger;
  const fixture = fixtureMap(ledger).get(entry.fixtureId);
  if (fixture === undefined) throw new RangeError(`recordPlayerLeagueResult: fixture '${entry.fixtureId}'가 없다.`);
  const homeGoals = entry.home ? match.result.goalsFor : match.result.goalsAgainst;
  const awayGoals = entry.home ? match.result.goalsAgainst : match.result.goalsFor;
  const result: LeagueFixtureResult = {
    fixtureId: fixture.fixtureId,
    round: fixture.round,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeGoals,
    awayGoals,
  };
  const existing = ledger.results.find((candidate) => candidate.fixtureId === result.fixtureId);
  if (existing !== undefined) {
    if (JSON.stringify(existing) !== JSON.stringify(result)) {
      throw new RangeError(`recordPlayerLeagueResult: fixture '${result.fixtureId}'의 기존 결과와 충돌한다.`);
    }
    return ledger;
  }
  return { ...ledger, results: [...ledger.results, result] };
}

/** 선수 경기 결과가 있거나 선수가 BYE인 round만 나머지 타팀전까지 한 번에 확정한다. */
export function completeLeagueRoundsForStep(
  ruleset: Ruleset,
  ledger: LeagueSeasonLedger,
  step: number,
): LeagueSeasonLedger {
  const fixtures = [...fixtureMap(ledger).values()];
  let next = ledger;
  const rounds = [...new Set(fixtures.filter((fixture) => fixture.step === step).map((fixture) => fixture.round))].sort((a, b) => a - b);
  for (const round of rounds) {
    if (next.completedRounds.includes(round)) continue;
    const roundFixtures = fixtures.filter((fixture) => fixture.round === round);
    const playerFixture = roundFixtures.find(
      (fixture) => fixture.homeTeamId === next.teamId || fixture.awayTeamId === next.teamId,
    );
    if (playerFixture !== undefined && !next.results.some((result) => result.fixtureId === playerFixture.fixtureId)) {
      continue;
    }
    const existing = new Set(next.results.map((result) => result.fixtureId));
    const generated = roundFixtures
      .filter((fixture) => !existing.has(fixture.fixtureId))
      .map((fixture) => fixtureScore(ruleset, next, fixture));
    next = {
      ...next,
      results: [...next.results, ...generated].sort(
        (a, b) => a.round - b.round || compareCodePoints(a.fixtureId, b.fixtureId),
      ),
      completedRounds: [...next.completedRounds, round].sort((a, b) => a - b),
    };
  }
  assertLeagueLedgerInvariant(next);
  return next;
}

export function standingsFromLedger(ruleset: Ruleset, ledger: LeagueSeasonLedger): StandingRow[] {
  const policy = ruleset.leagueLedgerRules;
  if (policy === undefined || policy.policyVersion !== ledger.policyVersion) {
    throw new RangeError(`standingsFromLedger: ruleset '${ruleset.version}'은 ledger '${ledger.policyVersion}'를 지원하지 않는다.`);
  }
  const rows = new Map<string, Omit<StandingRow, 'rank' | 'goalDifference' | 'points'>>(
    ledger.teams.map((team) => [team.teamId, {
      teamId: team.teamId,
      teamName: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }]),
  );
  for (const result of ledger.results) {
    const home = rows.get(result.homeTeamId);
    const away = rows.get(result.awayTeamId);
    if (home === undefined || away === undefined) throw new RangeError('standingsFromLedger: 결과 팀이 roster에 없다.');
    home.played += 1;
    away.played += 1;
    home.goalsFor += result.homeGoals;
    home.goalsAgainst += result.awayGoals;
    away.goalsFor += result.awayGoals;
    away.goalsAgainst += result.homeGoals;
    if (result.homeGoals > result.awayGoals) {
      home.won += 1;
      away.lost += 1;
    } else if (result.homeGoals < result.awayGoals) {
      away.won += 1;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
    }
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      rank: 0,
      goalDifference: row.goalsFor - row.goalsAgainst,
      points: row.won * policy.points.win + row.drawn * policy.points.draw + row.lost * policy.points.loss,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        compareCodePoints(a.teamId, b.teamId),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function projectLeagueCompetition(
  ruleset: Ruleset,
  ledger: LeagueSeasonLedger,
  competitions: readonly CompetitionRecord[],
): CompetitionRecord[] {
  const row = standingsFromLedger(ruleset, ledger).find((candidate) => candidate.teamId === ledger.teamId);
  if (row === undefined) throw new RangeError(`projectLeagueCompetition: 소속 팀 '${ledger.teamId}' 행이 없다.`);
  return competitions.map((competition) => competition.kind === 'LEAGUE' ? {
    ...competition,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    position: row.rank,
  } : competition);
}

export function buildFinalLeagueTable(ruleset: Ruleset, ledger: LeagueSeasonLedger): FinalLeagueTable {
  assertLeagueLedgerInvariant(ledger);
  const fixtures = [...fixtureMap(ledger).values()];
  const totalRounds = Math.max(0, ...fixtures.map((fixture) => fixture.round));
  if (ledger.completedRounds.length !== totalRounds) {
    throw new RangeError(`buildFinalLeagueTable: 완료 round ${ledger.completedRounds.length}/${totalRounds}.`);
  }
  return {
    policyVersion: ledger.policyVersion,
    leagueId: ledger.leagueId,
    leagueName: ledger.leagueName,
    seasonIndex: ledger.seasonIndex,
    teamId: ledger.teamId,
    completedRounds: totalRounds,
    rows: standingsFromLedger(ruleset, ledger),
  };
}
