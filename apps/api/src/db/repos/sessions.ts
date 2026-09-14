import { and, countDistinct, eq, gt, gte, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { sessions } from '../schema.js';

export type SessionRecord = typeof sessions.$inferSelect;
export type SessionChannel = SessionRecord['channel'];

export async function createSession(
  db: Db,
  input: { profileId: string; channel: SessionChannel; tokenHash: string; expiresAt: string },
): Promise<SessionRecord> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(sessions)
    .values({
      id: newId('ses'),
      profileId: input.profileId,
      channel: input.channel,
      tokenHash: input.tokenHash,
      createdAt: now,
      expiresAt: input.expiresAt,
      lastSeenAt: now,
    })
    .returning();
  return row!;
}

/** 만료되었거나(`expiresAt <= now`) 폐기된(`revokedAt` not null) 세션은 돌려주지 않는다. */
export async function findActiveSession(db: Db, tokenHash: string, now: string): Promise<SessionRecord | undefined> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
  return row;
}

export async function revokeSession(db: Db, id: string, at: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: at }).where(eq(sessions.id, id));
}

export async function getSessionById(db: Db, id: string): Promise<SessionRecord | undefined> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
  return row;
}

/** D-78 API-PRES-002: 하트비트로 갱신한다. 호출부가 30초 스로틀을 판단한다. */
export async function touchSessionLastSeen(db: Db, id: string, at: string): Promise<void> {
  await db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, id));
}

/** D-78 API-PRES-001: `sinceIso`(now - 5분) 이후 활동했고 아직 유효한 세션의 프로필 수(중복 제거). */
export async function countDistinctProfilesActiveSince(db: Db, sinceIso: string, nowIso: string): Promise<number> {
  const [row] = await db
    .select({ count: countDistinct(sessions.profileId) })
    .from(sessions)
    .where(and(gte(sessions.lastSeenAt, sinceIso), isNull(sessions.revokedAt), gt(sessions.expiresAt, nowIso)));
  return row?.count ?? 0;
}

/**
 * D-14 복구·D-21 병합: 토큰은 그대로 두고 현재 세션을 대상 프로필로 재바인딩한다. 대기 중인 병합이
 * 있었다면(D-21) 같은 문으로 함께 지운다 — 세션이 이미 다른 프로필로 옮겨간 뒤라 그 병합은 더 이상
 * 의미가 없다.
 */
export async function rebindSessionProfile(db: Db, sessionId: string, profileId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ profileId, pendingMergeProfileId: null, pendingMergeExpiresAt: null })
    .where(eq(sessions.id, sessionId));
}

/** D-21: Google 콜백이 병합 선택을 기다릴 때 세션에 남긴다(10분 TTL). */
export async function setPendingMerge(
  db: Db,
  sessionId: string,
  input: { targetProfileId: string; expiresAt: string },
): Promise<void> {
  await db
    .update(sessions)
    .set({ pendingMergeProfileId: input.targetProfileId, pendingMergeExpiresAt: input.expiresAt })
    .where(eq(sessions.id, sessionId));
}
