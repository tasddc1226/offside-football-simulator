import { compareCodePoints } from './canonical.js';
import { roll100, rollInt, seedRng, type RngState } from './rng.js';
import { buildLeagueFixtures, buildLeagueRoster } from './schedule.js';
import type { League, Ruleset, Team } from './ruleset.js';
import type {
  CompetitionRecord,
  FinalLeagueTable,
  FootballSeason,
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
  fixtureIndex: number,
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
  return [fixtureIndex, homeGoals, awayGoals];
}

function fixtureMap(ledger: LeagueSeasonLedger): Map<string, { fixture: LeagueFixture; index: number }> {
  return new Map(
    buildLeagueFixtures(ledger.seasonIndex, ledger.leagueId, ledger.teams)
      .map((fixture, index) => [fixture.fixtureId, { fixture, index }]),
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
  const fixtures = buildLeagueFixtures(ledger.seasonIndex, ledger.leagueId, ledger.teams);
  const resultIndexes = new Set<number>();
  for (const result of ledger.results) {
    const [fixtureIndex, homeGoals, awayGoals] = result;
    if (!Number.isSafeInteger(fixtureIndex) || fixtureIndex < 0 || fixtureIndex >= fixtures.length) {
      throw new RangeError(`league ledger: fixture index '${fixtureIndex}' 범위가 비정상이다.`);
    }
    if (resultIndexes.has(fixtureIndex)) throw new RangeError(`league ledger: fixture index '${fixtureIndex}' 결과 중복.`);
    resultIndexes.add(fixtureIndex);
    if (
      !Number.isSafeInteger(homeGoals) || homeGoals < 0 ||
      !Number.isSafeInteger(awayGoals) || awayGoals < 0
    ) {
      throw new RangeError(`league ledger: fixture index '${fixtureIndex}' 스코어가 비정상이다.`);
    }
  }
  const completed = new Set<number>();
  for (const round of ledger.completedRounds) {
    if (completed.has(round)) throw new RangeError(`league ledger: 완료 round ${round} 중복.`);
    completed.add(round);
  }
  const rounds = new Set(fixtures.map((fixture) => fixture.round));
  for (const round of completed) {
    if (!rounds.has(round)) throw new RangeError(`league ledger: 존재하지 않는 완료 round ${round}.`);
  }
  for (const round of rounds) {
    const expected = fixtures.filter((fixture) => fixture.round === round).length;
    const actual = ledger.results.filter((result) => fixtures[result[0]]?.round === round).length;
    if (actual !== 0 && actual !== expected) {
      throw new RangeError(`league ledger: round ${round} 결과가 부분 집합 ${actual}/${expected}이다.`);
    }
    if (completed.has(round) !== (actual === expected)) {
      throw new RangeError(`league ledger: round ${round} 완료 표식(${completed.has(round)})과 결과 ${actual}/${expected} 불일치.`);
    }
  }
}

/** 지원 룰셋의 외부 저장/표시 경계: 시즌·roster·schedule과 원장 binding을 함께 검증한다. */
export function assertSeasonLeagueLedgerInvariant(ruleset: Ruleset, season: FootballSeason): void {
  const policy = ruleset.leagueLedgerRules;
  const ledger = season.leagueLedger;
  if (policy === undefined) {
    if (ledger !== undefined) throw new RangeError(`league ledger: 룰셋 '${ruleset.version}'은 원장을 지원하지 않는다.`);
    return;
  }
  if (ledger === undefined) {
    throw new RangeError(`league ledger: 지원 룰셋 '${ruleset.version}' 활성 시즌에 원장이 없다.`);
  }
  const team = ruleset.teams.find((candidate) => candidate.id === season.teamId);
  if (team === undefined) throw new RangeError(`league ledger: 시즌 팀 '${season.teamId}'이 룰셋에 없다.`);
  const league = ruleset.leagues.find((candidate) => candidate.id === team.leagueId);
  if (league === undefined) throw new RangeError(`league ledger: 팀 '${team.id}'의 리그 '${team.leagueId}'가 없다.`);
  if (
    ledger.policyVersion !== policy.policyVersion ||
    ledger.seasonIndex !== season.index ||
    ledger.teamId !== season.teamId ||
    ledger.leagueId !== league.id ||
    ledger.leagueName !== league.name
  ) {
    throw new RangeError('league ledger: policy/season/team/league binding이 활성 시즌과 다르다.');
  }
  const expectedTeams = buildLeagueRoster(ruleset, team, league);
  if (
    ledger.teams.length !== expectedTeams.length ||
    ledger.teams.some((candidate, index) => {
      const expected = expectedTeams[index];
      return expected === undefined ||
        candidate.teamId !== expected.teamId ||
        candidate.name !== expected.name ||
        candidate.strength !== expected.strength;
    })
  ) {
    throw new RangeError('league ledger: 시즌 시작 roster snapshot이 룰셋 참가팀과 다르다.');
  }
  assertLeagueLedgerInvariant(ledger);

  const fixtures = buildLeagueFixtures(season.index, league.id, ledger.teams);
  const expected = fixtures
    .filter((fixture) => fixture.homeTeamId === team.id || fixture.awayTeamId === team.id);
  const actual = season.schedule.filter((entry) => entry.kind === 'LEAGUE');
  if (actual.length !== expected.length) {
    throw new RangeError(`league ledger: 소속 팀 schedule fixture 수 ${actual.length}/${expected.length} 불일치.`);
  }
  for (const fixture of expected) {
    const entry = actual.find((candidate) => candidate.fixtureId === fixture.fixtureId);
    const home = fixture.homeTeamId === team.id;
    if (
      entry === undefined ||
      entry.leagueRound !== fixture.round ||
      entry.step !== fixture.step ||
      entry.competitionId !== 'LEAGUE' ||
      entry.round !== String(fixture.round) ||
      entry.opponentId !== (home ? fixture.awayTeamId : fixture.homeTeamId) ||
      entry.home !== home
    ) {
      throw new RangeError(`league ledger: schedule fixture '${fixture.fixtureId}' 연결이 다르다.`);
    }

    const fixtureIndex = fixtures.findIndex((candidate) => candidate.fixtureId === fixture.fixtureId);
    const result = ledger.results.find((candidate) => candidate[0] === fixtureIndex);
    const match = season.matches.find(
      (candidate) => candidate.step === entry.step && candidate.order === entry.order,
    );
    if (result !== undefined) {
      if (match === undefined) {
        throw new RangeError(`league ledger: 완료 fixture '${fixture.fixtureId}'의 선수 경기 기록이 없다.`);
      }
      const expectedHomeGoals = entry.home ? match.result.goalsFor : match.result.goalsAgainst;
      const expectedAwayGoals = entry.home ? match.result.goalsAgainst : match.result.goalsFor;
      if (result[1] !== expectedHomeGoals || result[2] !== expectedAwayGoals) {
        throw new RangeError(`league ledger: 완료 fixture '${fixture.fixtureId}'의 선수 경기 스코어가 다르다.`);
      }
    } else if (match !== undefined) {
      throw new RangeError(`league ledger: 선수 경기 '${match.id}'의 fixture 결과가 없다.`);
    }
  }

  const projected = projectLeagueCompetition(ruleset, ledger, season.competitions);
  const leagueRows = season.competitions.filter((competition) => competition.kind === 'LEAGUE');
  const projectedLeagueRows = projected.filter((competition) => competition.kind === 'LEAGUE');
  const leagueRow = leagueRows[0];
  const projectedLeagueRow = projectedLeagueRows[0];
  if (
    leagueRows.length !== 1 ||
    projectedLeagueRows.length !== 1 ||
    leagueRow === undefined ||
    projectedLeagueRow === undefined ||
    leagueRow.competitionId !== projectedLeagueRow.competitionId ||
    leagueRow.kind !== projectedLeagueRow.kind ||
    leagueRow.played !== projectedLeagueRow.played ||
    leagueRow.won !== projectedLeagueRow.won ||
    leagueRow.drawn !== projectedLeagueRow.drawn ||
    leagueRow.lost !== projectedLeagueRow.lost ||
    leagueRow.goalsFor !== projectedLeagueRow.goalsFor ||
    leagueRow.goalsAgainst !== projectedLeagueRow.goalsAgainst ||
    leagueRow.position !== projectedLeagueRow.position ||
    leagueRow.cupRound !== projectedLeagueRow.cupRound
  ) {
    throw new RangeError('league ledger: LEAGUE competition projection이 원장 순위와 다르다.');
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
  const indexed = fixtureMap(ledger).get(entry.fixtureId);
  if (indexed === undefined) throw new RangeError(`recordPlayerLeagueResult: fixture '${entry.fixtureId}'가 없다.`);
  const { fixture, index: fixtureIndex } = indexed;
  const homeGoals = entry.home ? match.result.goalsFor : match.result.goalsAgainst;
  const awayGoals = entry.home ? match.result.goalsAgainst : match.result.goalsFor;
  const result: LeagueFixtureResult = [fixtureIndex, homeGoals, awayGoals];
  const existing = ledger.results.find((candidate) => candidate[0] === fixtureIndex);
  if (existing !== undefined) {
    if (JSON.stringify(existing) !== JSON.stringify(result)) {
      throw new RangeError(`recordPlayerLeagueResult: fixture '${fixture.fixtureId}'의 기존 결과와 충돌한다.`);
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
  const fixtures = buildLeagueFixtures(ledger.seasonIndex, ledger.leagueId, ledger.teams);
  let next = ledger;
  const rounds = [...new Set(fixtures.filter((fixture) => fixture.step === step).map((fixture) => fixture.round))].sort((a, b) => a - b);
  for (const round of rounds) {
    if (next.completedRounds.includes(round)) continue;
    const roundFixtures = fixtures.filter((fixture) => fixture.round === round);
    const playerFixture = roundFixtures.find(
      (fixture) => fixture.homeTeamId === next.teamId || fixture.awayTeamId === next.teamId,
    );
    const playerFixtureIndex = playerFixture === undefined ? -1 : fixtures.indexOf(playerFixture);
    if (playerFixture !== undefined && !next.results.some((result) => result[0] === playerFixtureIndex)) {
      continue;
    }
    const existing = new Set(next.results.map((result) => result[0]));
    const generated = roundFixtures
      .map((fixture) => ({ fixture, index: fixtures.indexOf(fixture) }))
      .filter(({ index }) => !existing.has(index))
      .map(({ fixture, index }) => fixtureScore(ruleset, next, fixture, index));
    next = {
      ...next,
      results: [...next.results, ...generated].sort((a, b) => a[0] - b[0]),
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
  const fixtures = buildLeagueFixtures(ledger.seasonIndex, ledger.leagueId, ledger.teams);
  for (const result of ledger.results) {
    const fixture = fixtures[result[0]];
    if (fixture === undefined) throw new RangeError(`standingsFromLedger: fixture index '${result[0]}'가 없다.`);
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (home === undefined || away === undefined) throw new RangeError('standingsFromLedger: 결과 팀이 roster에 없다.');
    const homeGoals = result[1];
    const awayGoals = result[2];
    home.played += 1;
    away.played += 1;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;
    if (homeGoals > awayGoals) {
      home.won += 1;
      away.lost += 1;
    } else if (homeGoals < awayGoals) {
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
  const fixtures = buildLeagueFixtures(ledger.seasonIndex, ledger.leagueId, ledger.teams);
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
