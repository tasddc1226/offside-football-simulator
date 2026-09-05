import { describe, expect, it } from 'vitest';
import type { LegacyReferencePopulation } from '@offside/domain';
import { selectRetirementReferencePopulation } from './retirement.js';

// Selection contract only; these arrays are not production population evidence.
const population: LegacyReferencePopulation = {
  id: 'known-reference',
  legacyVersion: '1.0.0',
  rulesetVersion: '1.0.0',
  scores: { GK: [], DF: [], MF: [], FW: [] },
};

describe('retirement reference pin during delayed sync', () => {
  it('keeps missing/explicit-null legacy results hidden even after a population is deployed', () => {
    expect(selectRetirementReferencePopulation(undefined, population)).toBeUndefined();
    expect(selectRetirementReferencePopulation(null, population)).toBeUndefined();
  });

  it('uses only the registered population named by the persisted local result', () => {
    expect(selectRetirementReferencePopulation('known-reference', population)).toBe(population);
    expect(() => selectRetirementReferencePopulation('different-reference', population)).toThrow();
    expect(() => selectRetirementReferencePopulation('known-reference', undefined)).toThrow();
  });
});
