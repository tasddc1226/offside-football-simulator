import { eq, and, ne, sql } from 'drizzle-orm';
import { prepareWebSessionRotation } from '../auth/session.js';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { listCareerIdsByOwner } from '../db/repos/careers.js';
import { runBatch } from '../db/repos/batch.js';
import {
  auditLog,
  careers,
  sessions,
  lockerTeams,
  friendlyMatches,
  competitionEntries,
} from '../db/schema.js';

export type MoveCareersAndRebindInput = {
  fromProfileId: string;
  toProfileId: string;
  sessionId: string;
  now: string;
};

/**
 * ADR-008 병합의 공통 배치: `fromProfileId`의 커리어 전부를 `toProfileId`로 옮기고(careerId 유지),
 * 감사 로그 `PROFILE_MERGED`를 남기고, 현재 세션을 대상 프로필로 재바인딩한다. 대기 중인 병합
 * (D-21)이 있었다면 같은 문으로 지운다. `apps/api/src/profile/recover.ts`(D-14)와
 * `apps/api/src/routes/auth.ts`의 `POST /v1/auth/merge`(D-21)가 함께 쓴다.
 */
export async function moveCareersAndRebind(
  db: Db,
  input: MoveCareersAndRebindInput,
): Promise<void> {
  const careerIds = await listCareerIdsByOwner(db, input.fromProfileId);
  await runBatch(db, [
    // If both accounts entered the same immutable challenge, keep the target's entry;
    // otherwise transfer the source entry without changing its server proof or alias.
    db.delete(competitionEntries).where(
      and(
        eq(competitionEntries.ownerProfileId, input.fromProfileId),
        sql`EXISTS (
          SELECT 1 FROM competition_entries target
          WHERE target.owner_profile_id = ${input.toProfileId}
            AND target.challenge_version_id = competition_entries.challenge_version_id
        )`,
      ),
    ),
    db
      .update(competitionEntries)
      .set({ ownerProfileId: input.toProfileId })
      .where(eq(competitionEntries.ownerProfileId, input.fromProfileId)),
    db
      .update(friendlyMatches)
      .set({ ownerProfileId: input.toProfileId })
      .where(eq(friendlyMatches.ownerProfileId, input.fromProfileId)),
    db
      .update(careers)
      .set({ ownerProfileId: input.toProfileId, updatedAt: input.now })
      .where(eq(careers.ownerProfileId, input.fromProfileId)),
    db
      .update(lockerTeams)
      .set({ ownerProfileId: input.toProfileId, updatedAt: input.now })
      .where(eq(lockerTeams.ownerProfileId, input.fromProfileId)),
    db.insert(auditLog).values({
      id: newId('aud'),
      kind: 'PROFILE_MERGED',
      profileId: input.toProfileId,
      payloadJson: JSON.stringify({
        fromProfileId: input.fromProfileId,
        toProfileId: input.toProfileId,
        careerIds,
      }),
      createdAt: input.now,
    }),
    db
      .update(sessions)
      .set({
        profileId: input.toProfileId,
        pendingMergeProfileId: null,
        pendingMergeExpiresAt: null,
      })
      .where(eq(sessions.id, input.sessionId)),
    // Every other source session becomes invalid at the same ownership boundary; otherwise a
    // request already holding an old cookie could admit a fresh source entry after this batch.
    db
      .update(sessions)
      .set({ revokedAt: input.now, pendingMergeProfileId: null, pendingMergeExpiresAt: null })
      .where(and(eq(sessions.profileId, input.fromProfileId), ne(sessions.id, input.sessionId))),
  ]);
}

/** Google 병합은 소유권 이동과 인증 세션 회전을 한 batch로 확정한다. */
export async function moveCareersAndRotateWebSession(
  db: Db,
  input: MoveCareersAndRebindInput,
): Promise<string> {
  const careerIds = await listCareerIdsByOwner(db, input.fromProfileId);
  const rotation = await prepareWebSessionRotation(db, {
    oldSessionId: input.sessionId,
    profileId: input.toProfileId,
    now: input.now,
  });
  await runBatch(db, [
    db.delete(competitionEntries).where(
      and(
        eq(competitionEntries.ownerProfileId, input.fromProfileId),
        sql`EXISTS (
          SELECT 1 FROM competition_entries target
          WHERE target.owner_profile_id = ${input.toProfileId}
            AND target.challenge_version_id = competition_entries.challenge_version_id
        )`,
      ),
    ),
    db
      .update(competitionEntries)
      .set({ ownerProfileId: input.toProfileId })
      .where(eq(competitionEntries.ownerProfileId, input.fromProfileId)),
    db
      .update(friendlyMatches)
      .set({ ownerProfileId: input.toProfileId })
      .where(eq(friendlyMatches.ownerProfileId, input.fromProfileId)),
    db
      .update(careers)
      .set({ ownerProfileId: input.toProfileId, updatedAt: input.now })
      .where(eq(careers.ownerProfileId, input.fromProfileId)),
    db
      .update(lockerTeams)
      .set({ ownerProfileId: input.toProfileId, updatedAt: input.now })
      .where(eq(lockerTeams.ownerProfileId, input.fromProfileId)),
    db.insert(auditLog).values({
      id: newId('aud'),
      kind: 'PROFILE_MERGED',
      profileId: input.toProfileId,
      payloadJson: JSON.stringify({
        fromProfileId: input.fromProfileId,
        toProfileId: input.toProfileId,
        careerIds,
      }),
      createdAt: input.now,
    }),
    ...rotation.statements,
    db
      .update(sessions)
      .set({ revokedAt: input.now, pendingMergeProfileId: null, pendingMergeExpiresAt: null })
      .where(and(eq(sessions.profileId, input.fromProfileId), ne(sessions.id, input.sessionId))),
  ]);
  return rotation.token;
}
