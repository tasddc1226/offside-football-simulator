import { and, eq, gt, isNull } from 'drizzle-orm';
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

/** API-PRO-005: 삭제 확정 시 프로필의 모든 세션을 폐기한다. 이미 폐기된 세션은 건드리지 않는다. */
export async function revokeAllSessionsForProfile(db: Db, profileId: string, at: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: at })
    .where(and(eq(sessions.profileId, profileId), isNull(sessions.revokedAt)));
}

/** D-14 복구: 토큰은 그대로 두고 현재 세션을 대상 프로필로 재바인딩한다. */
export async function rebindSessionProfile(db: Db, sessionId: string, profileId: string): Promise<void> {
  await db.update(sessions).set({ profileId }).where(eq(sessions.id, sessionId));
}
