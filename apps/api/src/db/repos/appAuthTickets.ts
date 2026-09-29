import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { appAuthTickets, profiles, sessions } from '../schema.js';

export type AppAuthTicket = typeof appAuthTickets.$inferSelect;

/** T-11-003 앱 구글 로그인 티켓 수명 — 웹 oauth 쿠키(10분)와 같다. */
export const APP_AUTH_TICKET_TTL_MS = 10 * 60 * 1000;

export async function createAppAuthTicket(
  db: Db,
  input: { id: string; sessionId: string; challenge: string; codeVerifier: string; now: string },
): Promise<void> {
  await db.insert(appAuthTickets).values({
    id: input.id,
    sessionId: input.sessionId,
    challenge: input.challenge,
    codeVerifier: input.codeVerifier,
    expiresAt: new Date(Date.parse(input.now) + APP_AUTH_TICKET_TTL_MS).toISOString(),
  });
}

/** 콜백 전(로그인 프로필이 아직 없는) 만료 전 티켓 + 그 티켓이 묶인 살아 있는 세션의 프로필. 콜백은 쿠키가 없다. */
export async function findPendingTicket(
  db: Db,
  id: string,
  now: string,
): Promise<(AppAuthTicket & { sessionProfileId: string }) | undefined> {
  const [row] = await db
    .select({ ticket: appAuthTickets, sessionProfileId: sessions.profileId })
    .from(appAuthTickets)
    .innerJoin(sessions, eq(sessions.id, appAuthTickets.sessionId))
    .innerJoin(profiles, eq(profiles.id, sessions.profileId))
    .where(
      and(
        eq(appAuthTickets.id, id),
        isNull(appAuthTickets.profileId),
        gt(appAuthTickets.expiresAt, now),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        isNull(profiles.deletedAt),
      ),
    );
  return row && { ...row.ticket, sessionProfileId: row.sessionProfileId };
}

export async function setTicketProfile(db: Db, id: string, profileId: string): Promise<void> {
  await db.update(appAuthTickets).set({ profileId }).where(eq(appAuthTickets.id, id));
}

/**
 * 콜백을 마친 만료 전 티켓을 — 만든 세션이 그 챌린지로 낼 때만 — 지우고 돌려준다. 한 번만 쓰인다(동시 교환이면 하나만
 * 받는다). 세션 생존은 교환 요청의 Bearer(requireProfile)가 이미 확인했다.
 */
export async function takeReadyTicket(
  db: Db,
  input: { id: string; sessionId: string; challenge: string; now: string },
): Promise<AppAuthTicket | undefined> {
  const [row] = await db
    .delete(appAuthTickets)
    .where(
      and(
        eq(appAuthTickets.id, input.id),
        eq(appAuthTickets.sessionId, input.sessionId),
        eq(appAuthTickets.challenge, input.challenge),
        isNotNull(appAuthTickets.profileId),
        gt(appAuthTickets.expiresAt, input.now),
      ),
    )
    .returning();
  return row;
}
