import { z } from 'zod';

export const legacyPopulationHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const scores = z
  .array(z.number().int().min(0).max(100))
  .length(10_000)
  .refine(
    (values) => values.every((value, index) => index === 0 || value >= values[index - 1]!),
    'Scores must be sorted',
  );

export const LegacyPopulationSchema = z
  .object({
    id: z.string().min(1),
    legacyVersion: z.enum(['1.0.0', '1.1.0']),
    rulesetVersion: z.enum(['1.0.0', '1.1.0']),
    scores: z.object({ GK: scores, DF: scores, MF: scores, FW: scores }).strict(),
  })
  .strict();

export const PopulationManifestSchema = z
  .object({
    kind: z.literal('VERIFIED_LEGACY_REFERENCE'),
    populationChecksum: legacyPopulationHashSchema,
    evidencePayloadHash: legacyPopulationHashSchema,
    evidenceGzipChecksum: legacyPopulationHashSchema,
    generatorBundleGzipChecksum: legacyPopulationHashSchema,
    provenance: z
      .object({
        protocolVersion: z.enum([
          'phase5-population-3-ui-choices',
          'phase5-population-5-policy-isolation',
        ]),
        generatorCodeHash: legacyPopulationHashSchema,
        seedPolicy: z.literal('phase5-population:<position>:<zero-based-index>'),
        requestedSeasonPolicy: z.literal('1 + (seedIndex mod --seasons)'),
        choicePolicy: z.enum(['ui-action-strata-v1', 'ui-mixed-v1']),
        legacyVersion: z.enum(['1.0.0', '1.1.0']),
        rulesetVersion: z.enum(['1.0.0', '1.1.0']),
        contentPackVersion: z.literal('0.3.0'),
        artifacts: z
          .object({
            rulesetVersion: z.enum(['1.0.0', '1.1.0']),
            rulesetChecksum: legacyPopulationHashSchema,
            contentPackVersion: z.literal('0.3.0'),
            contentPackChecksum: legacyPopulationHashSchema,
          })
          .strict(),
        policyChecksum: legacyPopulationHashSchema,
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
            hash: legacyPopulationHashSchema,
          })
          .strict(),
      )
      .length(4),
  })
  .strict();

export type PopulationManifest = z.infer<typeof PopulationManifestSchema>;

export function isRegisteredLegacyPopulationProvenance(
  provenance: PopulationManifest['provenance'],
): boolean {
  const artifactVersionsMatch =
    provenance.artifacts.rulesetVersion === provenance.rulesetVersion &&
    provenance.artifacts.contentPackVersion === provenance.contentPackVersion;
  return (
    artifactVersionsMatch &&
    ((provenance.protocolVersion === 'phase5-population-3-ui-choices' &&
      provenance.choicePolicy === 'ui-action-strata-v1' &&
      provenance.rulesetVersion === '1.0.0') ||
      (provenance.protocolVersion === 'phase5-population-5-policy-isolation' &&
        provenance.choicePolicy === 'ui-mixed-v1' &&
        provenance.legacyVersion === '1.1.0' &&
        provenance.rulesetVersion === '1.1.0'))
  );
}
