import { describe, expect, it } from 'vitest';
import {
  LEGACY_ENDING_PRIORITIES,
  resolveLegacyEndings,
  selectLegacyDisplayEnding,
  type LegacyEndingId,
} from './endings.js';

describe('Phase 5 — eligible ending resolution (RULE-LEG-006)', () => {
  const ids = Object.keys(LEGACY_ENDING_PRIORITIES) as LegacyEndingId[];

  it('keeps all 18 catalog IDs but does not infer eligibility', () => {
    expect(ids).toHaveLength(18);
    expect(Object.isFrozen(LEGACY_ENDING_PRIORITIES)).toBe(true);
    expect(resolveLegacyEndings([])).toEqual({
      endingId: 'END-COMPLETE-SHORT',
      endingCandidates: [],
    });
  });

  it.each(ids)('can resolve %s as the sole eligible ending', (id) => {
    expect(resolveLegacyEndings([id])).toEqual({ endingId: id, endingCandidates: [] });
  });

  it('uses priority and limits additional candidates to two, excluding fallback', () => {
    expect(resolveLegacyEndings([...ids].reverse())).toEqual({
      endingId: 'END-WORLD-PIONEER',
      endingCandidates: ['END-SECOND-HOME', 'END-HOMECOMING'],
    });
  });

  it('deduplicates evidence without consuming a candidate slot or sorting the input', () => {
    const input = Object.freeze([
      'END-MENTOR',
      'END-COMPLETE-SHORT',
      'END-IRONMAN',
      'END-MENTOR',
    ] as const);
    expect(resolveLegacyEndings(input)).toEqual({
      endingId: 'END-IRONMAN',
      endingCandidates: ['END-MENTOR'],
    });
    expect(input[0]).toBe('END-MENTOR');
  });

  it('is invariant under every rotation of eligibility input', () => {
    const expected = resolveLegacyEndings(ids);
    for (let index = 0; index < ids.length; index++)
      expect(resolveLegacyEndings([...ids.slice(index), ...ids.slice(0, index)])).toEqual(expected);
  });

  it.each(['UNKNOWN', '__proto__', 'toString'])('rejects unknown catalog value %s', (id) => {
    expect(() => resolveLegacyEndings([id as LegacyEndingId])).toThrow(RangeError);
  });

  it('keeps display choice separate from the primary ending and computed score', () => {
    const result = resolveLegacyEndings(['END-IRONMAN', 'END-MENTOR']);
    Object.freeze(result.endingCandidates);
    Object.freeze(result);
    const original = JSON.stringify(result);
    expect(selectLegacyDisplayEnding(result, 'END-MENTOR')).toBe('END-MENTOR');
    expect(selectLegacyDisplayEnding(result, 'END-IRONMAN')).toBe('END-IRONMAN');
    expect(JSON.stringify(result)).toBe(original);
    expect(() => selectLegacyDisplayEnding(result, 'END-NATIONAL-HERO')).toThrow(RangeError);
    expect(() => selectLegacyDisplayEnding(result, 'END-COMPLETE-SHORT')).toThrow(RangeError);
  });
});
