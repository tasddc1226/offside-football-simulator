import { describe, expect, it } from 'vitest';
import { LEGACY_ENDING_PRIORITIES } from './endings.js';
import {
  LEGACY_BAND_PRESENTATIONS,
  LEGACY_ENDING_PRESENTATIONS,
  legacyBandPresentation,
  legacyEndingPresentation,
} from './presentation.js';

describe('legacy presentation catalog', () => {
  it('contains every documented ending title and sentence', () => {
    expect(Object.keys(LEGACY_ENDING_PRESENTATIONS)).toHaveLength(18);
    expect(Object.keys(LEGACY_ENDING_PRESENTATIONS).sort()).toEqual(
      Object.keys(LEGACY_ENDING_PRIORITIES).sort(),
    );
    for (const [id, presentation] of Object.entries(LEGACY_ENDING_PRESENTATIONS)) {
      expect(legacyEndingPresentation(id)).toBe(presentation);
      expect(presentation.title).not.toBe('');
      expect(presentation.sentence).not.toBe('');
      expect(Object.isFrozen(presentation)).toBe(true);
    }
  });

  it('contains every documented band label', () => {
    expect(Object.keys(LEGACY_BAND_PRESENTATIONS)).toHaveLength(5);
    for (const [id, presentation] of Object.entries(LEGACY_BAND_PRESENTATIONS)) {
      expect(legacyBandPresentation(id)).toBe(presentation);
      expect(presentation.label).not.toBe('');
      expect(Object.isFrozen(presentation)).toBe(true);
    }
  });

  it('freezes catalogs and rejects unknown or unsafe runtime IDs', () => {
    expect(Object.isFrozen(LEGACY_ENDING_PRESENTATIONS)).toBe(true);
    expect(Object.isFrozen(LEGACY_BAND_PRESENTATIONS)).toBe(true);
    expect(() => legacyEndingPresentation('missing')).toThrow(RangeError);
    expect(() => legacyBandPresentation('missing')).toThrow(RangeError);
    expect(() => legacyEndingPresentation('__proto__')).toThrow(RangeError);
    expect(() => legacyBandPresentation('constructor')).toThrow(RangeError);
  });
});
