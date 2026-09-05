import { describe, expect, it } from 'vitest';
import { runSettledFixture } from '../__fixtures__/career-06-settled.js';
import { runLoanFixture } from '../__fixtures__/career-11-loan.js';
import { canonicalize, type JsonValue } from '../canonical.js';
import { hashState, sha256Hex } from '../hash.js';
import { initialSeasonPlayerStats } from '../season-stats.js';
import { hashSeasonResult } from '../settlement.js';
import type { SeasonSummary, StatGroup } from '../types.js';
import { aggregateCareerRecords } from './career-records.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const realSnapshot = runSettledFixture().snapshot;
const realSeason = realSnapshot.state.seasonHistory[0]!;

/** Synthetic settled records test aggregation, NOT twenty years of engine progression. */
function season(index: number, group: StatGroup = 'FW', teamId = 'CLUB-A'): SeasonSummary {
  const copy = clone(realSeason);
  copy.index = index;
  copy.teamId = teamId;
  copy.settledAtRevision = 100 + index;
  copy.result.index = index;
  copy.result.teamId = teamId;
  const stats = initialSeasonPlayerStats(group);
  stats.appearances = { total: 10, started: 4, sub: 2, zeroMinute: 4, out: 4 };
  stats.minutes = 420;
  stats.ratedMatches = 6;
  stats.ratingSumTenths = 420;
  stats.yellow = 2;
  stats.injuries = 1;
  copy.result.playerStats = stats;
  copy.result.selectionSummary = {
    ...copy.result.selectionSummary,
    started: 4,
    sub: 2,
    zeroMinute: 4,
    out: 4,
    minutes: 420,
    possibleMinutes: 900,
  };
  return seal(copy);
}

function seal(value: SeasonSummary): SeasonSummary {
  value.result.hash = hashSeasonResult(value.result);
  return value;
}

