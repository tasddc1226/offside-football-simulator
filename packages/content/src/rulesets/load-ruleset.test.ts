import { describe, expect, it } from 'vitest';
import { loadRuleset, RULESET_VERSIONS } from './load-ruleset.ts';

describe('loadRuleset', () => {
  it('exports RULESET_VERSIONS including 1.0.0', () => {
    expect(RULESET_VERSIONS).toContain('1.0.0');
  });

  it('loads and validates ruleset 1.0.0 synchronously', () => {
    const ruleset = loadRuleset('1.0.0');
    expect(ruleset.version).toBe('1.0.0');
    expect(ruleset.archetypes).toHaveLength(24);
  });

  it('throws for an unknown ruleset version', () => {
    expect(() => loadRuleset('9.9.9')).toThrowError(/알 수 없는 rulesetVersion/);
  });
});
