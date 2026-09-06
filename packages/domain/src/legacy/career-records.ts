import { canonicalize, compareCodePoints, type JsonValue } from '../canonical.js';
import { initialSeasonPlayerStats } from '../season-stats.js';
import { hashSeasonResult } from '../settlement.js';
import type { PositionStatsTotals, SeasonSummary, StatGroup } from '../types.js';

export type CareerRecordTotals = {
  seasons: number;
  /** SeasonPlayerStats.appearances.total includes matches in which the player did not play. */
  scheduledMatches: number;
  playedMatches: number;
  starts: number;
  substitutions: number;
  zeroMinuteMatches: number;
  outMatches: number;
  minutes: number;
  possibleMinutes: number;
  ratedMatches: number;
  ratingSumTenths: number;
  averageRatingTenths: number | null;
  yellowCards: number;
  redCards: number;
  /** Match-level injured-off count, NOT distinct injury episodes or major injuries. */
  injurySubstitutions: number;
};

/** A projection of settled club records, not the final immutable CareerArchive. */
export type CareerRecords = {
  totals: CareerRecordTotals;
  clubs: Array<{ teamId: string; seasonIndices: number[]; totals: CareerRecordTotals }>;
  positions: Array<{
    group: StatGroup;
    totals: CareerRecordTotals;
    statistics: PositionStatsTotals;
  }>;
  sources: Array<{
    seasonIndex: number;
    teamId: string;
    settledAtRevision: number;
    resultHash: string;
  }>;
};

const GROUP_ORDER: readonly StatGroup[] = ['GK', 'DF', 'MF', 'FW'];

function safeInteger(value: number, label: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new RangeError(`Career records: invalid ${label}.`);
}

function safeAdd(a: number, b: number): number {
  const sum = a + b;
  if (!Number.isSafeInteger(sum))
    throw new RangeError('Career records: aggregate exceeds safe integer range.');
  return sum;
}

function json(value: unknown): string {
  return canonicalize(value as JsonValue);
}

function validateSeason(season: SeasonSummary): void {
  const { result } = season;
  safeInteger(season.index, 'season index', 1);
  safeInteger(season.settledAtRevision, 'settlement revision', 1);
  if (result.legacy !== undefined) safeInteger(result.legacy.incomeMinor, 'income');
  if (
    season.teamId.length === 0 ||
    season.index !== result.index ||
    season.teamId !== result.teamId ||
    season.simulationMode !== result.simulationMode ||
    json(season.competitions) !== json(result.competitions)
  ) {
    throw new RangeError('Career records: summary and result disagree.');
  }
  if (hashSeasonResult(result) !== result.hash)
    throw new RangeError('Career records: result hash mismatch.');
  const stats = result.playerStats;
  if (!GROUP_ORDER.includes(stats.group) || stats.group !== stats.totals.group) {
    throw new RangeError('Career records: position groups disagree.');
  }
  for (const [key, value] of Object.entries(stats.appearances)) safeInteger(value, key);
  for (const key of [
    'minutes',
    'ratingSumTenths',
    'ratedMatches',
    'yellow',
    'red',
    'injuries',
  ] as const) {
    safeInteger(stats[key], key);
  }
  for (const [key, value] of Object.entries(stats.totals)) {
    if (key !== 'group')
      safeInteger(
        value as number,
        key,
        key === 'psxgMinusGoalsCenti' ? -Number.MAX_SAFE_INTEGER : 0,
      );
  }
  safeInteger(result.selectionSummary.possibleMinutes, 'possible minutes');
  const { total, started, sub, out, zeroMinute } = stats.appearances;
  if (
    total !== safeAdd(safeAdd(started, sub), out) ||
    zeroMinute < out ||
    zeroMinute > total ||
    stats.ratedMatches > total - zeroMinute ||
    (stats.ratedMatches === 0 && stats.ratingSumTenths !== 0) ||
    stats.minutes > result.selectionSummary.possibleMinutes ||
    result.selectionSummary.minutes !== stats.minutes ||
    result.selectionSummary.started !== started ||
    result.selectionSummary.sub !== sub ||
    result.selectionSummary.out !== out ||
    result.selectionSummary.zeroMinute !== zeroMinute
  ) {
    throw new RangeError('Career records: inconsistent appearances, minutes or ratings.');
  }
}

function totalRecords(seasons: readonly SeasonSummary[]): CareerRecordTotals {
  const totals: CareerRecordTotals = {
    seasons: seasons.length,
    scheduledMatches: 0,
    playedMatches: 0,
    starts: 0,
    substitutions: 0,
    zeroMinuteMatches: 0,
    outMatches: 0,
    minutes: 0,
    possibleMinutes: 0,
    ratedMatches: 0,
    ratingSumTenths: 0,
    averageRatingTenths: null,
    yellowCards: 0,
    redCards: 0,
    injurySubstitutions: 0,
  };
  for (const { result } of seasons) {
    const stats = result.playerStats;
    const addends = {
      scheduledMatches: stats.appearances.total,
      playedMatches: stats.appearances.total - stats.appearances.zeroMinute,
      starts: stats.appearances.started,
      substitutions: stats.appearances.sub,
      zeroMinuteMatches: stats.appearances.zeroMinute,
      outMatches: stats.appearances.out,
      minutes: stats.minutes,
      possibleMinutes: result.selectionSummary.possibleMinutes,
      ratedMatches: stats.ratedMatches,
      ratingSumTenths: stats.ratingSumTenths,
      yellowCards: stats.yellow,
      redCards: stats.red,
      injurySubstitutions: stats.injuries,
    };
    for (const key of Object.keys(addends) as Array<keyof typeof addends>)
      totals[key] = safeAdd(totals[key], addends[key]);
  }
  totals.averageRatingTenths =
    totals.ratedMatches === 0 ? null : Math.round(totals.ratingSumTenths / totals.ratedMatches);
  return totals;
}