describe('Phase 5 — settled career record projection', () => {
  it('returns explicit zero totals and null average for an empty history', () => {
    const records = aggregateCareerRecords([]);
    expect(records.totals).toEqual({
      seasons: 0,
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
    });
    expect(records.sources).toEqual([]);
    expect(records.clubs).toEqual([]);
    expect(records.positions).toEqual([]);
  });

  it('consumes a real SETTLE_SEASON result without changing state or its hash', () => {
    const state = freeze(clone(realSnapshot.state));
    const before = hashState(state);
    const records = aggregateCareerRecords(state.seasonHistory);
    expect(records.totals.minutes).toBe(realSeason.result.playerStats.minutes);
    expect(records.sources[0]?.resultHash).toBe(realSeason.result.hash);
    expect(hashState(state)).toBe(before);
    expect(before).toBe(realSnapshot.stateHash);
  });

  it('counts played matches separately from scheduled and zero-minute matches', () => {
    const value = season(1);
    // One named substitute never enters the pitch: sub count is not an appearance count.
    value.result.playerStats.appearances.zeroMinute = 5;
    value.result.playerStats.ratedMatches = 5;
    value.result.playerStats.ratingSumTenths = 350;
    value.result.selectionSummary.zeroMinute = 5;
    const records = aggregateCareerRecords([seal(value)]);
    expect(records.totals).toMatchObject({
      scheduledMatches: 10,
      playedMatches: 5,
      substitutions: 2,
      outMatches: 4,
      zeroMinuteMatches: 5,
    });
  });

  it('uses rated-match weighting rather than averaging seasonal averages', () => {
    const first = season(1);
    const second = season(2);
    first.result.playerStats.ratedMatches = 1;
    first.result.playerStats.ratingSumTenths = 90;
    second.result.playerStats.ratingSumTenths = 360;
    expect(aggregateCareerRecords([seal(first), seal(second)]).totals.averageRatingTenths).toBe(64);
  });

  it('keeps no-appearance seasons without inventing an average rating', () => {
    const value = season(1);
    value.result.playerStats = initialSeasonPlayerStats('FW');
    value.result.playerStats.appearances = {
      total: 10,
      started: 0,
      sub: 0,
      zeroMinute: 10,
      out: 10,
    };
    value.result.selectionSummary = {
      ...value.result.selectionSummary,
      started: 0,
      sub: 0,
      zeroMinute: 10,
      out: 10,
      minutes: 0,
    };
    expect(aggregateCareerRecords([seal(value)]).totals).toMatchObject({
      seasons: 1,
      scheduledMatches: 10,
      playedMatches: 0,
      minutes: 0,
      averageRatingTenths: null,
    });
  });

  it('attributes the real loan season only to the team played for, excluding the active third season', () => {
    const { snapshot } = runLoanFixture();
    const { seasonHistory, clubHistory } = snapshot.state;
    const loan = clubHistory.find((stint) => stint.kind === 'LOAN')!;
    const records = aggregateCareerRecords(seasonHistory);
    expect(snapshot.state.season?.index).toBe(3);
    expect(records.totals.seasons).toBe(2);
    expect(records.clubs.find((club) => club.teamId === loan.teamId)?.seasonIndices).toEqual([2]);
    expect(records.clubs.reduce((total, club) => total + club.totals.minutes, 0)).toBe(
      records.totals.minutes,
    );
    expect(records.sources.map((source) => source.seasonIndex)).toEqual([1, 2]);
  });

  it('groups distinct statistics for all four positions and retains signed GK values', () => {
    const values = (['FW', 'MF', 'DF', 'GK'] as const).flatMap((group, i) => [
      season(i * 2 + 1, group),
      season(i * 2 + 2, group),
    ]);
    for (const value of values) {
      const totals = value.result.playerStats.totals;
      if (totals.group === 'GK') {
        totals.saves = 20;
        totals.psxgMinusGoalsCenti = -150;
        totals.cleanSheet = 3;
      }
      if (totals.group === 'DF') {
        totals.tackles = 12;
        totals.cleanSheet = 2;
      }
      if (totals.group === 'MF') {
        totals.chancesCreated = 10;
        totals.passesCompleted = 50;
      }
      if (totals.group === 'FW') {
        totals.goals = 5;
        totals.xgCenti = 420;
      }
      seal(value);
    }
    const records = aggregateCareerRecords(values);
    expect(records.positions.map((position) => position.group)).toEqual(['GK', 'DF', 'MF', 'FW']);
    expect(records.positions[0]?.statistics).toMatchObject({
      saves: 40,
      psxgMinusGoalsCenti: -300,
      cleanSheet: 6,
    });
    expect(records.positions[1]?.statistics).toMatchObject({ tackles: 24, cleanSheet: 4 });
    expect(records.positions[2]?.statistics).toMatchObject({
      chancesCreated: 20,
      passesCompleted: 100,
    });
    expect(records.positions[3]?.statistics).toMatchObject({ goals: 10, xgCenti: 840 });
    expect(records.positions.reduce((total, position) => total + position.totals.minutes, 0)).toBe(
      records.totals.minutes,
    );
  });

  it('is idempotent for duplicate evidence and deterministic under input reorder/JSON resume', () => {
    const first = season(1, 'FW', 'CLUB-Z');
    const second = season(2, 'MF', 'CLUB-A');
    const expected = aggregateCareerRecords([first, second]);
    expect(aggregateCareerRecords([second, clone(first), first])).toEqual(expected);
    expect(expected.clubs.map((club) => club.teamId)).toEqual(['CLUB-A', 'CLUB-Z']);
    expect(aggregateCareerRecords(clone([first, second]))).toEqual(expected);
  });

  it('rejects conflicting duplicate evidence even if both result hashes are valid', () => {
    expect(() => aggregateCareerRecords([season(1), season(1, 'FW', 'CLUB-B')])).toThrow(
      /conflicting duplicate/,
    );
    const changedRevision = season(1);
    changedRevision.settledAtRevision++;
    expect(() => aggregateCareerRecords([season(1), changedRevision])).toThrow(
      /conflicting duplicate/,
    );
  });

  it('rejects a tampered result rather than silently producing a retirement record', () => {
    const value = season(1);
    value.result.playerStats.minutes++;
    expect(() => aggregateCareerRecords([value])).toThrow(/hash mismatch/);
  });

  it.each(['index', 'teamId', 'simulationMode', 'competitions'] as const)(
    'rejects disagreement in summary %s',
    (field) => {
      const value = season(1);
      if (field === 'index') value.index = 2;
      if (field === 'teamId') value.teamId = 'OTHER';
      if (field === 'simulationMode')
        value.simulationMode = value.simulationMode === 'FAST' ? 'CHAPTER' : 'FAST';
      if (field === 'competitions') value.competitions = [];
      expect(() => aggregateCareerRecords([value])).toThrow(/disagree/);
    },
  );

  it('rejects mismatched position discriminants', () => {
    const value = season(1);
    value.result.playerStats.group = 'GK';
    expect(() => aggregateCareerRecords([seal(value)])).toThrow(/groups disagree/);
  });

  it.each([-1, 0, 1.5, NaN, Infinity])('rejects invalid season index %s', (index) => {
    const value = season(1);
    value.index = index;
    expect(() => aggregateCareerRecords([value])).toThrow(RangeError);
  });

  it('rejects invalid signed counts and inconsistent participation', () => {
    const negative = season(1);
    negative.result.playerStats.yellow = -1;
    expect(() => aggregateCareerRecords([seal(negative)])).toThrow(RangeError);
    const invalid = season(1);
    invalid.result.playerStats.appearances.zeroMinute = 11;
    expect(() => aggregateCareerRecords([seal(invalid)])).toThrow(RangeError);
    const excessiveRatings = season(1);
    excessiveRatings.result.playerStats.ratedMatches = 7;
    expect(() => aggregateCareerRecords([seal(excessiveRatings)])).toThrow(RangeError);
  });

  it('rejects overflow instead of hashing rounded aggregate numbers', () => {
    const first = season(1);
    const second = season(2);
    first.result.playerStats.yellow = Number.MAX_SAFE_INTEGER;
    second.result.playerStats.yellow = 1;
    expect(() => aggregateCareerRecords([seal(first), seal(second)])).toThrow(/safe integer range/);
  });

  it('returns detached data while accepting recursively frozen records', () => {
    const history = freeze([season(1)]);
    const before = JSON.stringify(history);
    const result = aggregateCareerRecords(history);
    result.clubs[0]!.seasonIndices.push(99);
    const statistics = result.positions[0]!.statistics;
    if (statistics.group === 'FW') statistics.goals = 999;
    expect(JSON.stringify(history)).toBe(before);
    expect(aggregateCareerRecords(history).clubs[0]?.seasonIndices).toEqual([1]);
  });

  it('aggregates a synthetic twenty-season record set with stable totals and 100 repeated hashes', () => {
    const history = freeze(
      Array.from({ length: 20 }, (_, i) =>
        season(i + 1, i < 10 ? 'FW' : 'MF', i < 5 ? 'CLUB-B' : 'CLUB-A'),
      ),
    );
    const result = aggregateCareerRecords(history);
    expect(result.totals).toMatchObject({
      seasons: 20,
      scheduledMatches: 200,
      playedMatches: 120,
      minutes: 8400,
      possibleMinutes: 18000,
      averageRatingTenths: 70,
    });
    const hashes = Array.from({ length: 100 }, () =>
      sha256Hex(canonicalize(aggregateCareerRecords(history) as unknown as JsonValue)),
    );
    expect(new Set(hashes).size).toBe(1);
  });
});
