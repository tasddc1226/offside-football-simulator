import { clamp } from './clamp.js';
import { resolveOpponent } from './schedule.js';
import { rollInt, roll100, type RngState } from './rng.js';
import { rollRange } from './roll-range.js';
import type { League, Ruleset, Team } from './ruleset.js';
import { computeSquadStatus, familiarityOf, rankPositionForPlayer } from './selection.js';
import {
  statGroupOf,
  type Availability,
  type Competitor,
  type MatchRecord,
  type Position,
  type PositionStats,
  type ScheduleEntry,
  type SelectionRanking,
  type SquadRole,
  type StatGroup,
} from './types.js';

/** 브리프 5번 규칙: 포지션군별 통계 항목의 고정 키 순서(roll 순서·합산 순서 둘 다 이 순서를 쓴다). */
const STAT_KEYS: Record<StatGroup, readonly string[]> = {
  FW: ['goals', 'assists', 'xgCenti', 'shots', 'offsides'],
  MF: ['assists', 'chancesCreated', 'progressivePasses', 'passesAttempted', 'passesCompleted', 'ballRecoveries'],
  DF: ['tackles', 'interceptions', 'aerialsWon', 'goalsConcededInvolved'],
  GK: ['saves', 'psxgMinusGoalsCenti', 'crossesClaimed', 'buildUpPasses'],
};

export type PlayMatchInput = {
  ruleset: Ruleset;
  rngState: RngState;
  seasonIndex: number;
  /** season.matches.length(이번 경기 전까지 치른 경기 수). 경쟁자 form drift·id에 쓴다. */
  matchIndex: number;
  scheduleEntry: ScheduleEntry;
  team: Team;
  league: League;
  styleId: string;
  playerName: string;
  primaryPosition: Position;
  baseOvr: number;
  tacticalFit: number;
  managerTrust: number;
  form: number;
  fitness: number;
  morale: number;
  positionProficiency: number;
  squadStatus: number;
  rolePromise: SquadRole;
  competitors: readonly Competitor[];
  availability: Availability;
  /** season.playerStats.yellow(이번 경기 전까지 누적 경고). */
  seasonYellowCount: number;
  /** season.lastRatingTenths(이번 경기 전 값). 0분 경기는 이 값을 그대로 유지한다. */
  lastRatingTenths: number | null;
  /** 회복 직후 실제 출전의 재발 검사. 이 값이 있으면 새 부상 판정보다 먼저 1회 소비한다. */
  recurrenceCheck?: { episodeId: string; riskBp: number };
};

export type PlayMatchResult = {
  rngState: RngState;
  match: MatchRecord;
  selection: SelectionRanking;
  nextCompetitors: Competitor[];
  nextAvailability: Availability;
  nextSquadStatus: number;
  nextLastRatingTenths: number | null;
  nextSeasonYellowCount: number;
  recurrenceTriggered: boolean;
};

function zeroStatsForGroup(group: StatGroup): PositionStats {
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
      return { group: 'DF', tackles: 0, interceptions: 0, aerialsWon: 0, goalsConcededInvolved: 0, cleanSheet: false };
    case 'GK':
      return { group: 'GK', saves: 0, psxgMinusGoalsCenti: 0, cleanSheet: false, crossesClaimed: 0, buildUpPasses: 0 };
  }
}

function rollStatValue(
  state: RngState,
  group: StatGroup,
  key: string,
  involvement: number,
  ruleset: Ruleset,
): { value: number; state: RngState } {
  const table = ruleset.matchRules.statTables[group][key];
  if (table === undefined) {
    throw new RangeError(`rollStatValue: matchRules.statTables.${group}.${key}가 없다.`);
  }
  const bucket = table.find((candidate) => involvement >= candidate.min && involvement <= candidate.max);
  if (bucket === undefined) {
    throw new RangeError(`rollStatValue: involvement ${involvement}을 담는 ${group}.${key} 구간이 없다.`);
  }
  const rolled = rollInt(state, bucket.values.length);
  return { value: bucket.values[rolled.value]!, state: rolled.state };
}

