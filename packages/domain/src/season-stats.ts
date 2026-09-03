import { compareCodePoints } from './canonical.js';
import { resolveOpponent } from './schedule.js';
import type { League, LeagueCalendar, Ruleset, Team } from './ruleset.js';
import type {
  CompetitionRecord,
  MatchRecord,
  PositionStats,
  PositionStatsTotals,
  ScheduleEntry,
  SeasonPlayerStats,
  StatGroup,
  StepMatchResult,
} from './types.js';

function zeroTotalsForGroup(group: StatGroup): PositionStatsTotals {
  switch (group) {
    case 'FW':
      return { group: 'FW', goals: 0, assists: 0, xgCenti: 0, shots: 0, offsides: 0 };
    case 'MF':
      return {
        group: 'MF',
        assists: 0,
        chancesCreated: 0,
        progressivePasses: 0,
        passesAttempted: 0,
        passesCompleted: 0,
        ballRecoveries: 0,
      };
    case 'DF':
      return { group: 'DF', tackles: 0, interceptions: 0, aerialsWon: 0, goalsConcededInvolved: 0, cleanSheet: 0 };
    case 'GK':
      return { group: 'GK', saves: 0, psxgMinusGoalsCenti: 0, cleanSheet: 0, crossesClaimed: 0, buildUpPasses: 0 };
  }
}

/** T-2-003 D-35: 시즌 시작 시 선수 현재 포지션군으로 빈 누계를 만든다. */
export function initialSeasonPlayerStats(group: StatGroup): SeasonPlayerStats {
  return {
    group,
    appearances: { total: 0, started: 0, sub: 0, zeroMinute: 0, out: 0 },
    minutes: 0,
    ratingSumTenths: 0,
    ratedMatches: 0,
    yellow: 0,
    red: 0,
    injuries: 0,
    totals: zeroTotalsForGroup(group),
  };
}

function addStatsToTotals(totals: PositionStatsTotals, stats: PositionStats): PositionStatsTotals {
  if (totals.group !== stats.group) {
    throw new RangeError(`addStatsToTotals: totals.group(${totals.group})와 stats.group(${stats.group})이 다르다.`);
  }
  switch (stats.group) {
    case 'FW': {
      const t = totals as Extract<PositionStatsTotals, { group: 'FW' }>;
      return {
        group: 'FW',
        goals: t.goals + stats.goals,
        assists: t.assists + stats.assists,
        xgCenti: t.xgCenti + stats.xgCenti,
        shots: t.shots + stats.shots,
        offsides: t.offsides + stats.offsides,
      };
    }
    case 'MF': {
      const t = totals as Extract<PositionStatsTotals, { group: 'MF' }>;
      return {
        group: 'MF',
        assists: t.assists + stats.assists,
        chancesCreated: t.chancesCreated + stats.chancesCreated,
        progressivePasses: t.progressivePasses + stats.progressivePasses,
        passesAttempted: t.passesAttempted + stats.passesAttempted,
        passesCompleted: t.passesCompleted + stats.passesCompleted,
        ballRecoveries: t.ballRecoveries + stats.ballRecoveries,
      };
    }
    case 'DF': {
      const t = totals as Extract<PositionStatsTotals, { group: 'DF' }>;
      return {
        group: 'DF',
        tackles: t.tackles + stats.tackles,
        interceptions: t.interceptions + stats.interceptions,
        aerialsWon: t.aerialsWon + stats.aerialsWon,
        goalsConcededInvolved: t.goalsConcededInvolved + stats.goalsConcededInvolved,
        cleanSheet: t.cleanSheet + (stats.cleanSheet ? 1 : 0),
      };
    }
    case 'GK': {
      const t = totals as Extract<PositionStatsTotals, { group: 'GK' }>;
      return {
        group: 'GK',
        saves: t.saves + stats.saves,
        psxgMinusGoalsCenti: t.psxgMinusGoalsCenti + stats.psxgMinusGoalsCenti,
        cleanSheet: t.cleanSheet + (stats.cleanSheet ? 1 : 0),
        crossesClaimed: t.crossesClaimed + stats.crossesClaimed,
        buildUpPasses: t.buildUpPasses + stats.buildUpPasses,
      };
    }
  }
}

