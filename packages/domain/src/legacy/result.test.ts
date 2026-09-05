import { describe, expect, it } from 'vitest';
import { hashState } from '../hash.js';
import { hashSeasonResult } from '../settlement.js';
import { initialSeasonPlayerStats } from '../season-stats.js';
import { archiveFixture, copy } from './__fixtures__/archive.js';
import { createCareerArchiveCore, verifyCareerArchiveCore } from './archive.js';
import {
  createLegacyResult,
  deriveRetirementTags,
  LEGACY_POLICY,
  type LegacyReferencePopulation,
} from './result.js';

function archiveAndContext() {
  const fixture = archiveFixture();
  return { ...fixture, archive: createCareerArchiveCore(fixture.snapshot, fixture.context) };
}

function population(values: readonly number[], id = 'test-population'): LegacyReferencePopulation {
  return {
    id,
    legacyVersion: LEGACY_POLICY.version,
    rulesetVersion: '1.0.0',
    scores: { GK: values, DF: values, MF: values, FW: values },
  };
}

const sortedTenThousand = Array.from({ length: 10_000 }, (_, index) => Math.floor(index / 100));

function equalQualityArchive(group: 'GK' | 'DF' | 'MF' | 'FW') {
  const fixture = archiveFixture();
  const season = fixture.snapshot.state.seasonHistory[0]!;
  const result = copy(season.result);
  const stats = initialSeasonPlayerStats(group);
  stats.appearances = { total: 10, started: 10, sub: 0, zeroMinute: 0, out: 0 };
  stats.minutes = 900;
  stats.ratedMatches = 10;
  stats.ratingSumTenths = 700;
  if (group === 'GK')
    stats.totals = {
      group: 'GK',
      saves: 30,
      psxgMinusGoalsCenti: 0,
      cleanSheet: 0,
      crossesClaimed: 0,
      buildUpPasses: 0,
    };
  if (group === 'DF')
    stats.totals = {
      group: 'DF',
      tackles: 40,
      interceptions: 20,
      aerialsWon: 20,
      goalsConcededInvolved: 0,
      cleanSheet: 0,
    };
  if (group === 'MF')
    stats.totals = {
      group: 'MF',
      assists: 0,
      chancesCreated: 20,
      progressivePasses: 50,
      passesAttempted: 0,
      passesCompleted: 0,
      ballRecoveries: 50,
    };
  if (group === 'FW')
    stats.totals = { group: 'FW', goals: 5, assists: 2, xgCenti: 0, shots: 0, offsides: 0 };
  result.playerStats = stats;
  result.selectionSummary = {
    ...result.selectionSummary,
    started: 10,
    sub: 0,
    zeroMinute: 0,
    out: 0,
    minutes: 900,
    possibleMinutes: 900,
  };
  result.promiseFulfilment = {
    ...result.promiseFulfilment,
    fulfilled: true,
    minutesShareBp: 10000,
  };
  result.hash = hashSeasonResult(result);
  season.result = result;
  fixture.snapshot.stateHash = hashState(fixture.snapshot.state);
  return { ...fixture, archive: createCareerArchiveCore(fixture.snapshot, fixture.context) };
}

