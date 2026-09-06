import { expect, test } from 'vitest';
import { legacyPopulationId } from './legacy-population-identity.ts';

const candidate = {
  legacyVersion: '1.1.0',
  rulesetVersion: '1.1.0',
  contentPackVersion: '0.3.0',
  protocolVersion: 'phase5-population-5-policy-isolation',
  choicePolicy: 'ui-action-strata-v1',
  generatorCodeHash: 'a'.repeat(64),
  policyChecksum: 'b'.repeat(64),
  countPerPosition: 200,
  maxSeasons: 20,
  artifacts: { rulesetChecksum: 'c'.repeat(64), contentPackChecksum: 'd'.repeat(64) },
};

test('retains the original registered protocol identity', () => {
  expect(
    legacyPopulationId({
      ...candidate,
      legacyVersion: '1.0.0',
      rulesetVersion: '1.0.0',
      protocolVersion: 'phase5-population-3-ui-choices',
    }),
  ).toBe('phase5-reference-1.0.0-1.0.0-0.3.0');
});

test('candidate identity is deterministic and separates policy, source, and sampling changes', () => {
  const id = legacyPopulationId(candidate);
  expect(legacyPopulationId({ ...candidate })).toBe(id);
  for (const change of [
    { choicePolicy: 'ui-opportunity-v1' },
    { choicePolicy: 'ui-mixed-v1' },
    { generatorCodeHash: 'e'.repeat(64) },
    { countPerPosition: 10000 },
    { artifacts: { ...candidate.artifacts, rulesetChecksum: 'f'.repeat(64) } },
  ])
    expect(legacyPopulationId({ ...candidate, ...change })).not.toBe(id);
});
