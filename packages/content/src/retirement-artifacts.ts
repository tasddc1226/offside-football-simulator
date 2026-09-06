import ruleset100Manifest from '../rulesets/1.0.0/manifest.json' with { type: 'json' };
import ruleset110Manifest from '../rulesets/1.1.0/manifest.json' with { type: 'json' };
import { loadLegacyReferencePopulation } from './legacy/load-population.ts';
import { loadContentPack } from './packs/load-content-pack.ts';
import { loadRuleset } from './rulesets/load-ruleset.ts';
import { RulesetManifestSchema } from './schema/ruleset-manifest.ts';
import type { LegacyReferencePopulation, LegacyVersion } from '@offside/domain';

export type RetirementArtifacts = Readonly<{
  rulesetVersion: string;
  rulesetChecksum: string;
  contentPackVersion: string;
  contentPackChecksum: string;
  legacyReferencePopulation?: LegacyReferencePopulation;
  /** Absent means the original policy. Activate a new version only after balance acceptance. */
  legacyVersion?: LegacyVersion;
}>;

const RULESET_MANIFESTS: Readonly<Record<string, unknown>> = Object.freeze({
  '1.0.0': ruleset100Manifest,
  '1.1.0': ruleset110Manifest,
});

/** Return existing registry checksums, not a second hash dialect of parsed objects.
 * The content CI gate verifies raw files via computeRulesetChecksum/computePackChecksum.
 * Runtime schemas add defaults and packs contain Maps; their hashes are different artifacts. */
export function loadRetirementArtifacts(
  rulesetVersion: string,
  contentPackVersion: string,
): RetirementArtifacts {
  loadRuleset(rulesetVersion);
  const contentPack = loadContentPack(contentPackVersion);
  const manifest = RulesetManifestSchema.parse(
    Object.hasOwn(RULESET_MANIFESTS, rulesetVersion)
      ? RULESET_MANIFESTS[rulesetVersion]
      : undefined,
  );
  if (
    manifest.version !== rulesetVersion ||
    !contentPack.manifest.compatibleRulesetVersions.includes(rulesetVersion)
  ) {
    throw new Error('Retirement artifact version mismatch');
  }

  const activatesLegacy110 = rulesetVersion === '1.1.0' && contentPackVersion === '0.3.0';
  const legacyReferencePopulation = activatesLegacy110
    ? loadLegacyReferencePopulation('1.1.0', rulesetVersion)
    : null;
  if (activatesLegacy110 && legacyReferencePopulation === null) {
    throw new Error('Retirement Legacy reference population is unavailable');
  }

  return Object.freeze({
    rulesetVersion,
    rulesetChecksum: manifest.checksum,
    contentPackVersion,
    contentPackChecksum: contentPack.manifest.checksum,
    ...(legacyReferencePopulation === null
      ? {}
      : {
          legacyVersion: '1.1.0' as const,
          legacyReferencePopulation,
        }),
  });
}
