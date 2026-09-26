import { generateRecoveryCode, normalizeRecoveryCode } from '../auth/recovery-code.js';
import type { Db } from '../db/client.js';
import { sha256Hex } from '../db/hash.js';
import { getAttemptCount, RATE_LIMIT_MAX, recordAttempt } from '../db/repos/authAttempts.js';
import { insertAuditLog } from '../db/repos/auditLog.js';
import { setRecoveryCode } from '../db/repos/profiles.js';
import { AppError } from '../errors.js';

export type IssueRecoveryCodeInput = { profileId: string; now: string };
export type IssueRecoveryCodeResult = { code: string; issuedAt: string };

/** API-PRO-003, D-14. 재발급은 이전 코드를 즉시 무효로 만든다(해시 덮어쓰기). */
export async function issueRecoveryCode(
  db: Db,
  input: IssueRecoveryCodeInput,
): Promise<IssueRecoveryCodeResult> {
  const attempts = await getAttemptCount(db, 'RECOVERY_ISSUE', input.profileId, input.now);
  if (attempts >= RATE_LIMIT_MAX) {
    throw new AppError({ code: 'RATE_LIMITED', message: '복구 코드 발급 횟수를 초과했습니다.' });
  }
  await recordAttempt(db, 'RECOVERY_ISSUE', input.profileId, input.now);

  const code = generateRecoveryCode();
  const hash = await sha256Hex(normalizeRecoveryCode(code));
  await setRecoveryCode(db, input.profileId, { recoveryCodeHash: hash, issuedAt: input.now });
  await insertAuditLog(db, {
    kind: 'RECOVERY_CODE_ISSUED',
    profileId: input.profileId,
    payload: {},
    createdAt: input.now,
  });

  return { code, issuedAt: input.now };
}
