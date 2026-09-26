import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { profiles, sessions } from '../schema.js';

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
/** 유효한 세션 + 삭제되지 않은 프로필을 한 번의 조회로(세션 → 프로필 두 번 왕복하지 않는다). */
export async function findLiveSession(
  db: Db,
  tokenHash: string,
  now: string,
): Promise<Pick<SessionRecord, 'id' | 'profileId' | 'channel'> | undefined> {
  const [row] = await db
    .select({ id: sessions.id, profileId: sessions.profileId, channel: sessions.channel })
    .from(sessions)
    .innerJoin(profiles, eq(profiles.id, sessions.profileId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        isNull(profiles.deletedAt),
      ),
    );
  return row;
}

export async function revokeSession(db: Db, id: string, at: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: at }).where(eq(sessions.id, id));
}

export async function getSessionById(db: Db, id: string): Promise<SessionRecord | undefined> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
  return row;
}

/** D-14 복구: 토큰은 그대로 두고 현재 세션을 대상 프로필로 재바인딩한다. */
export async function rebindSessionProfile(
  db: Db,
  sessionId: string,
  profileId: string,
): Promise<void> {
  await db.update(sessions).set({ profileId }).where(eq(sessions.id, sessionId));
}