/** Explicit fields keep position changes from silently mixing incompatible statistics. */
function addPositionStatistics(
  left: PositionStatsTotals,
  right: PositionStatsTotals,
): PositionStatsTotals {
  if (left.group === 'FW' && right.group === 'FW')
    return {
      group: 'FW',
      goals: safeAdd(left.goals, right.goals),
      assists: safeAdd(left.assists, right.assists),
      xgCenti: safeAdd(left.xgCenti, right.xgCenti),
      shots: safeAdd(left.shots, right.shots),
      offsides: safeAdd(left.offsides, right.offsides),
    };
  if (left.group === 'MF' && right.group === 'MF')
    return {
      group: 'MF',
      assists: safeAdd(left.assists, right.assists),
      chancesCreated: safeAdd(left.chancesCreated, right.chancesCreated),
      progressivePasses: safeAdd(left.progressivePasses, right.progressivePasses),
      passesAttempted: safeAdd(left.passesAttempted, right.passesAttempted),
      passesCompleted: safeAdd(left.passesCompleted, right.passesCompleted),
      ballRecoveries: safeAdd(left.ballRecoveries, right.ballRecoveries),
    };
  if (left.group === 'DF' && right.group === 'DF')
    return {
      group: 'DF',
      tackles: safeAdd(left.tackles, right.tackles),
      interceptions: safeAdd(left.interceptions, right.interceptions),
      aerialsWon: safeAdd(left.aerialsWon, right.aerialsWon),
      goalsConcededInvolved: safeAdd(left.goalsConcededInvolved, right.goalsConcededInvolved),
      cleanSheet: safeAdd(left.cleanSheet, right.cleanSheet),
    };
  if (left.group === 'GK' && right.group === 'GK')
    return {
      group: 'GK',
      saves: safeAdd(left.saves, right.saves),
      psxgMinusGoalsCenti: safeAdd(left.psxgMinusGoalsCenti, right.psxgMinusGoalsCenti),
      cleanSheet: safeAdd(left.cleanSheet, right.cleanSheet),
      crossesClaimed: safeAdd(left.crossesClaimed, right.crossesClaimed),
      buildUpPasses: safeAdd(left.buildUpPasses, right.buildUpPasses),
    };
  throw new RangeError('Career records: cannot combine different position groups.');
}

function positionStatistics(
  group: StatGroup,
  seasons: readonly SeasonSummary[],
): PositionStatsTotals {
  return seasons.reduce(
    (total, season) => addPositionStatistics(total, season.result.playerStats.totals),
    initialSeasonPlayerStats(group).totals,
  );
}

/**
 * Consumes one career's settled seasonHistory only. Active-season data, parent contracts, call-ups,
 * salaries and tags are deliberately not inferred as appearances, income, trophies or achievements.
 * Duplicate identical summaries are idempotent; conflicting evidence fails closed.
 */
export function aggregateCareerRecords(history: readonly SeasonSummary[]): CareerRecords {
  const unique = new Map<number, SeasonSummary>();
  for (const season of history) {
    validateSeason(season);
    const previous = unique.get(season.index);
    if (previous !== undefined && json(previous) !== json(season)) {
      throw new RangeError('Career records: conflicting duplicate season.');
    }
    unique.set(season.index, season);
  }
  const seasons = [...unique.values()].sort((a, b) => a.index - b.index);
  const teamIds = [...new Set(seasons.map((season) => season.teamId))].sort(compareCodePoints);
  return {
    totals: totalRecords(seasons),
    clubs: teamIds.map((teamId) => {
      const clubSeasons = seasons.filter((season) => season.teamId === teamId);
      return {
        teamId,
        seasonIndices: clubSeasons.map((season) => season.index),
        totals: totalRecords(clubSeasons),
      };
    }),
    positions: GROUP_ORDER.flatMap((group) => {
      const positionSeasons = seasons.filter((season) => season.result.playerStats.group === group);
      return positionSeasons.length === 0
        ? []
        : [
            {
              group,
              totals: totalRecords(positionSeasons),
              statistics: positionStatistics(group, positionSeasons),
            },
          ];
    }),
    sources: seasons.map((season) => ({
      seasonIndex: season.index,
      teamId: season.teamId,
      settledAtRevision: season.settledAtRevision,
      resultHash: season.result.hash,
    })),
  };
}
