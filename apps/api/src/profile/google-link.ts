import type { Db } from '../db/client.js';
import { insertAuditLog } from '../db/repos/auditLog.js';
import { moveCareers } from '../db/repos/careers.js';
import {
  getProfile,
  getProfileByGoogleSub,
  isLinked,
  linkGoogleAccount,
  type ProfileRecord,
} from '../db/repos/profiles.js';
import { AppError } from '../errors.js';

export type GoogleCallbackOutcome = { kind: 'linked' } | { kind: 'switched'; profileId: string };

export type ResolveGoogleCallbackInput = {
  sub: string;
  email: string | null;
  currentProfileId: string;
  sessionId: string;
  now: string;
};

/** 감사 로그에는 도메인만 남긴다(브리프: 이메일 전체 금지). */
function emailDomain(email: string | null): string | null {
  if (email === null) return null;
  const at = email.indexOf('@');
  return at === -1 ? null : email.slice(at + 1);
}

/** 구글·토스 연결도 복구 코드도 없는 프로필 — 이 브라우저 세션 말고는 다시 찾아갈 방법이 없다. */
const isAnonymous = (p: ProfileRecord) => !isLinked(p) && p.recoveryCodeHash === null;

/**
 * T-9-001a: 프로필에는 더 이상 서버 소유 데이터(커리어 등)가 없으므로 병합 충돌이 없다. `sub`가
 * 처음이거나 이미 현재 프로필에 연결돼 있으면 `linked`. 다른 프로필에 연결돼 있으면 그 프로필로
 * 바로 전환한다(`switched`) — 현재 프로필이 익명이면 그 커리어를 전환할 계정으로 옮긴다(T-10-013).
 */
export async function resolveGoogleCallback(
  db: Db,
  input: ResolveGoogleCallbackInput,
): Promise<GoogleCallbackOutcome> {
  const target = await getProfileByGoogleSub(db, input.sub);

  if (!target || target.deletedAt !== null || target.id === input.currentProfileId) {
    const current = await getProfile(db, input.currentProfileId);
    if (!current) {
      throw new AppError({ code: 'PROFILE_REQUIRED', message: '프로필을 찾을 수 없습니다.' });
    }
    if (current.googleSub !== input.sub || current.email !== input.email) {
      await linkGoogleAccount(db, input.currentProfileId, {
        googleSub: input.sub,
        email: input.email,
        linkedAt: input.now,
      });
    }
    await insertAuditLog(db, {
      kind: 'GOOGLE_LINKED',
      profileId: input.currentProfileId,
      payload: { emailDomain: emailDomain(input.email) },
      createdAt: input.now,
    });
    return { kind: 'linked' };
  }

  // T-10-013: 로그인 전(익명)에 쌓은 커리어는 전환하면 다시 찾을 수 없으니 로그인한 계정으로 옮긴다.
  const current = await getProfile(db, input.currentProfileId);
  if (current && isAnonymous(current)) {
    const count = await moveCareers(db, current.id, target.id);
    if (count) {
      await insertAuditLog(db, {
        kind: 'CAREERS_MERGED',
        profileId: target.id,
        payload: { fromProfileId: current.id, count },
        createdAt: input.now,
      });
    }
  }
  return { kind: 'switched', profileId: target.id };
}
