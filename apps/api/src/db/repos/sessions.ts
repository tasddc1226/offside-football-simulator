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