/** T-2-003 D-35: 경기 하나를 시즌 누계에 반영한다(0분 경기는 zeroMinute로만 센다). */
export function applyMatchToPlayerStats(stats: SeasonPlayerStats, match: MatchRecord): SeasonPlayerStats {
  const appearances = { ...stats.appearances };
  appearances.total += 1;
  if (match.appearance === 'START') appearances.started += 1;
  else if (match.appearance === 'SUB') appearances.sub += 1;
  if (match.appearance === 'OUT') appearances.out += 1;
  if (match.minutes === 0) appearances.zeroMinute += 1;

  return {
    ...stats,
    appearances,
    minutes: stats.minutes + match.minutes,
    ratingSumTenths: match.ratingTenths === null ? stats.ratingSumTenths : stats.ratingSumTenths + match.ratingTenths,
    ratedMatches: match.ratingTenths === null ? stats.ratedMatches : stats.ratedMatches + 1,
    yellow: stats.yellow + match.cards.yellow,
    red: stats.red + (match.cards.red ? 1 : 0),
    injuries: stats.injuries + (match.injuredOff ? 1 : 0),
    totals: addStatsToTotals(stats.totals, match.stats),
  };
}

function nextCupRound(current: string | null, calendar: LeagueCalendar): string {
  if (current === null) {
    throw new RangeError('nextCupRound: 현재 라운드가 null이다.');
  }
  const rounds = calendar.cupRounds.map((entry) => entry.round);
  const index = rounds.indexOf(current as (typeof rounds)[number]);
  if (index === -1) {
    throw new RangeError(`nextCupRound: 캘린더에 라운드 '${current}'가 없다.`);
  }
  return index === rounds.length - 1 ? 'WON' : rounds[index + 1]!;
}

/**
 * T-2-003 D-35: 경기 하나를 대회 기록에 반영한다. 리그는 `position`(호출자가 계산)을 그대로 쓰고,
 * 컵은 승·무면 다음 라운드로, 패면 `OUT_{round}`로 갱신한다(연장·승부차기는 모델링하지 않는다 —
 * 브리프 스코프 밖, PR 본문에 기록).
 */
export function applyMatchToCompetitions(
  competitions: readonly CompetitionRecord[],
  match: MatchRecord,
  leaguePosition: number | null,
  calendar: LeagueCalendar,
): CompetitionRecord[] {
  return competitions.map((competition) => {
    if (competition.competitionId !== match.competitionId) return competition;
    const played = competition.played + 1;
    const won = competition.won + (match.result.outcome === 'WIN' ? 1 : 0);
    const drawn = competition.drawn + (match.result.outcome === 'DRAW' ? 1 : 0);
    const lost = competition.lost + (match.result.outcome === 'LOSS' ? 1 : 0);
    const goalsFor = competition.goalsFor + match.result.goalsFor;
    const goalsAgainst = competition.goalsAgainst + match.result.goalsAgainst;
    if (competition.kind === 'LEAGUE') {
      return { ...competition, played, won, drawn, lost, goalsFor, goalsAgainst, position: leaguePosition };
    }
    const cupRound =
      match.result.outcome === 'LOSS' ? `OUT_${match.round}` : nextCupRound(match.round, calendar);
    return { ...competition, played, won, drawn, lost, goalsFor, goalsAgainst, cupRound };
  });
}

/** T-2-003 D-35: 컵 탈락 뒤 남은 컵 일정(이번 경기 step보다 뒤)을 건너뛴다로 표시한다. */
export function markCupEliminated(schedule: readonly ScheduleEntry[], afterStep: number): ScheduleEntry[] {
  return schedule.map((entry) =>
    entry.kind === 'CUP' && entry.step > afterStep ? { ...entry, skipped: 'ELIMINATED' } : entry,
  );
}

