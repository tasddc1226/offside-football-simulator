import type { Db } from '../db/client.js';
import { insertAuditLog } from '../db/repos/auditLog.js';
import { countCareersByOwner } from '../db/repos/careers.js';
import { getProfile, getProfileByGoogleSub, linkGoogleAccount } from '../db/repos/profiles.js';
import { setPendingMerge } from '../db/repos/sessions.js';
import { AppError } from '../errors.js';

const PENDING_MERGE_TTL_MS = 10 * 60 * 1000;

export type GoogleCallbackOutcome =
  | { kind: 'linked' }
  | { kind: 'switched'; profileId: string }
  | { kind: 'merge_required'; currentCareerCount: number; targetCareerCount: number };

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

/**
 * D-21, ADR-008 "연결·병합 규칙" 표. `sub`가 처음이거나 이미 현재 프로필(A)에 연결돼 있으면
 * `linked`. 다른 프로필(B)에 연결돼 있으면 A의 커리어 유무로 `switched`(A가 비어 있음, 세션을 B로
 * 즉시 재바인딩) 또는 `merge_required`(A에 커리어가 있어 선택이 필요 — 세션에 대기 병합을 남긴다)로
 * 갈린다.
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

  const currentCareerCount = await countCareersByOwner(db, input.currentProfileId);
  if (currentCareerCount === 0) {
    return { kind: 'switched', profileId: target.id };
  }

  const targetCareerCount = await countCareersByOwner(db, target.id);
  const expiresAt = new Date(Date.parse(input.now) + PENDING_MERGE_TTL_MS).toISOString();
  await setPendingMerge(db, input.sessionId, { targetProfileId: target.id, expiresAt });
  return { kind: 'merge_required', currentCareerCount, targetCareerCount };
}
