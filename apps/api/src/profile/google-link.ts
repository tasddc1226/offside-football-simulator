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

/** 로그인 결과(구글·애플). profileId = 이제 세션을 줄 프로필(연결이면 현재 프로필). */
export type SignInOutcome = { kind: 'linked' | 'switched'; profileId: string };

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
 * 로그인 수단 공통 규칙(구글·애플). 그 계정(`target`)이 처음이거나 이미 현재 프로필이면 현재 프로필에 연결(`link`)하고
 * `linked`, 다른 프로필에 연결돼 있으면 그 프로필로 바로 전환한다(`switched`) — 현재 프로필이 익명이면 그 커리어를
 * 전환할 계정으로 옮긴다(T-10-013). T-9-001a: 프로필에는 서버 소유 데이터가 없어 병합 충돌이 없다.
 */
export async function resolveSignIn(
  db: Db,
  input: {
    target: ProfileRecord | undefined;
    currentProfileId: string;
    now: string;
    link: (current: ProfileRecord) => Promise<void>;
  },
): Promise<SignInOutcome> {
  const { target } = input;
  if (!target || target.deletedAt !== null || target.id === input.currentProfileId) {
    const current =
      target?.id === input.currentProfileId ? target : await getProfile(db, input.currentProfileId);
    if (!current) {
      throw new AppError({ code: 'PROFILE_REQUIRED', message: '프로필을 찾을 수 없습니다.' });
    }
    await input.link(current);
    return { kind: 'linked', profileId: current.id };
  }
  await adoptAnonymousCareers(db, input.currentProfileId, target.id, input.now);
  return { kind: 'switched', profileId: target.id };
}

export async function resolveGoogleCallback(
  db: Db,
  input: ResolveGoogleCallbackInput,
): Promise<SignInOutcome> {
  return resolveSignIn(db, {
    target: await getProfileByGoogleSub(db, input.sub),
    currentProfileId: input.currentProfileId,
    now: input.now,
    link: async (current) => {
      if (current.googleSub !== input.sub || current.email !== input.email) {
        await linkGoogleAccount(db, current.id, {
          googleSub: input.sub,
          email: input.email,
          linkedAt: input.now,
        });
      }
      await insertAuditLog(db, {
        kind: 'GOOGLE_LINKED',
        profileId: current.id,
        payload: { emailDomain: emailDomain(input.email) },
        createdAt: input.now,
      });
    },
  });
}

/** T-10-013: 로그인 전(익명)에 쌓은 커리어는 전환하면 다시 찾을 수 없으니 로그인한 계정으로 옮긴다(구글·애플 공용). */
export async function adoptAnonymousCareers(
  db: Db,
  currentProfileId: string,
  targetId: string,
  now: string,
): Promise<void> {
  const current = await getProfile(db, currentProfileId);
  if (!current || !isAnonymous(current)) return;
  const count = await moveCareers(db, current.id, targetId);
  if (count) {
    await insertAuditLog(db, {
      kind: 'CAREERS_MERGED',
      profileId: targetId,
      payload: { fromProfileId: current.id, count },
      createdAt: now,
    });
  }
}
