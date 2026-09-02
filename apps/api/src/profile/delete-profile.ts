import { and, eq, inArray, isNull } from 'drizzle-orm';
import { signConfirmToken, verifyConfirmToken } from '../auth/confirm-token.js';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { listCareerIdsByOwner } from '../db/repos/careers.js';
import { runBatch } from '../db/repos/batch.js';
import { auditLog, careers, commandLog, idempotency, profiles, sessions, snapshots } from '../db/schema.js';
import { AppError } from '../errors.js';

const CONFIRM_TOKEN_TTL_MS = 10 * 60 * 1000;

export type IssueDeleteConfirmTokenInput = { sessionId: string; sessionTokenHash: string; now: string };
export type IssueDeleteConfirmTokenResult = { confirmToken: string; expiresAt: string };

/** API-PRO-005 1단계. 별도 저장 없이 세션의 tokenHash로 서명한다(세션이 바뀌면 검증 실패). */
export async function issueDeleteConfirmToken(
  input: IssueDeleteConfirmTokenInput,
): Promise<IssueDeleteConfirmTokenResult> {
  const expiresAt = new Date(Date.parse(input.now) + CONFIRM_TOKEN_TTL_MS).toISOString();
  const confirmToken = await signConfirmToken({
    sessionId: input.sessionId,
    sessionTokenHash: input.sessionTokenHash,
    expiresAt,
  });
  return { confirmToken, expiresAt };
}

export type ExecuteProfileDeletionInput = {
  profileId: string;
  sessionId: string;
  sessionTokenHash: string;
  confirmToken: string;
  now: string;
};

/**
 * API-PRO-005 2단계. `deleted_at` 기록·커리어/Snapshot/명령 로그/idempotency 삭제·세션 전부 폐기·
 * 감사 로그를 한 트랜잭션(runBatch)으로 묶는다.
 */
export async function executeProfileDeletion(db: Db, input: ExecuteProfileDeletionInput): Promise<void> {
  const verified = await verifyConfirmToken(input.confirmToken, {
    sessionId: input.sessionId,
    sessionTokenHash: input.sessionTokenHash,
    now: input.now,
  });
  if (!verified.ok) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '삭제 확인 토큰이 올바르지 않습니다.',
      details: { reason: 'CONFIRM_TOKEN_INVALID' },
    });
  }

  const careerIds = await listCareerIdsByOwner(db, input.profileId);

  await runBatch(db, [
    db.update(profiles).set({ deletedAt: input.now }).where(eq(profiles.id, input.profileId)),
    ...(careerIds.length > 0
      ? [
          db.delete(snapshots).where(inArray(snapshots.careerId, careerIds)),
          db.delete(commandLog).where(inArray(commandLog.careerId, careerIds)),
        ]
      : []),
    db.delete(careers).where(eq(careers.ownerProfileId, input.profileId)),
    db.delete(idempotency).where(eq(idempotency.ownerProfileId, input.profileId)),
    db
      .update(sessions)
      .set({ revokedAt: input.now })
      .where(and(eq(sessions.profileId, input.profileId), isNull(sessions.revokedAt))),
    db.insert(auditLog).values({
      id: newId('aud'),
      kind: 'PROFILE_DELETED',
      profileId: input.profileId,
      payloadJson: '{}',
      createdAt: input.now,
    }),
  ]);
}
