import { describe, expect, it } from 'vitest';
import { legacyPolicyForVersion } from '@offside/domain';
import {
  populationChecksum,
  validateLegacyPopulation,
  type PopulationManifest,
} from './validate-population.ts';

// Synthetic validator fixture only. It exercises the compact artifact contract and is not
// evidence that the production 40,000-career population has been generated.
const registered = {
  rulesetChecksum: 'a'.repeat(64),
  contentPackChecksum: 'b'.repeat(64),
};

function population() {
  return {
    id: 'phase5-reference-1.0.0-1.0.0-0.3.0' as const,
    legacyVersion: '1.0.0' as const,
    rulesetVersion: '1.0.0' as const,
    scores: {
      GK: Array(10_000).fill(50),
      DF: Array(10_000).fill(50),
      MF: Array(10_000).fill(50),
      FW: Array(10_000).fill(50),
    },
  };
}

function manifestFor(raw: ReturnType<typeof population>): PopulationManifest {
  const hash = 'c'.repeat(64);
  return {
    kind: 'VERIFIED_LEGACY_REFERENCE',
    populationChecksum: populationChecksum(raw),
    evidencePayloadHash: hash,
    evidenceGzipChecksum: hash,
    generatorBundleGzipChecksum: hash,
    provenance: {
      protocolVersion: 'phase5-population-3-ui-choices',
      generatorCodeHash: hash,
      seedPolicy: 'phase5-population:<position>:<zero-based-index>',
      requestedSeasonPolicy: '1 + (seedIndex mod --seasons)',
      choicePolicy: 'ui-action-strata-v1',
      legacyVersion: '1.0.0',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.3.0',
      artifacts: {
        rulesetVersion: '1.0.0',
        rulesetChecksum: registered.rulesetChecksum,
        contentPackVersion: '0.3.0',
        contentPackChecksum: registered.contentPackChecksum,
      },
      policyChecksum: populationChecksum(legacyPolicyForVersion('1.0.0')),
      countPerPosition: 10_000,
      maxSeasons: 20,
    },
    groups: (['GK', 'DF', 'MF', 'FW'] as const).map((position) => ({
      position,
      count: 10_000 as const,
      hash,
    })),
  };
}

describe('legacy reference population validator', () => {
  it('accepts the synthetic 10k-per-group artifact with the registered checksums and policy', () => {
    const raw = population();
    const validated = validateLegacyPopulation(raw, manifestFor(raw), registered);
    expect(validated.id).toBe('phase5-reference-1.0.0-1.0.0-0.3.0');
    expect(validated.scores.GK).toHaveLength(10_000);
    expect(
      validated.scores.GK.every(
        (value, index, values) => index === 0 || value >= values[index - 1]!,
      ),
    ).toBe(true);
  });

  it('deep-freezes the validated population and every score group', () => {
    const raw = population();
    const validated = validateLegacyPopulation(raw, manifestFor(raw), registered);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.scores)).toBe(true);
    expect(Object.isFrozen(validated.scores.GK)).toBe(true);
    expect(() => {
      (validated.scores.GK as unknown as number[])[0] = 49;
    }).toThrow(TypeError);
  });

  it('rejects wrong count and unsorted score groups', () => {
    const short = population();
    short.scores.GK.pop();
    expect(() => validateLegacyPopulation(short, manifestFor(short), registered)).toThrow();

    const unsorted = population();
    unsorted.scores.DF[9_999] = 0;
    expect(() => validateLegacyPopulation(unsorted, manifestFor(unsorted), registered)).toThrow(
      /sorted/,
    );
  });

  it('rejects duplicate groups and malformed population checksum', () => {
    const raw = population();
    const duplicate = manifestFor(raw);
    duplicate.groups[3] = { position: 'GK', count: 10_000, hash: 'c'.repeat(64) };
    expect(() => validateLegacyPopulation(raw, duplicate, registered)).toThrow(
      /checksum\/provenance/,
    );

    const tampered = manifestFor(raw);
    tampered.populationChecksum = 'd'.repeat(64);
    expect(() => validateLegacyPopulation(raw, tampered, registered)).toThrow(
      /checksum\/provenance/,
    );
  });

  it('rejects policy or registered artifact checksum drift', () => {
    const raw = population();
    const wrongPolicy = manifestFor(raw);
    wrongPolicy.provenance.policyChecksum = 'd'.repeat(64);
    expect(() => validateLegacyPopulation(raw, wrongPolicy, registered)).toThrow(
      /checksum\/provenance/,
    );

    const wrongRegistered = { ...registered, contentPackChecksum: 'e'.repeat(64) };
    expect(() => validateLegacyPopulation(raw, manifestFor(raw), wrongRegistered)).toThrow(
      /checksum\/provenance/,
    );
  });
});
