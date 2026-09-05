import { canonicalize, type JsonValue } from '../../packages/domain/src/canonical.ts';
import { sha256Hex } from '../../packages/domain/src/hash.ts';

type PopulationIdentity = Readonly<{
  legacyVersion: string;
  rulesetVersion: string;
  contentPackVersion: string;
  protocolVersion: string;
  choicePolicy: string;
}> &
  Readonly<Record<string, unknown>>;

/** Preserve the original registered protocol; candidate identities pin their full provenance. */
export function legacyPopulationId(provenance: PopulationIdentity): string {
  const prefix = `phase5-reference-${provenance.legacyVersion}-${provenance.rulesetVersion}-${provenance.contentPackVersion}`;
  if (
    provenance.protocolVersion === 'phase5-population-3-ui-choices' &&
    provenance.choicePolicy === 'ui-action-strata-v1' &&
    provenance.rulesetVersion === '1.0.0' &&
    provenance.contentPackVersion === '0.3.0'
  )
    return prefix;
  return `${prefix}-${provenance.choicePolicy}-${sha256Hex(canonicalize(provenance as JsonValue))}`;
}
