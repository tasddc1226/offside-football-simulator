import type { LegacyReferencePopulation } from '@offside/domain';
import population110 from '../../legacy/1.1.0/reference-population.json' with { type: 'json' };
import manifest110 from '../../legacy/1.1.0/manifest.json' with { type: 'json' };
import ruleset110Manifest from '../../rulesets/1.1.0/manifest.json' with { type: 'json' };
import pack030Manifest from '../../packs/0.3.0/manifest.json' with { type: 'json' };
import { validateLegacyPopulation } from './validate-population.ts';

// Parse, bind to registered content checksums, and freeze once at module initialization.
const published110 = validateLegacyPopulation(population110, manifest110, {
  rulesetChecksum: ruleset110Manifest.checksum,
  contentPackChecksum: pack030Manifest.checksum,
});

export function loadLegacyReferencePopulation(
  legacyVersion: string,
  rulesetVersion: string,
): LegacyReferencePopulation | null {
  if (legacyVersion === '1.1.0' && rulesetVersion === '1.1.0') return published110;
  return null;
}
