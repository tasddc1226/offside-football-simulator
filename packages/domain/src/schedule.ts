import { canonicalize, compareCodePoints } from './canonical.js';
import type { League, Ruleset, Team } from './ruleset.js';
import type { LeagueFixture, LeagueTeamSnapshot, ScheduleEntry } from './types.js';

/** 이름 없는 상대 strength 오프셋(index로 결정, roll 없음). "균등 분산"을 대칭으로 도는 패턴으로 표현한다. */
const UNNAMED_OPPONENT_SPREAD = [0, -5, 5, -10, 10, -15, 15, -20, 20] as const;

function unnamedOpponentOffset(indexInLeague: number): number {
  return UNNAMED_OPPONENT_SPREAD[(indexInLeague - 1) % UNNAMED_OPPONENT_SPREAD.length]!;
}

function clampStrength(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * T-2-004 D-38: DERBY 트리거. `rivalTeamId`는 선수 소속 팀의 `Team.rivalTeamId`(정의됐으면 그 팀과의
 * 경기가 라이벌)를 그대로 넘겨받는다 — PR #208 리뷰 후속(D-77 우회 대신 선택 키 가드). 정의돼 있지
 * 않으면(1.0.0~1.4.0, 또는 1.5.0의 R리그 B팀·K3 필러처럼 이름 있는 라이벌이 없는 팀) 기존처럼
 * 이름 없는 상대만 라이벌로 인정한다(rivalOpponentIndex, D-43/D-67 가드 패턴 — 옛 룰셋 결과·해시
 * 불변).
 */
export function isRivalOpponent(league: League, opponentId: string, rivalTeamId?: string): boolean {
  if (rivalTeamId !== undefined) return opponentId === rivalTeamId;
  return opponentId === `${league.id}-opp-${league.rivalOpponentIndex}`;
}

export function findLeague(ruleset: Ruleset, leagueId: string): League {
  const league = ruleset.leagues.find((candidate) => candidate.id === leagueId);
  if (league === undefined) {
    throw new RangeError(`findLeague: 룰셋에 leagueId '${leagueId}'가 없다.`);
  }
  return league;
}

/**
 * T-2-003 D-35: `opponentId`로부터 실제 이름 있는 팀·이름 없는 상대·컵 라운드 상대를 구분해 표시용
 * 이름과 strength를 만든다(roll 없음, 일정에 저장하지 않고 경기 시점에 파생한다).
 */
export function resolveOpponent(
  ruleset: Ruleset,
  league: League,
  opponentId: string,
): { id: string; name: string; strength: number } {
  const namedTeam = ruleset.teams.find((team) => team.id === opponentId);
  if (namedTeam !== undefined) {
    return { id: namedTeam.id, name: namedTeam.name, strength: namedTeam.squadStrength };
  }

  const unnamedPrefix = `${league.id}-opp-`;
  if (opponentId.startsWith(unnamedPrefix)) {
    const n = Number(opponentId.slice(unnamedPrefix.length));
    const strength = clampStrength(league.strength + unnamedOpponentOffset(n));
    const name = ruleset.matchRules.opponentNameTemplate
      .replaceAll('{league}', league.name)
      .replaceAll('{n}', String(n));
    return { id: opponentId, name, strength };
  }

  for (const cup of ruleset.cups) {
    const cupPrefix = `${cup.id}-`;
    if (opponentId.startsWith(cupPrefix)) {
      const round = opponentId.slice(cupPrefix.length) as 'R1' | 'R2' | 'SEMI' | 'FINAL';
      const strength = ruleset.matchRules.cupStrengthByRound[round];
      const name = ruleset.matchRules.opponentNameTemplate
        .replaceAll('{league}', cup.name)
        .replaceAll('{n}', round);
      return { id: opponentId, name, strength };
    }
  }

  throw new RangeError(
    `resolveOpponent: opponentId '${opponentId}'를 어느 상대로도 해석할 수 없다.`,
  );
}

type RoundEntry = { round: number; step: number; opponentId: string; home: boolean };

/** RULE-TIME-001/D-35: 리그 라운드(0부터) → step 3~11 균등 배치. */
function stepForRound(round: number, roundsTotal: number): number {
  return 3 + Math.floor((round * 9) / roundsTotal);
}

function buildLeagueRounds(ruleset: Ruleset, team: Team, league: League): RoundEntry[] {
  const neededOpponents = league.teamCount - 1;
  if (neededOpponents <= 0) return [];

  const namedOpponents = ruleset.teams
    .filter((candidate) => candidate.leagueId === league.id && candidate.id !== team.id)
    .map((candidate) => candidate.id)
    .sort(compareCodePoints)
    .slice(0, neededOpponents);

  const missing = neededOpponents - namedOpponents.length;
  const opponents: string[] = [...namedOpponents];
  for (let n = 1; n <= missing; n++) {
    opponents.push(`${league.id}-opp-${n}`);
  }

  const roundsTotal = neededOpponents * 2;
  const rounds: RoundEntry[] = [];
  opponents.forEach((opponentId, index) => {
    const homeFirst = index % 2 === 0;
    const firstLegRound = index;
    const secondLegRound = neededOpponents + index;
    rounds.push({
      round: firstLegRound,
      step: stepForRound(firstLegRound, roundsTotal),
      opponentId,
      home: homeFirst,
    });
    rounds.push({
      round: secondLegRound,
      step: stepForRound(secondLegRound, roundsTotal),
      opponentId,
      home: !homeFirst,
    });
  });

  rounds.sort((a, b) => a.round - b.round);
  return rounds;
}

/** T-7-022: 신규 원장용 참가팀 snapshot. 실제 소속 팀을 포함하고 합성 ID 충돌을 건너뛴다. */
export function buildLeagueRoster(
  ruleset: Ruleset,
  team: Team,
  league: League,
): LeagueTeamSnapshot[] {
  const named = ruleset.teams
    .filter((candidate) => candidate.leagueId === league.id)
    .sort((a, b) => compareCodePoints(a.id, b.id));
  if (!named.some((candidate) => candidate.id === team.id)) {
    throw new RangeError(`buildLeagueRoster: 소속 팀 '${team.id}'이 league '${league.id}'에 없다.`);
  }
  if (named.length > league.teamCount) {
    throw new RangeError(
      `buildLeagueRoster: 이름 있는 팀 ${named.length}개가 teamCount ${league.teamCount}를 초과한다.`,
    );
  }

  const allNamedIds = new Set(ruleset.teams.map((candidate) => candidate.id));
  const roster: LeagueTeamSnapshot[] = named.map((candidate) => ({
    teamId: candidate.id,
    name: candidate.name,
    strength: candidate.squadStrength,
  }));
  for (let n = 1; roster.length < league.teamCount; n++) {
    const teamId = `${league.id}-opp-${n}`;
    if (allNamedIds.has(teamId) || roster.some((candidate) => candidate.teamId === teamId))
      continue;
    const opponent = resolveOpponent(ruleset, league, teamId);
    roster.push({ teamId, name: opponent.name, strength: opponent.strength });
  }
  return roster.sort((a, b) => compareCodePoints(a.teamId, b.teamId));
}

function fixtureIdFor(
  seasonIndex: number,
  leagueId: string,
  round: number,
  homeTeamId: string,
  awayTeamId: string,
): string {
  return `league-fixture:${canonicalize([seasonIndex, leagueId, round, homeTeamId, awayTeamId])}`;
}

/** 1-based 리그 라운드 → 기존 경기 구간 step 3~11 균등 배치. */
export function leagueStepForRound(round: number, roundsTotal: number): number {
  return 3 + Math.floor(((round - 1) * 9) / roundsTotal);
}

/** T-7-022: 입력 순서와 무관한 circle 홈·원정 2회전. null 회전 슬롯은 BYE로 버린다. */
export function buildLeagueFixtures(
  seasonIndex: number,
  leagueId: string,
  teams: readonly LeagueTeamSnapshot[],
): LeagueFixture[] {
  const uniqueIds = new Set(teams.map((team) => team.teamId));
  if (uniqueIds.size !== teams.length) {
    throw new RangeError('buildLeagueFixtures: 참가팀 ID가 중복됐다.');
  }
  const rotation: Array<string | null> = [...uniqueIds].sort(compareCodePoints);
  if (rotation.length % 2 === 1) rotation.push(null);
  if (rotation.length < 2) return [];

  const roundsPerLeg = rotation.length - 1;
  const roundsTotal = roundsPerLeg * 2;
  const firstLeg: LeagueFixture[] = [];
  for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex++) {
    for (let pairIndex = 0; pairIndex < rotation.length / 2; pairIndex++) {
      const left = rotation[pairIndex]!;
      const right = rotation[rotation.length - 1 - pairIndex]!;
      if (left === null || right === null) continue;
      const swap = (roundIndex + pairIndex) % 2 === 1;
      const homeTeamId = swap ? right : left;
      const awayTeamId = swap ? left : right;
      const round = roundIndex + 1;
      firstLeg.push({
        fixtureId: fixtureIdFor(seasonIndex, leagueId, round, homeTeamId, awayTeamId),
        round,
        step: leagueStepForRound(round, roundsTotal),
        homeTeamId,
        awayTeamId,
      });
    }
    const last = rotation.pop()!;
    rotation.splice(1, 0, last);
  }

  const secondLeg = firstLeg.map((fixture) => {
    const round = fixture.round + roundsPerLeg;
    return {
      fixtureId: fixtureIdFor(seasonIndex, leagueId, round, fixture.awayTeamId, fixture.homeTeamId),
      round,
      step: leagueStepForRound(round, roundsTotal),
      homeTeamId: fixture.awayTeamId,
      awayTeamId: fixture.homeTeamId,
    };
  });
  return [...firstLeg, ...secondLeg].sort(
    (a, b) =>
      a.round - b.round ||
      compareCodePoints(a.homeTeamId, b.homeTeamId) ||
      compareCodePoints(a.awayTeamId, b.awayTeamId),
  );
}

