import type { Db } from '../db/client.js';
import { insertAuditLog } from '../db/repos/auditLog.js';
import { getProfile, getProfileByAppleSub, linkAppleAccount } from '../db/repos/profiles.js';
import { AppError } from '../errors.js';
import { adoptAnonymousCareers, type GoogleCallbackOutcome } from './google-link.js';

/**
 * T-11-003 Sign in with Apple — 구글 콜백(google-link.ts)과 같은 규칙이다. `sub`가 처음이거나 이미 현재 프로필에
 * 연결돼 있으면 현재 프로필에 연결(`linked`), 다른 프로필에 연결돼 있으면 그 프로필로 전환(`switched`)하고 현재
 * 프로필이 익명이면 그 커리어를 옮긴다.
 */
export async function resolveAppleSignIn(
  db: Db,
  input: { sub: string; currentProfileId: string; now: string },
): Promise<GoogleCallbackOutcome> {
  const target = await getProfileByAppleSub(db, input.sub);
  if (!target || target.deletedAt !== null || target.id === input.currentProfileId) {
    const current = await getProfile(db, input.currentProfileId);
    if (!current)
      throw new AppError({ code: 'PROFILE_REQUIRED', message: '프로필을 찾을 수 없습니다.' });
    if (current.appleSub !== input.sub)
      await linkAppleAccount(db, current.id, { appleSub: input.sub, linkedAt: input.now });
    await insertAuditLog(db, {
      kind: 'APPLE_LINKED',
      profileId: current.id,
      payload: {},
      createdAt: input.now,
    });
    return { kind: 'linked' };
  }
  await adoptAnonymousCareers(db, input.currentProfileId, target.id, input.now);
  return { kind: 'switched', profileId: target.id };
}