/**
 * T-2-003 D-35(빈틈 채움 — 다른 팀 경기는 시뮬레이션하지 않는다): 리그 순위를 상대 팀 strength 기반
 * 기대 승점으로 근사한다. 상대마다 `resultTable`에서 `diff = 상대 strength − league.strength` 구간의
 * win·draw로 "라운드당 기대 승점×100"을 구하고, 우리와 같은 라운드 수(played)를 곱해 총 기대 승점과
 * 비교한다(다른 팀도 우리와 같은 경기 수를 치렀다고 가정하는 근사치). 동점이면 strength 내림차순 →
 * id 오름차순으로 우리보다 위인지 가른다. PR 본문에 근사 방식으로 기록한다.
 */
export function computeLeaguePosition(
  ruleset: Ruleset,
  league: League,
  schedule: readonly ScheduleEntry[],
  ourTeamId: string,
  ourStrength: number,
  ourPlayed: number,
  ourPoints: number,
): number {
  const opponentIds = [...new Set(schedule.filter((entry) => entry.kind === 'LEAGUE').map((entry) => entry.opponentId))];
  const ourPointsX100 = ourPoints * 100;
  let better = 0;
  for (const opponentId of opponentIds) {
    const opponent = resolveOpponent(ruleset, league, opponentId);
    const diff = opponent.strength - league.strength;
    const row = ruleset.matchRules.resultTable.find((candidate) => diff >= candidate.diffMin && diff <= candidate.diffMax);
    if (row === undefined) {
      throw new RangeError(`computeLeaguePosition: diff ${diff}를 담는 resultTable 구간이 없다.`);
    }
    const expectedX100 = (row.win * 3 + row.draw) * ourPlayed;
    if (expectedX100 > ourPointsX100) {
      better += 1;
    } else if (expectedX100 === ourPointsX100) {
      if (opponent.strength > ourStrength) better += 1;
      else if (opponent.strength === ourStrength && compareCodePoints(opponent.id, ourTeamId) < 0) better += 1;
    }
  }
  return better + 1;
}

/** step별 `StepSummary.results`를 만든다(`season.matches`가 원본, order 오름차순). */
export function stepMatchResultsFor(matches: readonly MatchRecord[], step: number): StepMatchResult[] {
  return matches
    .filter((match) => match.step === step)
    .sort((a, b) => a.order - b.order)
    .map((match) => ({
      matchId: match.id,
      outcome: match.result.outcome,
      goalsFor: match.result.goalsFor,
      goalsAgainst: match.result.goalsAgainst,
      appearance: match.appearance,
      ratingTenths: match.ratingTenths,
    }));
}

export type SeasonMatchBooks = {
  matches: MatchRecord[];
  competitions: CompetitionRecord[];
  playerStats: SeasonPlayerStats;
  schedule: ScheduleEntry[];
};

/** 경기 하나를 시즌 기록(경기 목록·통계·대회·일정)에 한 번에 반영한다. */
export function applyPlayedMatch(
  ruleset: Ruleset,
  team: Team,
  league: League,
  calendar: LeagueCalendar,
  books: SeasonMatchBooks,
  match: MatchRecord,
): SeasonMatchBooks {
  const matches = [...books.matches, match];
  const playerStats = applyMatchToPlayerStats(books.playerStats, match);

  let schedule = books.schedule;
  let leaguePosition: number | null = null;
  if (match.kind === 'LEAGUE') {
    const leagueCompetition = books.competitions.find((competition) => competition.competitionId === 'LEAGUE');
    if (leagueCompetition === undefined) {
      throw new RangeError('applyPlayedMatch: competitions에 LEAGUE 기록이 없다.');
    }
    const played = leagueCompetition.played + 1;
    const points =
      leagueCompetition.won * 3 +
      leagueCompetition.drawn +
      (match.result.outcome === 'WIN' ? 3 : match.result.outcome === 'DRAW' ? 1 : 0);
    leaguePosition = computeLeaguePosition(ruleset, league, schedule, team.id, team.squadStrength, played, points);
  } else if (match.result.outcome === 'LOSS') {
    schedule = markCupEliminated(schedule, match.step);
  }

  const competitions = applyMatchToCompetitions(books.competitions, match, leaguePosition, calendar);
  return { matches, competitions, playerStats, schedule };
}
