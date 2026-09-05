import {
  ArchiveError,
  createCareerArchiveCore,
  planCareerArchiveWrite,
  type ArchiveArtifacts,
  type ArchiveContext,
  type CareerArchiveCore,
  type DomainSnapshot,
} from '@offside/domain';
import type { LocalStore, LocalStoreTx } from './ports/local-store.js';
import type { LocalCareerRecord } from './types.js';
import { CareerStateSchema } from '@offside/contracts';

export type RetirementArtifactsResolver = (versions: {
  rulesetVersion: string;
  contentPackVersion: string;
}) => ArchiveArtifacts;

export function retirementArchiveKey(careerId: string): string {
  return `phase5:archive:v1:${careerId}`;
}

function contextFor(career: LocalCareerRecord, artifacts: ArchiveArtifacts): ArchiveContext {
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
  artifacts: ArchiveArtifacts,
): Promise<void> {
  if (!CareerStateSchema.safeParse(snapshot.state).success)
    throw new ArchiveError('INVALID_SNAPSHOT');
  const context = contextFor(career, artifacts);
  const candidate = createCareerArchiveCore(snapshot, context);
  const key = retirementArchiveKey(career.id);
  const existing = await tx.kv.get<CareerArchiveCore>(key);
  const plan = planCareerArchiveWrite(existing ?? null, candidate, context);
  if (plan.kind === 'INSERT') await tx.kv.put(key, plan.archive);
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
