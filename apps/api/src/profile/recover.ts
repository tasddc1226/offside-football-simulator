import { normalizeRecoveryCode } from '../auth/recovery-code.js';
import type { Db } from '../db/client.js';
import { sha256Hex } from '../db/hash.js';
import { getAttemptCount, RATE_LIMIT_MAX, recordAttempt } from '../db/repos/authAttempts.js';
import { getProfileByRecoveryCodeHash } from '../db/repos/profiles.js';
import { rebindSessionProfile } from '../db/repos/sessions.js';
import { AppError } from '../errors.js';

export type RecoverProfileInput = {
  code: string;
  currentProfileId: string;
  sessionId: string;
  ip: string;
  now: string;
};

export type RecoverProfileResult = { profileId: string };

/**
 * API-PRO-004, D-14. 존재하지 않는 코드와 삭제된 프로필의 코드는 같은 오류·같은 흐름으로
 * 처리해 존재 여부를 구분하지 않는다. 실패(잘못된 코드)만 rate limit에 반영한다. T-9-001a:
 * 프로필에는 서버 소유 데이터(커리어 등)가 더 이상 없으므로 병합 충돌 없이 항상 세션을
 * 대상 프로필로 재바인딩한다.
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
    return { profileId: target.id };
  }

  await rebindSessionProfile(db, input.sessionId, target.id);
  return { profileId: target.id };
}
