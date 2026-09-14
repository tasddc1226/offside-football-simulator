import ruleset100Manifest from '../rulesets/1.0.0/manifest.json' with { type: 'json' };
import ruleset110Manifest from '../rulesets/1.1.0/manifest.json' with { type: 'json' };
import ruleset120Manifest from '../rulesets/1.2.0/manifest.json' with { type: 'json' };
import ruleset130Manifest from '../rulesets/1.3.0/manifest.json' with { type: 'json' };
import ruleset140Manifest from '../rulesets/1.4.0/manifest.json' with { type: 'json' };
import ruleset150Manifest from '../rulesets/1.5.0/manifest.json' with { type: 'json' };
import ruleset160Manifest from '../rulesets/1.6.0/manifest.json' with { type: 'json' };
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
  '1.2.0': ruleset120Manifest,
  '1.3.0': ruleset130Manifest,
  '1.4.0': ruleset140Manifest,
  '1.5.0': ruleset150Manifest,
  '1.6.0': ruleset160Manifest,
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
  const activatesLegacy110WithoutPopulation =
    (rulesetVersion === '1.2.0' &&
      (contentPackVersion === '0.4.0' || contentPackVersion === '0.4.1')) ||
    ((rulesetVersion === '1.3.0' || rulesetVersion === '1.4.0') &&
      (contentPackVersion === '0.5.0' || contentPackVersion === '0.5.1')) ||
    (rulesetVersion === '1.5.0' && contentPackVersion === '0.6.0') ||
    (rulesetVersion === '1.6.0' && contentPackVersion === '0.6.1');
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
      ? activatesLegacy110WithoutPopulation
        ? { legacyVersion: '1.1.0' as const }
        : {}
      : {
          legacyVersion: '1.1.0' as const,
          legacyReferencePopulation,
        }),
  });
}
