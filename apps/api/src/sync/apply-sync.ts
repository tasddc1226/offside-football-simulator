import { SNAPSHOT_STATE_RECOMMENDED_BYTES, type PutCareerBody } from '@offside/contracts';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { runBatch } from '../db/repos/batch.js';
import { getCareer } from '../db/repos/careers.js';
import { getSnapshotByRevision, pruneSnapshots } from '../db/repos/snapshots.js';
import { careerArchives, careers, commandLog, serviceSeasons, snapshots } from '../db/schema.js';
import { buildRetirementRows } from './retirement.js';
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
      JSON.stringify({
        level: 'warn',
        msg: 'SNAPSHOT_STATE_OVER_RECOMMENDED',
        careerId,
        revision,
        bytes,
      }),
    );
  }
}

/**
 * 설계 결정 2·3·4·6·7의 흐름을 하나로 묶는다. 서버는 시뮬레이션·리플레이를 하지 않는다(ADR-003):
 * `verifyIncomingSnapshot`은 재계산이 아니라 stateHash·형식·버전 필드의 정합성만 본다.
 */
export async function applySync(
  db: Db,
  { profileId, careerId, body, now }: ApplySyncInput,
): Promise<ApplySyncResult> {
  const existing = await getCareer(db, careerId);

  if (!existing) {
    if (body.baseRevision !== 0) {
      throw new AppError({ code: 'CAREER_NOT_FOUND', message: '커리어를 찾을 수 없습니다.' });
    }
    const [season] = await db
      .select({
        id: serviceSeasons.id,
        status: serviceSeasons.status,
        rulesetVersion: serviceSeasons.rulesetVersion,
        contentPackVersion: serviceSeasons.contentPackVersion,
      })
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
    // T-2-012 D-54: 신규 생성만 검사한다 — 시즌이 닫혀도 기존 커리어의 후속 PUT은 계속된다.
    if (season.status !== 'PRESEASON' && season.status !== 'ACTIVE') {
      throw new AppError({ code: 'SERVICE_SEASON_CLOSED', message: '서비스 시즌이 닫혔습니다.' });
    }
    // 신규 커리어만 생성 대상 서비스 시즌의 manifest와 맞아야 한다. 기존 커리어는 생성 당시 버전에
    // 고정되므로 시즌 포인터나 manifest가 바뀐 뒤에도 replay·후속 PUT을 계속 허용한다.
    if (
      season.rulesetVersion !== body.rulesetVersion ||
      season.contentPackVersion !== body.contentPackVersion
    ) {
      throw new AppError({
        code: 'VERSION_MISMATCH',
        message: '서비스 시즌과 커리어 버전이 다릅니다.',
        details: {
          reason: 'SERVICE_SEASON_VERSION_MISMATCH',
          expectedRulesetVersion: season.rulesetVersion,
          expectedContentPackVersion: season.contentPackVersion,
        },
      });
    }
  } else {
    if (existing.ownerProfileId !== profileId) {
      throw new AppError({ code: 'CAREER_NOT_OWNED', message: '이 커리어의 소유자가 아닙니다.' });
    }
    if (existing.status === 'ARCHIVED') {
      throw new AppError({ code: 'CAREER_ARCHIVED', message: '이미 보관된 커리어입니다.' });
    }
    if (existing.status === 'RETIRED') {
      if (
        await checkAlreadyApplied(
          db,
          careerId,
          body.snapshot.revision,
          body.snapshot.stateHash,
          existing.revision,
        )
      ) {
        // A terminal retry must preserve the immutable evaluation binding as well as the snapshot.
        // Earlier already-applied ACTIVE revisions have no retirement pin and remain idempotent.
        if (body.snapshot.revision === existing.revision) {
          const [storedArchive] = await db
            .select({ legacyJson: careerArchives.legacyJson })
            .from(careerArchives)
            .where(eq(careerArchives.careerId, careerId))
            .limit(1);
          const storedLegacy: unknown =
            storedArchive === undefined ? null : JSON.parse(storedArchive.legacyJson);
          const validObject = storedLegacy !== null && typeof storedLegacy === 'object';
          const storedPin =
            validObject && 'referencePopulationId' in storedLegacy
              ? storedLegacy.referencePopulationId
              : undefined;
          const storedVersion =
            validObject && 'legacyVersion' in storedLegacy &&
            (storedLegacy.legacyVersion === '1.0.0' || storedLegacy.legacyVersion === '1.1.0')
              ? storedLegacy.legacyVersion
              : undefined;
          if (
            storedPin === undefined ||
            storedPin !== (body.retirementReferencePopulationId ?? null) ||
            storedVersion !== (body.retirementLegacyVersion ?? '1.0.0')
          ) {
            throw new AppError({
              code: 'VALIDATION_FAILED',
              message: '이미 보관된 Legacy 평가 기준은 변경할 수 없습니다.',
              details: { reason: 'RETIREMENT_REFERENCE_CONFLICT' },
            });
          }
        }
        return {
          revision: existing.revision,
          syncedAt: now,
          verificationStatus: existing.verificationStatus,
        };
      }
      throw new AppError({
        code: 'CAREER_ARCHIVED',
        message: '은퇴한 커리어는 다시 진행할 수 없습니다.',
      });
    }
    if (
      existing.rulesetVersion !== body.rulesetVersion ||
      existing.contentPackVersion !== body.contentPackVersion
    ) {
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
        return {
          revision: existing.revision,
          syncedAt: now,
          verificationStatus: existing.verificationStatus,
        };
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
  const retirementRow =
    verified.status === 'RETIRED'
      ? buildRetirementRows(
          careerId,
          existing?.createdServiceSeasonId ?? body.createdServiceSeasonId,
          body,
          now,
        )
      : null;

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
        .set({
          revision: body.snapshot.revision,
          status: verified.status,
          lastSyncedAt: now,
          updatedAt: now,
        })
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
    ...(retirementRow === null ? [] : [db.insert(careerArchives).values(retirementRow)]),
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
      throw new AppError({
        code: 'SERVICE_UNAVAILABLE',
        message: '동기화 처리 중 오류가 발생했습니다.',
      });
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
      return {
        revision: refreshed.revision,
        syncedAt: now,
        verificationStatus: refreshed.verificationStatus,
      };
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

  // 첫 동기화는 verification_status 컬럼의 DB 기본값(PENDING)을 그대로 쓴다. 이후 동기화는 UPDATE가
  // 그 컬럼을 건드리지 않으므로 batch 이전에 읽어둔 `existing` 값이 여전히 정확하다.
  return {
    revision: body.snapshot.revision,
    syncedAt: now,
    verificationStatus: existing?.verificationStatus ?? 'PENDING',
  };
}