/**
 * 출전 시간에 비례한 정수 기록의 기대값을 보존한다. 음수 centi도 절댓값을 같은 방식으로 반올림한 뒤
 * 부호를 복원한다. fullMinutes가 없으면 1.0 호환 경로로 RNG를 전혀 소비하지 않는다.
 */
export function scaleAdditiveStatForMinutes(
  state: RngState,
  value: number,
  minutes: number,
  fullMinutes?: number,
): { value: number; state: RngState } {
  if (fullMinutes === undefined) return { value, state };
  const magnitudeNumerator = Math.abs(value) * minutes;
  const base = Math.floor(magnitudeNumerator / fullMinutes);
  const remainder = magnitudeNumerator % fullMinutes;
  const rounded = rollInt(state, fullMinutes);
  const magnitude = base + (rounded.value < remainder ? 1 : 0);
  return { value: magnitude === 0 ? 0 : value < 0 ? -magnitude : magnitude, state: rounded.state };
}

/** 브리프 5번 제약을 적용해 포지션군 통계를 만든다(고정 키 순서로 각 1회 roll). */
function rollStatsForGroup(
  state: RngState,
  group: StatGroup,
  involvement: number,
  ruleset: Ruleset,
  goalsFor: number,
  goalsAgainst: number,
  minutes: number,
): { stats: PositionStats; state: RngState } {
  let s = state;
  const raw: Record<string, number> = {};
  for (const key of STAT_KEYS[group]) {
    const rolled = rollStatValue(s, group, key, involvement, ruleset);
    s = rolled.state;
    raw[key] = rolled.value;
  }
  for (const key of STAT_KEYS[group]) {
    const scaled = scaleAdditiveStatForMinutes(
      s,
      raw[key]!,
      minutes,
      ruleset.matchRules.statExposureFullMinutes,
    );
    s = scaled.state;
    raw[key] = scaled.value;
  }

  const cleanSheetMinMinutes = ruleset.matchRules.cleanSheetMinMinutes;
  const cleanSheet = goalsAgainst === 0 && minutes >= cleanSheetMinMinutes;

  switch (group) {
    case 'FW': {
      const goals = Math.min(raw.goals!, goalsFor);
      const assists = Math.min(raw.assists!, Math.max(0, goalsFor - goals));
      return {
        state: s,
        stats: { group: 'FW', goals, assists, xgCenti: raw.xgCenti!, shots: raw.shots!, offsides: raw.offsides! },
      };
    }
    case 'MF': {
      const assists = Math.min(raw.assists!, goalsFor);
      const passesAttempted = raw.passesAttempted!;
      const passesCompleted = Math.min(raw.passesCompleted!, passesAttempted);
      return {
        state: s,
        stats: {
          group: 'MF',
          assists,
          chancesCreated: raw.chancesCreated!,
          progressivePasses: raw.progressivePasses!,
          passesAttempted,
          passesCompleted,
          ballRecoveries: raw.ballRecoveries!,
        },
      };
    }
    case 'DF': {
      const goalsConcededInvolved = Math.min(raw.goalsConcededInvolved!, goalsAgainst);
      return {
        state: s,
        stats: {
          group: 'DF',
          tackles: raw.tackles!,
          interceptions: raw.interceptions!,
          aerialsWon: raw.aerialsWon!,
          goalsConcededInvolved,
          cleanSheet,
        },
      };
    }
    case 'GK': {
      return {
        state: s,
        stats: {
          group: 'GK',
          saves: raw.saves!,
          psxgMinusGoalsCenti: raw.psxgMinusGoalsCenti!,
          cleanSheet,
          crossesClaimed: raw.crossesClaimed!,
          buildUpPasses: raw.buildUpPasses!,
        },
      };
    }
  }
}

/** T-2-004: chapter.ts가 챕터 판단이 적용되기 전 원래 평점을 되짚어 계산하는 데 재사용한다(순수
 * 함수 — match.stats·result.outcome·cards는 챕터 판단으로 바뀌지 않으므로 같은 입력이면 항상 같은
 * 원래 평점을 돌려준다). */
