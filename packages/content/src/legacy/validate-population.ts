import { z } from 'zod';
import {
  canonicalize,
  sha256Hex,
  LEGACY_POLICY,
  type JsonValue,
  type LegacyReferencePopulation,
} from '@offside/domain';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const scores = z
  .array(z.number().int().min(0).max(100))
  .length(10_000)
  .refine(
    (values) => values.every((value, index) => index === 0 || value >= values[index - 1]!),
    'Scores must be sorted',
  );
const PopulationSchema = z
  .object({
    id: z.literal('phase5-reference-1.0.0-0.3.0'),
    legacyVersion: z.literal('1.0.0'),
    rulesetVersion: z.literal('1.0.0'),
    scores: z.object({ GK: scores, DF: scores, MF: scores, FW: scores }).strict(),
  })
  .strict();

export const PopulationManifestSchema = z
  .object({
    kind: z.literal('VERIFIED_LEGACY_REFERENCE'),
    populationChecksum: hash,
    evidencePayloadHash: hash,
    evidenceGzipChecksum: hash,
    generatorBundleGzipChecksum: hash,
    provenance: z
      .object({
        protocolVersion: z.literal('phase5-population-2-registered-choices'),
        generatorCodeHash: hash,
        seedPolicy: z.literal('phase5-population:<position>:<zero-based-index>'),
        requestedSeasonPolicy: z.literal('1 + (seedIndex mod --seasons)'),
        choicePolicy: z.literal('registered-hash-strata-v1'),
        rulesetVersion: z.literal('1.0.0'),
        contentPackVersion: z.literal('0.3.0'),
        artifacts: z
          .object({
            rulesetVersion: z.literal('1.0.0'),
            rulesetChecksum: hash,
            contentPackVersion: z.literal('0.3.0'),
            contentPackChecksum: hash,
          })
          .strict(),
        policyChecksum: hash,
        countPerPosition: z.literal(10_000),
        maxSeasons: z.literal(20),
      })
      .strict(),
    groups: z
      .array(
        z
          .object({
            position: z.enum(['GK', 'DF', 'MF', 'FW']),
            count: z.literal(10_000),
            hash,
          })
          .strict(),
      )
      .length(4),
  })
  .strict();

export type PopulationManifest = z.infer<typeof PopulationManifestSchema>;
export function populationChecksum(value: unknown): string {
  return sha256Hex(canonicalize(value as JsonValue));
}

/** Runtime verifies the compact immutable artifact. CI additionally verifies retained raw evidence. */
export function validateLegacyPopulation(
  raw: unknown,
  rawManifest: unknown,
  registered: { rulesetChecksum: string; contentPackChecksum: string },
): LegacyReferencePopulation {
  const manifest = PopulationManifestSchema.parse(rawManifest);
  const population = PopulationSchema.parse(raw);
  if (
    manifest.populationChecksum !== populationChecksum(population) ||
    manifest.provenance.policyChecksum !== populationChecksum(LEGACY_POLICY) ||
    manifest.provenance.artifacts.rulesetChecksum !== registered.rulesetChecksum ||
    manifest.provenance.artifacts.contentPackChecksum !== registered.contentPackChecksum ||
    manifest.groups
      .map((group) => group.position)
      .sort()
      .join(',') !== 'DF,FW,GK,MF'
  )
    throw new Error('Legacy reference population checksum/provenance mismatch');
  for (const values of Object.values(population.scores)) Object.freeze(values);
  Object.freeze(population.scores);
  return Object.freeze(population);
}
