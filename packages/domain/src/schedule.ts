import { compareCodePoints } from './canonical.js';
import type { League, Ruleset, Team } from './ruleset.js';
import type { ScheduleEntry } from './types.js';

/** 이름 없는 상대 strength 오프셋(index로 결정, roll 없음). "균등 분산"을 대칭으로 도는 패턴으로 표현한다. */
const UNNAMED_OPPONENT_SPREAD = [0, -5, 5, -10, 10, -15, 15, -20, 20] as const;

function unnamedOpponentOffset(indexInLeague: number): number {
  return UNNAMED_OPPONENT_SPREAD[(indexInLeague - 1) % UNNAMED_OPPONENT_SPREAD.length]!;
}

function clampStrength(value: number): number {
  return Math.min(100, Math.max(0, value));
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

  throw new RangeError(`resolveOpponent: opponentId '${opponentId}'를 어느 상대로도 해석할 수 없다.`);
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
export function buildSchedule(ruleset: Ruleset, team: Team): ScheduleEntry[] {
  const league = findLeague(ruleset, team.leagueId);
  const leagueRounds = buildLeagueRounds(ruleset, team, league);

  const eligibleCup = ruleset.cups.find((cup) => cup.tiers.includes(team.leagueTier));

  const byStep = new Map<number, ScheduleEntry[]>();
  const pushEntry = (step: number, entry: ScheduleEntry): void => {
    const list = byStep.get(step);
    if (list === undefined) byStep.set(step, [entry]);
    else list.push(entry);
  };

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
