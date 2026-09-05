import type { GetCareerResponse } from '@offside/contracts';
import { decodeSnapshot } from './snapshot.js';
import type { EngineError, LocalCareerRecord } from './types.js';
import type { LocalStore } from './ports/local-store.js';
import { ArchiveError, canonicalize, createCareerArchiveCore, createLegacyResult, type CareerArchiveCore, type LegacyResult, type JsonValue } from '@offside/domain';
import { CareerStateSchema } from '@offside/contracts';
import { legacyPopulationForResult, legacyResultKey, retirementArchiveKey, type RetirementArtifactsResolver } from './retirement-archive.js';

export type ImportCareerResult = { ok: true; revision: number } | { ok: false; error: EngineError };

/**
 * 복구 뒤 대조(D-20)에서 서버 커리어를 로컬로 받는다. `decodeSnapshot`으로 검증하고, 로컬에
 * 미전송 revision(`revision > lastSyncedRevision`)이 있으면 덮어쓰지 않는다.
 */
export async function importCareerFromServer(
  store: LocalStore,
  response: GetCareerResponse,
  meta: { createdServiceSeasonId: string; now: string; retirementArtifacts?: RetirementArtifactsResolver },
): Promise<ImportCareerResult> {
  const decoded = decodeSnapshot(response.snapshot);
  if (!decoded.ok) {
    return {
      ok: false,
      error: {
        code: 'VERIFICATION_FAILED',
        message: '서버 Snapshot 검증에 실패했다.',
        details: { reason: decoded.reason },
      },
    };
  }

  const careerId = response.snapshot.careerId;
  const revision = response.snapshot.revision;
  let retirement: { archive: CareerArchiveCore; legacy: LegacyResult } | null = null;
  if (decoded.snapshot.state.status === 'RETIRED' || decoded.snapshot.state.status === 'ARCHIVED') {
    try {
      if (meta.retirementArtifacts === undefined || response.retirementArchive === undefined || !CareerStateSchema.safeParse(decoded.snapshot.state).success) throw new ArchiveError('INVALID_SNAPSHOT');
      const binding = { careerId, createdServiceSeasonId: meta.createdServiceSeasonId, rulesetVersion: response.snapshot.rulesetVersion, contentPackVersion: response.snapshot.contentPackVersion };
      const artifacts = meta.retirementArtifacts(binding);
      const context = { binding, artifacts };
      const archive = createCareerArchiveCore(decoded.snapshot, context);
      const suppliedLegacy = JSON.parse(response.retirementArchive.legacy) as LegacyResult;
      const legacy = createLegacyResult(archive, context, legacyPopulationForResult(suppliedLegacy, artifacts));
      if (canonicalize(JSON.parse(response.retirementArchive.archive) as JsonValue) !== canonicalize(archive as unknown as JsonValue) || canonicalize(suppliedLegacy as unknown as JsonValue) !== canonicalize(legacy as unknown as JsonValue)) throw new ArchiveError('ARCHIVE_MISMATCH');
      retirement = { archive, legacy };
    } catch {
      return { ok: false, error: { code: 'VERIFICATION_FAILED', message: '서버 은퇴 보관 기록을 검증할 수 없다.' } };
    }
  } else if (response.retirementArchive !== undefined) {
    return { ok: false, error: { code: 'VERIFICATION_FAILED', message: '진행 중 커리어에 은퇴 보관 기록이 포함되어 있다.' } };
  }

  return store.transaction('readwrite', async (tx) => {
    const existing = await tx.careers.get(careerId);
    if (existing !== undefined && existing.revision > existing.lastSyncedRevision) {
      return {
        ok: false,
        error: { code: 'CAREER_REVISION_CONFLICT', message: '이 기기에 미전송 진행이 있어 덮어쓰지 않았다.' },
      };
    }
    const existingArchive = await tx.kv.get<CareerArchiveCore>(retirementArchiveKey(careerId));
    if (existingArchive !== undefined && (retirement === null || canonicalize(existingArchive as unknown as JsonValue) !== canonicalize(retirement.archive as unknown as JsonValue))) {
      return { ok: false, error: { code: 'VERIFICATION_FAILED', message: '기존 불변 은퇴 기록과 달라 덮어쓰지 않았다.' } };
    }
    const existingLegacy = await tx.kv.get<LegacyResult>(legacyResultKey(careerId));
    if (existingLegacy !== undefined && retirement !== null && canonicalize(existingLegacy as unknown as JsonValue) !== canonicalize(retirement.legacy as unknown as JsonValue)) {
      return { ok: false, error: { code: 'VERIFICATION_FAILED', message: '기존 불변 Legacy 기록과 달라 덮어쓰지 않았다.' } };
    }

    await tx.snapshots.deleteByCareer(careerId);
    await tx.commandLog.deleteByCareer(careerId);
    await tx.idempotency.deleteByCareer(careerId);

    await tx.snapshots.put(response.snapshot);
    for (const command of response.commands) {
      await tx.commandLog.append(command);
    }

    const record: LocalCareerRecord = {
      id: careerId,
      ownerProfileId: null,
      status: decoded.snapshot.state.status,
      revision,
      lastSyncedRevision: revision,
      createdServiceSeasonId: meta.createdServiceSeasonId,
      rulesetVersion: response.snapshot.rulesetVersion,
      contentPackVersion: response.snapshot.contentPackVersion,
      createdAt: existing?.createdAt ?? meta.now,
      updatedAt: meta.now,
    };
    await tx.careers.put(record);
    if (retirement !== null) {
      await tx.kv.put(retirementArchiveKey(careerId), retirement.archive);
      await tx.kv.put(legacyResultKey(careerId), retirement.legacy);
    }

    return { ok: true, revision };
  });
}
