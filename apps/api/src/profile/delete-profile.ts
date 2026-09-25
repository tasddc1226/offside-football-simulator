import { and, eq, isNull } from 'drizzle-orm';
import { signConfirmToken, verifyConfirmToken } from '../auth/confirm-token.js';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { runBatch } from '../db/repos/batch.js';
import { deleteBoardCommentsStatement } from '../db/repos/boards.js';
import { deleteCareersStatements } from '../db/repos/careers.js';
import { deleteClubCustomStatement } from '../db/repos/clubCustom.js';
import { auditLog, idempotency, profiles, sessions } from '../db/schema.js';
import { AppError } from '../errors.js';

const CONFIRM_TOKEN_TTL_MS = 10 * 60 * 1000;

export type IssueDeleteConfirmTokenInput = {
  sessionId: string;
  sessionTokenHash: string;
  now: string;
};
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
 * API-PRO-005 2단계. `deleted_at` 기록·idempotency 삭제·세션 전부 폐기·감사 로그를 한
 * 트랜잭션(runBatch)으로 묶는다. T-9-001a: 커리어 등 서버 소유 게임 데이터는 더 이상 없다.
 */
export async function executeProfileDeletion(
  db: Db,
  input: ExecuteProfileDeletionInput,
): Promise<void> {
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

  await runBatch(db, [
    // T-1-013 D-21: google_sub·email·linked_at도 비운다 — 그러지 않으면 unique index
    // (profiles_google_sub_unique)가 같은 Google 계정의 재연결을 막는다.
    db
      .update(profiles)
      .set({ deletedAt: input.now, googleSub: null, email: null, linkedAt: null, nickname: null })
      .where(eq(profiles.id, input.profileId)),
    // T-9-009: profiles는 소프트 삭제(deletedAt만 세팅)라 FK ON DELETE CASCADE가 트리거되지 않는다.
    // 커리어·시즌 데이터는 이 batch에서 명시적으로 지운다.
    ...deleteCareersStatements(db, input.profileId),
    deleteClubCustomStatement(db, input.profileId),
    deleteBoardCommentsStatement(db, input.profileId),
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
