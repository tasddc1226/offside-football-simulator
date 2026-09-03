import type { GetCareerResponse } from '@offside/contracts';
import { decodeSnapshot } from './snapshot.js';
import type { EngineError, LocalCareerRecord } from './types.js';
import type { LocalStore } from './ports/local-store.js';

export type ImportCareerResult = { ok: true; revision: number } | { ok: false; error: EngineError };

/**
 * 복구 뒤 대조(D-20)에서 서버 커리어를 로컬로 받는다. `decodeSnapshot`으로 검증하고, 로컬에
 * 미전송 revision(`revision > lastSyncedRevision`)이 있으면 덮어쓰지 않는다.
 */
export async function importCareerFromServer(
  store: LocalStore,
  response: GetCareerResponse,
  meta: { createdServiceSeasonId: string; now: string },
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

  return store.transaction('readwrite', async (tx) => {
    const existing = await tx.careers.get(careerId);
    if (existing !== undefined && existing.revision > existing.lastSyncedRevision) {
      return {
        ok: false,
        error: { code: 'CAREER_REVISION_CONFLICT', message: '이 기기에 미전송 진행이 있어 덮어쓰지 않았다.' },
      };
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

    return { ok: true, revision };
  });
}