describe('Phase 5 full LegacyResult projection', () => {
  it('does not label a late-starting player as improved merely because pre-26 history is absent', () => {
    const { snapshot } = archiveFixture();
    snapshot.state.careerTags = [];
    for (const entry of snapshot.state.timeline) entry.age = 30;
    const season = snapshot.state.seasonHistory[0]!;
    season.result.baseOvr = { before: 70, after: 70 };
    expect(deriveRetirementTags(snapshot.state)).not.toContain('TAG-LATE-BLOOMER');
    season.result.baseOvr.after = 76;
    expect(deriveRetirementTags(snapshot.state)).toContain('TAG-LATE-BLOOMER');
  });
  it('is deterministic for 100 identical Archive/version calculations', () => {
    const { archive, context } = archiveAndContext();
    const first = createLegacyResult(archive, context);
    for (let index = 0; index < 100; index++)
      expect(createLegacyResult(archive, context).hash).toBe(first.hash);
  });

  it('rejects a corrupted immutable Archive before producing a result', () => {
    const { archive, context } = archiveAndContext();
    const corrupted = copy(archive);
    corrupted.source.state = '{}';
    expect(() => createLegacyResult(corrupted, context)).toThrow();
  });

  it('does not mutate the Archive and does not expose hidden potential', () => {
    const { archive, context } = archiveAndContext();
    const before = JSON.stringify(archive);
    const result = createLegacyResult(archive, context);
    expect(JSON.stringify(archive)).toBe(before);
    expect(JSON.stringify(result)).not.toContain('truePotential');
    expect(JSON.stringify(result)).not.toContain('rngState');
    expect(verifyCareerArchiveCore(archive, context)).toEqual({ ok: true });
  });

  it('returns bounded score, exactly three factors, missed opportunity and a source-backed best moment', () => {
    const { archive, context } = archiveAndContext();
    const result = createLegacyResult(archive, context);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.topFactors).toHaveLength(3);
    expect(result.missedOpportunity).toBeDefined();
    expect(result.sources.some((source) => source.sourceId === result.bestMomentRef)).toBe(true);
  });

  it('assigns every evidence source to at most one Legacy component', () => {
    const { archive, context } = archiveAndContext();
    const result = createLegacyResult(archive, context);
    const seen = new Map<string, string>();
    for (const factor of [...result.topFactors, result.missedOpportunity]) {
      for (const sourceId of factor.sourceIds) {
        // The same component can be both a top contributor and the largest remaining opportunity.
        // Repeating its explanation must not be confused with allocating evidence to two axes.
        expect(seen.get(sourceId) ?? factor.component).toBe(factor.component);
        seen.set(sourceId, factor.component);
      }
    }
  });

  it('hides percentile without a population and changes only percentile with valid populations', () => {
    const { archive, context } = archiveAndContext();
    const hidden = createLegacyResult(archive, context);
    const low = createLegacyResult(
      archive,
      context,
      population(sortedTenThousand, 'population-low'),
    );
    const highValues = Array.from({ length: 10_000 }, () => 0);
    const high = createLegacyResult(archive, context, population(highValues, 'population-high'));
    expect(hidden.percentileHidden).toBe(true);
    expect(hidden.percentile).toBeUndefined();
    expect(low.percentileHidden).toBe(false);
    expect(high.percentileHidden).toBe(false);
    expect(low.totalScore).toBe(high.totalScore);
    expect(low.endingId).toBe(high.endingId);
    expect(low.percentile).not.toBe(high.percentile);
  });

  it.each([
    ['too-small', Array.from({ length: 9_999 }, () => 0), 'INVALID_BINDING'],
    ['unsorted', [...sortedTenThousand.slice(0, 9_999), 0], 'INVALID_BINDING'],
    ['wrong-version', sortedTenThousand, 'VERSION_MISMATCH'],
  ])('rejects invalid reference population %s', (id, values, errorCode) => {
    const { archive, context } = archiveAndContext();
    const invalid = {
      ...population(values, id),
      legacyVersion: id === 'wrong-version' ? '0.0.0' : LEGACY_POLICY.version,
    };
    expect(() => createLegacyResult(archive, context, invalid)).toThrow(errorCode);
  });

  it('keeps the underlying fixture state hash and season result hashes valid', () => {
    const { snapshot, context, archive } = archiveAndContext();
    expect(hashState(snapshot.state)).toBe(snapshot.stateHash);
    expect(snapshot.state.seasonHistory.every((season) => season.result.hash.length === 64)).toBe(
      true,
    );
    expect(verifyCareerArchiveCore(archive, context)).toEqual({ ok: true });
  });

  it('keeps normalized GK/DF/MF/FW equal-quality scores within the ±5 fairness gate', () => {
    // Controlled synthetic equality fixture: this is a normalizer regression, not evidence of
    // four real careers. Each group has 900 minutes, 10 starts, rating 70, and equal per-90
    // performance under LEGACY_POLICY (80 before shared contribution terms).
    const results = (['GK', 'DF', 'MF', 'FW'] as const).map((group) => {
      const { archive, context } = equalQualityArchive(group);
      return createLegacyResult(archive, context);
    });
    const scores = results.map((result) => result.totalScore);
    expect(Math.max(...scores) - Math.min(...scores)).toBeLessThanOrEqual(5);
    // Rating recognition is exclusively achievement; contribution is 40 exposure + 40 rate + 10 promise.
    expect(results.map((result) => result.componentScores.contribution)).toEqual([90, 90, 90, 90]);
  });
});