const CUP_ROUND_HOME: Record<'R1' | 'R2' | 'SEMI' | 'FINAL', boolean> = {
  R1: true,
  R2: false,
  SEMI: true,
  FINAL: false,
};

/**
 * T-2-003 D-35: 시즌 시작 시 확정하는 리그·컵 일정(roll 없음). 리그는 `league.teamCount`의 원형
 * 라운드로빈 2회전(홈·원정 교대), 컵은 룰셋 `leagueCalendar.cupRounds`가 정한 step에 배치한다(팀의
 * `leagueTier`가 그 컵의 `tiers`에 없으면 컵 일정을 만들지 않는다 — 첫 번째로 맞는 컵만 쓴다). 같은
 * step에서는 리그가 먼저, 컵이 뒤(order로 표현).
 */
export function buildSchedule(ruleset: Ruleset, team: Team, seasonIndex = 1): ScheduleEntry[] {
  const league = findLeague(ruleset, team.leagueId);
  const leagueRounds = buildLeagueRounds(ruleset, team, league);

  const eligibleCup =
    team.countryCode !== undefined && team.countryCode !== 'KR'
      ? undefined
      : ruleset.cups.find((cup) => cup.tiers.includes(team.leagueTier));

  const byStep = new Map<number, ScheduleEntry[]>();
  const pushEntry = (step: number, entry: ScheduleEntry): void => {
    const list = byStep.get(step);
    if (list === undefined) byStep.set(step, [entry]);
    else list.push(entry);
  };

  if (ruleset.leagueLedgerRules === undefined) {
    for (const round of leagueRounds) {
      pushEntry(round.step, {
        step: round.step,
        order: 0,
        competitionId: 'LEAGUE',
        kind: 'LEAGUE',
        round: null,
        opponentId: round.opponentId,
        home: round.home,
      });
    }
  } else {
    const roster = buildLeagueRoster(ruleset, team, league);
    if (roster.length > ruleset.leagueLedgerRules.maxTeamCount) {
      throw new RangeError(
        `buildSchedule: ledger teamCount ${roster.length}가 최대 ${ruleset.leagueLedgerRules.maxTeamCount}를 초과한다.`,
      );
    }
    for (const fixture of buildLeagueFixtures(seasonIndex, league.id, roster)) {
      if (fixture.homeTeamId !== team.id && fixture.awayTeamId !== team.id) continue;
      const home = fixture.homeTeamId === team.id;
      pushEntry(fixture.step, {
        step: fixture.step,
        order: 0,
        competitionId: 'LEAGUE',
        kind: 'LEAGUE',
        round: String(fixture.round),
        opponentId: home ? fixture.awayTeamId : fixture.homeTeamId,
        home,
        fixtureId: fixture.fixtureId,
        leagueRound: fixture.round,
      });
    }
  }

  if (eligibleCup !== undefined) {
    for (const cupRound of ruleset.leagueCalendar.cupRounds) {
      pushEntry(cupRound.step, {
        step: cupRound.step,
        order: 0,
        competitionId: 'CUP',
        kind: 'CUP',
        round: cupRound.round,
        opponentId: `${eligibleCup.id}-${cupRound.round}`,
        home: CUP_ROUND_HOME[cupRound.round],
      });
    }
  }

  const schedule: ScheduleEntry[] = [];
  const steps = [...byStep.keys()].sort((a, b) => a - b);
  for (const step of steps) {
    const entries = byStep.get(step)!;
    entries.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'LEAGUE' ? -1 : 1));
    entries.forEach((entry, index) => {
      schedule.push({ ...entry, order: index });
    });
  }

  return schedule;
}
