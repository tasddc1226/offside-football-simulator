import { normalizeRecoveryCode } from '../auth/recovery-code.js';
import type { Db } from '../db/client.js';
import { sha256Hex } from '../db/hash.js';
import { getAttemptCount, RATE_LIMIT_MAX, recordAttempt } from '../db/repos/authAttempts.js';
import { countCareersByOwner } from '../db/repos/careers.js';
import { getProfileByRecoveryCodeHash } from '../db/repos/profiles.js';
import { rebindSessionProfile } from '../db/repos/sessions.js';
import { AppError } from '../errors.js';
import { moveCareersAndRebind } from './merge.js';

export type MergeChoice = 'MOVE_TO_LINKED' | 'KEEP_LINKED_ONLY';

export type RecoverProfileInput = {
  code: string;
  mergeChoice?: MergeChoice;
  currentProfileId: string;
  sessionId: string;
  ip: string;
  now: string;
};

export type RecoverProfileResult = { profileId: string; careerCount: number };

/**
 * API-PRO-004, D-14, ADR-008. 존재하지 않는 코드와 삭제된 프로필의 코드는 같은 오류·같은 흐름으로
 * 처리해 존재 여부를 구분하지 않는다. 실패(잘못된 코드)만 rate limit에 반영하고, 병합 충돌·성공은
 * 반영하지 않는다.
 */
export async function recoverProfile(db: Db, input: RecoverProfileInput): Promise<RecoverProfileResult> {
  const subject = `${input.ip}:${input.sessionId}`;
  const attempts = await getAttemptCount(db, 'RECOVERY_REDEEM', subject, input.now);
  if (attempts >= RATE_LIMIT_MAX) {
    throw new AppError({ code: 'RATE_LIMITED', message: '복구 시도 횟수를 초과했습니다.' });
  }

  const hash = await sha256Hex(normalizeRecoveryCode(input.code));
  const target = await getProfileByRecoveryCodeHash(db, hash);

  if (!target || target.deletedAt !== null) {
    await recordAttempt(db, 'RECOVERY_REDEEM', subject, input.now);
    throw new AppError({ code: 'RECOVERY_CODE_INVALID', message: '복구 코드가 올바르지 않습니다.' });
  }

  if (target.id === input.currentProfileId) {
    return { profileId: target.id, careerCount: await countCareersByOwner(db, target.id) };
  }

  const currentCareerCount = await countCareersByOwner(db, input.currentProfileId);

  if (currentCareerCount > 0) {
    if (!input.mergeChoice) {
      const targetCareerCount = await countCareersByOwner(db, target.id);
      throw new AppError({
        code: 'RECOVERY_CONFLICT',
        message: '현재 프로필에 진행 중인 커리어가 있습니다.',
        details: { currentCareerCount, targetCareerCount },
      });
    }

    if (input.mergeChoice === 'MOVE_TO_LINKED') {
      await moveCareersAndRebind(db, {
        fromProfileId: input.currentProfileId,
        toProfileId: target.id,
        sessionId: input.sessionId,
        now: input.now,
      });
      return { profileId: target.id, careerCount: await countCareersByOwner(db, target.id) };
    }
  }

  // KEEP_LINKED_ONLY, 또는 현재 프로필에 옮길 커리어가 없는 경우: 세션만 재바인딩한다.
  await rebindSessionProfile(db, input.sessionId, target.id);
  return { profileId: target.id, careerCount: await countCareersByOwner(db, target.id) };
}
