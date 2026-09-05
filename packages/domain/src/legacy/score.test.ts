import { describe, expect, it } from 'vitest';
import { canonicalize, type JsonValue } from '../canonical.js';
import { sha256Hex } from '../hash.js';
import {
  calculateLegacyScore,
  legacyBandForScore,
  LEGACY_COMPONENT_WEIGHTS,
  type LegacyComponentScores,
} from './score.js';

const zeros: LegacyComponentScores = {
  achievement: 0,
  contribution: 0,
  longevity: 0,
  relationship: 0,
  narrative: 0,
};

describe('Phase 5 — normalized Legacy score (RULE-LEG-002)', () => {
  it('uses exactly the documented weights and endpoints', () => {
    expect(LEGACY_COMPONENT_WEIGHTS).toEqual({
      achievement: 30,
      contribution: 25,
      longevity: 15,
      relationship: 15,
      narrative: 15,
    });
    expect(Object.isFrozen(LEGACY_COMPONENT_WEIGHTS)).toBe(true);
    expect(calculateLegacyScore(zeros)).toEqual({
      componentScores: zeros,
      totalScore: 0,
      bandId: 'BAND-COMPLETE',
    });
    expect(
      calculateLegacyScore({
        achievement: 100,
        contribution: 100,
        longevity: 100,
        relationship: 100,
        narrative: 100,
      }).totalScore,
    ).toBe(100);
  });

  it.each(Object.entries(LEGACY_COMPONENT_WEIGHTS))(
    'weights %s without other contributions',
    (component, weight) => {
      expect(calculateLegacyScore({ ...zeros, [component]: 100 }).totalScore).toBe(weight);
    },
  );

  it('rounds the combined numerator only once (0.45 + 0.45 + 0.45 = 1.35)', () => {
    expect(
      calculateLegacyScore({ ...zeros, longevity: 3, relationship: 3, narrative: 3 }).totalScore,
    ).toBe(1);
    expect(calculateLegacyScore({ ...zeros, contribution: 2 }).totalScore).toBe(1);
  });

  it('preserves the documented uncrowned score route, without claiming population calibration', () => {
    // Exact weighted sum is 82.25; the final integer is 82.
    expect(
      calculateLegacyScore({
        achievement: 70,
        contribution: 95,
        longevity: 90,
        relationship: 85,
        narrative: 75,
      }).totalScore,
    ).toBe(82);
  });

  it.each([
    [0, 'BAND-COMPLETE'],
    [24, 'BAND-COMPLETE'],
    [25, 'BAND-SOLID'],
    [49, 'BAND-SOLID'],
    [50, 'BAND-REMEMBERED'],
    [74, 'BAND-REMEMBERED'],
    [75, 'BAND-ICON'],
    [89, 'BAND-ICON'],
    [90, 'BAND-LEGEND'],
    [100, 'BAND-LEGEND'],
  ] as const)('maps boundary %i to %s', (score, band) => {
    expect(legacyBandForScore(score)).toBe(band);
  });

  it.each([-1, 101, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER])(
    'rejects invalid score %s instead of clamping',
    (score) => {
      expect(() => legacyBandForScore(score)).toThrow(RangeError);
      for (const component of Object.keys(zeros))
        expect(() => calculateLegacyScore({ ...zeros, [component]: score })).toThrow(RangeError);
    },
  );

  it('does not mutate or retain references to caller-owned components', () => {
    const source = Object.freeze({ ...zeros, achievement: 80 });
    const result = calculateLegacyScore(source);
    result.componentScores.achievement = 0;
    expect(source.achievement).toBe(80);
    expect(calculateLegacyScore(source).totalScore).toBe(24);
  });

  it('produces the same canonical hash for 100 calculations and a JSON round trip', () => {
    const source = {
      achievement: 70,
      contribution: 95,
      longevity: 90,
      relationship: 85,
      narrative: 75,
    };
    const hashes = Array.from({ length: 100 }, () =>
      sha256Hex(
        canonicalize(
          calculateLegacyScore(
            JSON.parse(JSON.stringify(source)) as LegacyComponentScores,
          ) as unknown as JsonValue,
        ),
      ),
    );
    expect(new Set(hashes).size).toBe(1);
  });
});