export function computeRatingTenths(
  group: StatGroup,
  stats: PositionStats,
  outcome: 'WIN' | 'DRAW' | 'LOSS',
  cards: { yellow: 0 | 1 | 2; red: boolean },
  ruleset: Ruleset,
): number {
  const weights = ruleset.matchRules.ratingWeights;
  const groupWeights = weights.stats[group];
  let raw = 60;
  for (const key of STAT_KEYS[group]) {
    const weight = groupWeights[key];
    if (weight === undefined) continue;
    const value = (stats as unknown as Record<string, number>)[key];
    if (typeof value === 'number') raw += weight * value;
  }
  // DF·GK는 cleanSheet(boolean)도 가중치 대상이다(STAT_KEYS에는 없다 — 합산 항목이 아니라 참·거짓
  // 보너스라 별도로 더한다).
  if ((group === 'DF' || group === 'GK') && 'cleanSheet' in stats && stats.cleanSheet) {
    const cleanSheetWeight = groupWeights.cleanSheet;
    if (cleanSheetWeight !== undefined) raw += cleanSheetWeight;
  }
  raw += weights.resultBonusTenths[outcome];
  raw -= cards.red ? weights.cardPenaltyTenths.red : cards.yellow > 0 ? weights.cardPenaltyTenths.yellow : 0;
  return clamp(Math.round(raw), 40, 100);
}

/** 경쟁자 `form`만 경기 index 기반으로 결정론적으로 흔든다(roll 없음, D-35). */
export function applyCompetitorFormDrift(
  competitors: readonly Competitor[],
  matchIndex: number,
  amplitude: number,
): Competitor[] {
  if (amplitude <= 0) return [...competitors];
  const cycle = 2 * amplitude + 1;
  return competitors.map((competitor, index) => {
    const phase = (matchIndex + index) % cycle;
    const delta = phase - amplitude;
    return { ...competitor, form: clamp(competitor.form + delta, 0, 100) };
  });
}

/**
 * T-2-003 D-35: 경기 하나를 계산한다. RNG 소비 순서(고정, 테스트가 draw 카운트로 검사한다):
 * 1. 팀 결과(`roll100` 1 + `rollInt` 2) 2. 선발(roll 없음) 3. 출전 시간(START·SUB만 각 1회, OUT은 0)
 * 4. 관여량(minutes>0만 1회) 5. 포지션군 통계(minutes>0만, 고정 키 순서로 각 1회;
 * statExposureFullMinutes가 있는 1.1은 raw roll 뒤 키마다 노출 보정 1회 추가)
 * 6. 카드(minutes>0만 1회) 7. 재발 검사(대상 출전이면 1회)→새 부상 이탈(minutes>0만 1회)
 * 8. 평점(roll 없음). 경쟁자 `form` drift도 이 함수가 매 경기 적용한다(roll 없음).
 */
