import {
  ArchiveError,
  createCareerArchiveCore,
  planCareerArchiveWrite,
  type ArchiveArtifacts,
  type ArchiveContext,
  type CareerArchiveCore,
  type DomainSnapshot,
  createLegacyResult,
  type LegacyResult,
  canonicalize,
  type JsonValue,
  type LegacyReferencePopulation,
  type LegacyVersion,
} from '@offside/domain';
import type { LocalStore, LocalStoreTx } from './ports/local-store.js';
import type { LocalCareerRecord } from './types.js';
import { CareerStateSchema } from '@offside/contracts';

export type RetirementRuntimeArtifacts = ArchiveArtifacts & {
  legacyReferencePopulation?: LegacyReferencePopulation;
  legacyVersion?: LegacyVersion;
};

export type RetirementArtifactsResolver = (versions: {
  rulesetVersion: string;
  contentPackVersion: string;
}) => RetirementRuntimeArtifacts;

/** Select the immutable reference artifact used by an already-persisted Legacy result. */
export function legacyPopulationForResult(
  stored: LegacyResult | null | undefined,
  artifacts: RetirementRuntimeArtifacts,
): LegacyReferencePopulation | undefined {
  if (stored === undefined || stored === null) return artifacts.legacyReferencePopulation;
  if (!Object.hasOwn(stored, 'referencePopulationId'))
    throw new ArchiveError('INVALID_BINDING');
  const referencePopulationId = stored.referencePopulationId;
  if (referencePopulationId === null) return undefined;
  if (typeof referencePopulationId !== 'string' || referencePopulationId.length === 0)
    throw new ArchiveError('INVALID_BINDING');
  if (
    artifacts.legacyReferencePopulation === undefined ||
    artifacts.legacyReferencePopulation.id !== referencePopulationId
  )
    throw new ArchiveError('VERSION_MISMATCH');
  return artifacts.legacyReferencePopulation;
}

/** Select and verify the immutable policy used by a persisted Legacy result. */
export function legacyVersionForResult(
  stored: LegacyResult | null | undefined,
  artifacts: Pick<RetirementRuntimeArtifacts, 'legacyVersion'>,
): LegacyVersion {
  const available = artifacts.legacyVersion ?? '1.0.0';
  if (stored === undefined || stored === null) return available;
  if (!Object.hasOwn(stored, 'legacyVersion')) throw new ArchiveError('INVALID_BINDING');
  if (stored.legacyVersion !== '1.0.0' && stored.legacyVersion !== '1.1.0')
    throw new ArchiveError('INVALID_BINDING');
  // A newer stored policy cannot be recomputed by an older resolver. Older 1.0 results
  // remain readable when the resolver has moved forward.
  if (stored.legacyVersion === '1.1.0' && available !== '1.1.0')
    throw new ArchiveError('VERSION_MISMATCH');
  return stored.legacyVersion;
}

export function retirementArchiveKey(careerId: string): string {
  return `phase5:archive:v1:${careerId}`;
}

export function legacyResultKey(careerId: string): string {
  return `phase5:legacy:1.0.0:${careerId}`;
}

function contextFor(career: LocalCareerRecord, artifacts: RetirementRuntimeArtifacts): ArchiveContext {
  return {
    binding: {
      careerId: career.id,
      createdServiceSeasonId: career.createdServiceSeasonId,
      rulesetVersion: career.rulesetVersion,
      contentPackVersion: career.contentPackVersion,
    },
    artifacts,
  };
}

/** Called inside the same RW transaction as RETIRE's snapshot, career, log and idempotency writes. */
export async function persistRetirementArchive(
  tx: LocalStoreTx,
  career: LocalCareerRecord,
  snapshot: DomainSnapshot,
  artifacts: RetirementRuntimeArtifacts,
): Promise<void> {
  if (!CareerStateSchema.safeParse(snapshot.state).success)
    throw new ArchiveError('INVALID_SNAPSHOT');
  const context = contextFor(career, artifacts);
  const candidate = createCareerArchiveCore(snapshot, context);
  const key = retirementArchiveKey(career.id);
  const existing = await tx.kv.get<CareerArchiveCore>(key);
  const plan = planCareerArchiveWrite(existing ?? null, candidate, context);
  const existingLegacy = await tx.kv.get<LegacyResult>(legacyResultKey(career.id));
  const legacy = createLegacyResult(
    plan.archive,
    context,
    legacyPopulationForResult(existingLegacy, artifacts),
    legacyVersionForResult(existingLegacy, artifacts),
  );
  if (
    existingLegacy !== undefined &&
    canonicalize(existingLegacy as unknown as JsonValue) !==
      canonicalize(legacy as unknown as JsonValue)
  )
    throw new ArchiveError('LEGACY_DEFINITION_CONFLICT');
  if (plan.kind === 'INSERT') await tx.kv.put(key, plan.archive);
  if (existingLegacy === undefined) await tx.kv.put(legacyResultKey(career.id), legacy);
}

/** Derived display projection remains reproducible even for an older core-only local archive. */
export async function loadLocalLegacyResult(
  store: LocalStore,
  careerId: string,
  ownerProfileId: string | null,
  resolveArtifacts: RetirementArtifactsResolver,
): Promise<LegacyResult | null> {
  const archive = await loadLocalCareerArchive(store, careerId, ownerProfileId, resolveArtifacts);
  if (archive === null) return null;
  const artifacts = resolveArtifacts(archive.binding);
  const stored = await store.transaction('readonly', (tx) =>
    tx.kv.get<LegacyResult>(legacyResultKey(careerId)),
  );
  const result = createLegacyResult(archive, {
    binding: archive.binding,
    artifacts,
  }, legacyPopulationForResult(stored, artifacts), legacyVersionForResult(stored, artifacts));
  if (
    stored !== undefined &&
    canonicalize(stored as unknown as JsonValue) !== canonicalize(result as unknown as JsonValue)
  )
    throw new ArchiveError('LEGACY_DEFINITION_CONFLICT');
  return result;
}

/** Private local evidence, not a public DTO or server authorization substitute. */
export async function loadLocalCareerArchive(
  store: LocalStore,
  careerId: string,
  ownerProfileId: string | null,
  resolveArtifacts: RetirementArtifactsResolver,
): Promise<CareerArchiveCore | null> {
  return store.transaction('readonly', async (tx) => {
    const career = await tx.careers.get(careerId);
    if (career === undefined || career.ownerProfileId !== ownerProfileId) return null;
    const archive = await tx.kv.get<CareerArchiveCore>(retirementArchiveKey(careerId));
    if (archive === undefined) return null;
    try {
      if (!CareerStateSchema.safeParse(JSON.parse(archive.source.state)).success) {
        throw new ArchiveError('INVALID_SNAPSHOT');
      }
    } catch {
      throw new ArchiveError('INVALID_SNAPSHOT');
    }
    if (career.status !== 'RETIRED' && career.status !== 'ARCHIVED') {
      throw new ArchiveError('RETIREMENT_REQUIRED');
    }
    const context = contextFor(career, resolveArtifacts(career));
    const plan = planCareerArchiveWrite(archive, archive, context);
    const source = await tx.snapshots.get(careerId, archive.source.revision);
    if (
      source === undefined ||
      source.stateHash !== archive.source.stateHash ||
      source.state !== archive.source.state ||
      source.checkpoint !== 'RETIREMENT'
    ) {
      throw new ArchiveError('ARCHIVE_MISMATCH');
    }
    return plan.archive;
  });
}
