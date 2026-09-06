import { describe, expect, it } from 'vitest';
import { loadLegacyReferencePopulation } from './load-population.ts';

describe('published Legacy reference population loader', () => {
  it('returns the frozen v5 population only for the registered 1.1 pair', () => {
    const first = loadLegacyReferencePopulation('1.1.0', '1.1.0');
    expect(first).not.toBeNull();
    expect(first).toBe(loadLegacyReferencePopulation('1.1.0', '1.1.0'));
    expect(first?.scores.GK).toHaveLength(10_000);
    expect(Object.isFrozen(first)).toBe(true);
    expect(loadLegacyReferencePopulation('1.0.0', '1.0.0')).toBeNull();
    expect(loadLegacyReferencePopulation('1.1.0', '1.0.0')).toBeNull();
    expect(loadLegacyReferencePopulation('unknown', '1.1.0')).toBeNull();
  });
});
