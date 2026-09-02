import { SNAPSHOT_STATE_RECOMMENDED_BYTES, type PutCareerBody } from '@offside/contracts';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { runBatch } from '../db/repos/batch.js';
import { getCareer, type CareerRecord } from '../db/repos/careers.js';
import { getSnapshotByRevision, pruneSnapshots } from '../db/repos/snapshots.js';
import { careers, commandLog, serviceSeasons, snapshots } from '../db/schema.js';
import { AppError } from '../errors.js';
import { verifyIncomingSnapshot } from './verify-snapshot.js';

export type ApplySyncInput = {
  profileId: string;
  careerId: string;
  body: PutCareerBody;
  now: string;
};

export type ApplySyncResult = {
  revision: number;
  syncedAt: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'FAILED';
};

function conflictError(serverRevision: number, careerId: string): AppError {
  return new AppError({
    code: 'CAREER_REVISION_CONFLICT',
    message: '다른 기기에서 커리어가 먼저 진행되었습니다.',
    details: { serverRevision, serverSnapshotUrl: `/v1/careers/${careerId}` },
  });
}

/** 설계 결정 4: 요청 `(revision, stateHash)`가 서버에 이미 반영돼 있으면 재작성 없이 성공으로 본다. */
async function checkAlreadyApplied(
  db: Db,
  careerId: string,
  requestedRevision: number,
  requestedHash: string,
  serverRevision: number,
): Promise<boolean> {
  if (requestedRevision > serverRevision) return false;
  const stored = await getSnapshotByRevision(db, careerId, requestedRevision);
  return stored !== undefined && stored.stateHash === requestedHash;
}

function warnIfStateOversized(careerId: string, revision: number, state: string): void {
  const bytes = new TextEncoder().encode(state).length;
  if (bytes > SNAPSHOT_STATE_RECOMMENDED_BYTES) {
    console.log(
      JSON.stringify({ level: 'warn', msg: 'SNAPSHOT_STATE_OVER_RECOMMENDED', careerId, revision, bytes }),
    );
  }
}

/**
 * 설계 결정 2·3·4·6·7의 흐름을 하나로 묶는다. 서버는 시뮬레이션·리플레이를 하지 않는다(ADR-003):
 * `verifyIncomingSnapshot`은 재계산이 아니라 stateHash·형식·버전 필드의 정합성만 본다.
 */
export async function applySync(db: Db, { profileId, careerId, body, now }: ApplySyncInput): Promise<ApplySyncResult> {
  const existing = await getCareer(db, careerId);

  if (!existing) {
    if (body.baseRevision !== 0) {
      throw new AppError({ code: 'CAREER_NOT_FOUND', message: '커리어를 찾을 수 없습니다.' });
    }
    const [season] = await db
      .select({ id: serviceSeasons.id })
      .from(serviceSeasons)
      .where(eq(serviceSeasons.id, body.createdServiceSeasonId))
      .limit(1);
    if (!season) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '알 수 없는 서비스 시즌입니다.',
        details: { reason: 'SERVICE_SEASON_UNKNOWN' },
      });
    }
  } else {
    if (existing.ownerProfileId !== profileId) {
      throw new AppError({ code: 'CAREER_NOT_OWNED', message: '이 커리어의 소유자가 아닙니다.' });
    }
    if (existing.status === 'ARCHIVED') {
      throw new AppError({ code: 'CAREER_ARCHIVED', message: '이미 보관된 커리어입니다.' });
    }
    if (existing.rulesetVersion !== body.rulesetVersion || existing.contentPackVersion !== body.contentPackVersion) {
      throw new AppError({ code: 'VERSION_MISMATCH', message: '버전이 서버와 다릅니다.' });
    }
    if (existing.revision !== body.baseRevision) {
      const idempotent = await checkAlreadyApplied(
        db,
        careerId,
        body.snapshot.revision,
        body.snapshot.stateHash,
        existing.revision,
      );
      if (idempotent) {
        return { revision: existing.revision, syncedAt: now, verificationStatus: existing.verificationStatus };
      }
      throw conflictError(existing.revision, careerId);
    }
  }

  const verified = await verifyIncomingSnapshot(body, careerId);
  if (!verified.ok) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: 'Snapshot 무결성 검사에 실패했습니다.',
      details: { reason: verified.reason },
    });
  }

  warnIfStateOversized(careerId, body.snapshot.revision, body.snapshot.state);

  const snapshotRow = {
    id: `${careerId}:${body.snapshot.revision}`,
    careerId,
    revision: body.snapshot.revision,
    checkpoint: body.snapshot.checkpoint,
    state: body.snapshot.state,
    stateHash: body.snapshot.stateHash,
    rulesetVersion: body.snapshot.rulesetVersion,
    contentPackVersion: body.snapshot.contentPackVersion,
    rngStateJson: JSON.stringify(body.snapshot.rngState),
    createdAt: now,
  };

  const careerStatement = existing
    ? db
        .update(careers)
        .set({ revision: body.snapshot.revision, status: verified.status, lastSyncedAt: now, updatedAt: now })
        .where(and(eq(careers.id, careerId), eq(careers.revision, body.baseRevision)))
        .returning({ id: careers.id })
    : db.insert(careers).values({
        id: careerId,
        ownerProfileId: profileId,
        status: verified.status,
        revision: body.snapshot.revision,
        createdServiceSeasonId: body.createdServiceSeasonId,
        rulesetVersion: body.rulesetVersion,
        contentPackVersion: body.contentPackVersion,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      });

  const statements = [
    careerStatement,
    db.insert(snapshots).values(snapshotRow),
    ...body.commands.map((command) =>
      db.insert(commandLog).values({
        careerId,
        revision: command.revision,
        commandId: command.commandId,
        commandType: command.commandType,
        payloadJson: JSON.stringify(command.payload),
        resultHash: command.resultHash,
        createdAt: now,
      }),
    ),
  ];

  let updateMatched = true;
  try {
    const results = await runBatch(db, statements);
    if (existing) {
      updateMatched = Array.isArray(results[0]) && results[0].length === 1;
    }
  } catch {
    updateMatched = false;
  }

  if (!updateMatched) {
    // 동시 쓰기로 batch가 실패했거나(제약 위반) UPDATE의 WHERE가 매치하지 않았다. 서버 revision을
    // 다시 읽어 설계 결정 4를 적용한다.
    const refreshed = await getCareer(db, careerId);
    if (!refreshed) {
      throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: '동기화 처리 중 오류가 발생했습니다.' });
    }
    if (refreshed.ownerProfileId !== profileId) {
      throw new AppError({ code: 'CAREER_NOT_OWNED', message: '이 커리어의 소유자가 아닙니다.' });
    }
    const idempotent = await checkAlreadyApplied(
      db,
      careerId,
      body.snapshot.revision,
      body.snapshot.stateHash,
      refreshed.revision,
    );
    if (idempotent) {
      return { revision: refreshed.revision, syncedAt: now, verificationStatus: refreshed.verificationStatus };
    }
    throw conflictError(refreshed.revision, careerId);
  }

  try {
    await pruneSnapshots(db, careerId, 5);
  } catch (err) {
    console.log(
      JSON.stringify({
        level: 'warn',
        msg: 'PRUNE_SNAPSHOTS_FAILED',
        careerId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  const record: CareerRecord | undefined = existing ?? (await getCareer(db, careerId));
  return {
    revision: body.snapshot.revision,
    syncedAt: now,
    verificationStatus: record?.verificationStatus ?? 'PENDING',
  };
}