export function playMatch(input: PlayMatchInput): PlayMatchResult {
  const { ruleset, scheduleEntry, team, league } = input;
  const rules = ruleset.matchRules;
  let state = input.rngState;

  const opponent = resolveOpponent(ruleset, league, scheduleEntry.opponentId);

  // 1. 팀 결과.
  const diff = team.squadStrength - opponent.strength + (scheduleEntry.home ? rules.homeBonus : 0);
  const resultRow = rules.resultTable.find((row) => diff >= row.diffMin && diff <= row.diffMax);
  if (resultRow === undefined) {
    throw new RangeError(`playMatch: diff ${diff}를 담는 resultTable 구간이 없다.`);
  }
  const outcomeRoll = roll100(state);
  state = outcomeRoll.state;
  const outcome: 'WIN' | 'DRAW' | 'LOSS' =
    outcomeRoll.value <= resultRow.win ? 'WIN' : outcomeRoll.value <= resultRow.win + resultRow.draw ? 'DRAW' : 'LOSS';

  let goalsFor: number;
  let goalsAgainst: number;
  if (outcome === 'WIN') {
    const roll1 = rollInt(state, rules.scoreTable.winnerGoals.length);
    state = roll1.state;
    goalsFor = rules.scoreTable.winnerGoals[roll1.value]!;
    const roll2 = rollInt(state, rules.scoreTable.loserGoalsRaw.length);
    state = roll2.state;
    goalsAgainst = Math.min(rules.scoreTable.loserGoalsRaw[roll2.value]!, goalsFor - 1);
  } else if (outcome === 'LOSS') {
    const roll1 = rollInt(state, rules.scoreTable.winnerGoals.length);
    state = roll1.state;
    goalsAgainst = rules.scoreTable.winnerGoals[roll1.value]!;
    const roll2 = rollInt(state, rules.scoreTable.loserGoalsRaw.length);
    state = roll2.state;
    goalsFor = Math.min(rules.scoreTable.loserGoalsRaw[roll2.value]!, goalsAgainst - 1);
  } else {
    const roll1 = rollInt(state, rules.scoreTable.drawGoals.length);
    state = roll1.state;
    const goals = rules.scoreTable.drawGoals[roll1.value]!;
    const roll2 = rollInt(state, rules.scoreTable.loserGoalsRaw.length);
    state = roll2.state;
    goalsFor = goals;
    goalsAgainst = goals;
  }

  // 2. 선발(roll 없음).
  const selectionRules = ruleset.selectionRules;
  const familiarity = familiarityOf(input.positionProficiency, selectionRules);
  const excluded = input.availability === null ? null : input.availability.kind;
  const selection = rankPositionForPlayer({
    ruleset,
    styleId: input.styleId,
    position: input.primaryPosition,
    playerName: input.playerName,
    baseOvr: input.baseOvr,
    tacticalFit: input.tacticalFit,
    managerTrust: input.managerTrust,
    form: input.form,
    fitness: input.fitness,
    morale: input.morale,
    familiarity,
    squadStatus: input.squadStatus,
    competitors: input.competitors,
    excluded,
  });
  const playerCandidate = selection.candidates.find((candidate) => candidate.id === 'PLAYER')!;
  const appearance = playerCandidate.appearance;

  let outReason: MatchRecord['outReason'] = null;
  if (excluded !== null) outReason = excluded;
  else if (appearance === 'OUT') outReason = 'NOT_SELECTED';

  // 3. 출전 시간.
  let minutes = 0;
  if (appearance === 'START') {
    const roll = rollInt(state, rules.minutesTable.start.length);
    state = roll.state;
    const option = rules.minutesTable.start[roll.value]!;
    minutes = option.subOut ? option.minute : 90;
  } else if (appearance === 'SUB') {
    const roll = rollInt(state, rules.minutesTable.sub.length);
    state = roll.state;
    minutes = rules.minutesTable.sub[roll.value]!;
    if (minutes === 0) outReason = 'UNUSED_SUB';
  }

  // 4. 관여량(minutes>0만).
  let involvement = 0;
  if (minutes > 0) {
    const expectedPerformance = playerCandidate.expectedPerformance;
    const rawInvolvement =
      expectedPerformance * rules.involvement.performanceWeight +
      (team.squadStrength - opponent.strength) * rules.involvement.opponentStrengthWeight;
    const roll = rollRange(state, rules.involvement.rollMin, rules.involvement.rollMax);
    state = roll.state;
    involvement = clamp(Math.round(rawInvolvement) + roll.value, 0, 100);
  }

  // 5. 포지션군 통계(minutes>0만, 고정 키 순서).
  const statGroup = statGroupOf(input.primaryPosition);
  let stats: PositionStats;
  if (minutes > 0) {
    const rolled = rollStatsForGroup(state, statGroup, involvement, ruleset, goalsFor, goalsAgainst, minutes);
    state = rolled.state;
    stats = rolled.stats;
  } else {
    stats = zeroStatsForGroup(statGroup);
  }

  // 6. 카드(minutes>0만).
  let cards: { yellow: 0 | 1 | 2; red: boolean } = { yellow: 0, red: false };
  let nextSeasonYellowCount = input.seasonYellowCount;
  const matchId = `${input.seasonIndex}-${scheduleEntry.step}-${scheduleEntry.order}`;

  // 부상·정지 중이면 이 경기로 잔여 경기 수를 1 차감한다(0이 되면 해제). excluded !== null이면
  // appearance는 항상 OUT(minutes 0)이므로 아래 카드·부상 분기와 겹치지 않는다.
  let nextAvailability: Availability =
    input.availability === null
      ? null
      : input.availability.matchesRemaining - 1 <= 0
        ? null
        : { ...input.availability, matchesRemaining: input.availability.matchesRemaining - 1 };

  if (minutes > 0) {
    const discipline = rules.disciplineTable[statGroup];
    const cardRoll = roll100(state);
    state = cardRoll.state;
    if (cardRoll.value <= discipline.yellow) {
      cards = { yellow: 1, red: false };
      nextSeasonYellowCount = input.seasonYellowCount + 1;
      if (nextSeasonYellowCount >= rules.yellowSuspensionAt) {
        nextAvailability = { kind: 'SUSPENSION', matchesRemaining: 1, sinceMatchId: matchId };
        nextSeasonYellowCount = 0;
      }
    } else if (cardRoll.value <= discipline.yellow + discipline.red) {
      cards = { yellow: 0, red: true };
      const lengthRoll = rollRange(state, rules.redSuspension.min, rules.redSuspension.max);
      state = lengthRoll.state;
      nextAvailability = { kind: 'SUSPENSION', matchesRemaining: lengthRoll.value, sinceMatchId: matchId };
    }
  }

  // 7. 재발 검사 후 새 부상 이탈(minutes>0만). 재발 성공이면 별도 duration roll은 injury.ts가
  // consume한다. match.ts에서는 이전 availability를 건드리지 않는다.
  let injuredOff = false;
  let recurrenceTriggered = false;
  if (minutes > 0) {
    if (input.recurrenceCheck !== undefined) {
      const recurrenceRoll = rollInt(state, 10000);
      state = recurrenceRoll.state;
      recurrenceTriggered = recurrenceRoll.value < clamp(input.recurrenceCheck.riskBp, 0, 10000);
      if (recurrenceTriggered) injuredOff = true;
    }
    if (!recurrenceTriggered) {
      const threshold =
        rules.injury.perMatchPercent + (input.fitness < rules.injury.lowFitnessBelow ? rules.injury.lowFitnessExtraPercent : 0);
      const injuryRoll = roll100(state);
      state = injuryRoll.state;
      if (injuryRoll.value <= threshold) {
        injuredOff = true;
      }
    }
  }

  // 8. 평점(roll 없음). 0분이면 ratingTenths는 null이고 season.lastRatingTenths는 그대로 유지한다.
  const ratingTenths = minutes > 0 ? computeRatingTenths(statGroup, stats, outcome, cards, ruleset) : null;
  const nextLastRatingTenths = minutes > 0 ? ratingTenths : input.lastRatingTenths;

  const nextSquadStatus = computeSquadStatus(
    {
      rolePromise: input.rolePromise,
      captaincy: 'NONE',
      lastRating: nextLastRatingTenths === null ? null : nextLastRatingTenths / 10,
    },
    selectionRules,
    ruleset.contractRules.squadStatusByRole,
  );

  const nextCompetitors = applyCompetitorFormDrift(input.competitors, input.matchIndex, rules.competitorFormDrift.amplitude);

  const match: MatchRecord = {
    id: matchId,
    step: scheduleEntry.step,
    order: scheduleEntry.order,
    competitionId: scheduleEntry.competitionId,
    kind: scheduleEntry.kind,
    round: scheduleEntry.round,
    opponent,
    home: scheduleEntry.home,
    result: { goalsFor, goalsAgainst, outcome },
    appearance,
    outReason,
    minutes,
    involvement,
    stats,
    ratingTenths,
    cards,
    injuredOff,
    chapterId: null,
  };

  return {
    rngState: state,
    match,
    selection,
    nextCompetitors,
    nextAvailability,
    nextSquadStatus,
    nextLastRatingTenths,
    nextSeasonYellowCount,
    recurrenceTriggered,
  };
}
