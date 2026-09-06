import {
  canonicalize,
  sha256Hex,
  legacyPolicyForVersion,
  type JsonValue,
  type LegacyReferencePopulation,
  type LegacyVersion,
} from '@offside/domain';
import {
  isRegisteredLegacyPopulationProvenance,
  LegacyPopulationSchema,
  PopulationManifestSchema,
} from './population-schema.ts';

export { PopulationManifestSchema, type PopulationManifest } from './population-schema.ts';
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
  const population = LegacyPopulationSchema.parse(raw);
  const provenance = manifest.provenance;
  const isLegacyV3 =
    provenance.protocolVersion === 'phase5-population-3-ui-choices' &&
    provenance.choicePolicy === 'ui-action-strata-v1' &&
    provenance.rulesetVersion === '1.0.0' &&
    provenance.artifacts.rulesetVersion === '1.0.0';
  const expectedId = isLegacyV3
    ? `phase5-reference-${population.legacyVersion}-1.0.0-0.3.0`
    : `phase5-reference-${provenance.legacyVersion}-${provenance.rulesetVersion}-${provenance.contentPackVersion}-${provenance.choicePolicy}-${populationChecksum(provenance)}`;
  if (
    !isRegisteredLegacyPopulationProvenance(provenance) ||
    provenance.legacyVersion !== population.legacyVersion ||
    provenance.rulesetVersion !== population.rulesetVersion ||
    population.id !== expectedId ||
    manifest.populationChecksum !== populationChecksum(population) ||
    provenance.policyChecksum !==
      populationChecksum(legacyPolicyForVersion(population.legacyVersion as LegacyVersion)) ||
    provenance.artifacts.rulesetChecksum !== registered.rulesetChecksum ||
    provenance.artifacts.contentPackChecksum !== registered.contentPackChecksum ||
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
