import { canonicalize, type JsonValue } from '../canonical.js';
import { sha256Hex } from '../hash.js';
import {
  ArchiveError,
  requireArchiveVersion,
  requireArtifactChecksum,
  verifyCareerArchiveCore,
  type ArchiveContext,
  type CareerArchiveCore,
} from './archive.js';

/** Registry definition metadata, not component scores or an eligibility result. */
export type LegacyDefinitionBinding = Readonly<{
  rulesetVersion: string;
  legacyVersion: string;
  definitionChecksum: string;
  referencePopulationId: string;
  referencePopulationChecksum: string;
}>;

export type ArchiveLegacyBinding = Readonly<
  LegacyDefinitionBinding & {
    evaluationId: string;
    archiveId: string;
    archiveHash: string;
  }
>;

function canonical(value: unknown): string {
  return canonicalize(value as JsonValue);
}

/** Each version addresses a new result row; the core and previous results remain unchanged. */
export function bindArchiveLegacyVersion(
  archive: CareerArchiveCore,
  context: ArchiveContext,
  definition: LegacyDefinitionBinding,
): ArchiveLegacyBinding {
  const verified = verifyCareerArchiveCore(archive, context);
  if (!verified.ok) throw new ArchiveError(verified.code);
  requireArchiveVersion(definition.rulesetVersion);
  requireArchiveVersion(definition.legacyVersion);
  requireArtifactChecksum(definition.definitionChecksum);
  requireArtifactChecksum(definition.referencePopulationChecksum);
  if (
    typeof definition.referencePopulationId !== 'string' ||
    definition.referencePopulationId.trim().length === 0
  )
    throw new ArchiveError('INVALID_BINDING');
  if (definition.rulesetVersion !== archive.binding.rulesetVersion)
    throw new ArchiveError('VERSION_MISMATCH');
  return Object.freeze({
    evaluationId: `lev_${sha256Hex(canonical({ archiveId: archive.archiveId, legacyVersion: definition.legacyVersion }))}`,
    archiveId: archive.archiveId,
    archiveHash: archive.hash,
    rulesetVersion: definition.rulesetVersion,
    legacyVersion: definition.legacyVersion,
    definitionChecksum: definition.definitionChecksum,
    referencePopulationId: definition.referencePopulationId,
    referencePopulationChecksum: definition.referencePopulationChecksum,
  });
}

/** Detect same-version registry drift before storing a future full LegacyResult. */
export function planArchiveLegacyBindingWrite(
  existing: ArchiveLegacyBinding | null,
  archive: CareerArchiveCore,
  context: ArchiveContext,
  definition: LegacyDefinitionBinding,
): Readonly<{ kind: 'INSERT' | 'REUSE'; binding: ArchiveLegacyBinding }> {
  const candidate = bindArchiveLegacyVersion(archive, context, definition);
  if (existing === null) return Object.freeze({ kind: 'INSERT', binding: candidate });
  if (canonical(existing) !== canonical(candidate))
    throw new ArchiveError('LEGACY_DEFINITION_CONFLICT');
  return Object.freeze({ kind: 'REUSE', binding: candidate });
}
