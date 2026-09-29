import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { appAuthTickets, profiles, sessions } from '../schema.js';

export type AppAuthTicket = typeof appAuthTickets.$inferSelect;
export type AppAuthOutcome = NonNullable<AppAuthTicket['outcome']>;

/** T-11-003 앱 구글 로그인 티켓 수명 — oauth 쿠키(10분)와 같다. */
export const APP_AUTH_TICKET_TTL_MS = 10 * 60 * 1000;

export async function createAppAuthTicket(
  db: Db,
  input: { id: string; sessionId: string; challenge: string; now: string },
): Promise<void> {
  await db.insert(appAuthTickets).values({
    id: input.id,
    sessionId: input.sessionId,
    challenge: input.challenge,
    createdAt: input.now,
    expiresAt: new Date(Date.parse(input.now) + APP_AUTH_TICKET_TTL_MS).toISOString(),
  });
}

/**
 * 아직 쓰이지 않았고 만료 전인 티켓 + 그 티켓이 묶인 살아 있는 세션. `pending`이면 콜백 결과가 아직 없는
 * 티켓만(구글 시작·콜백), 아니면 결과가 적힌 티켓만(교환) 돌려준다.
 */
export async function findLiveTicket(
  db: Db,
  id: string,
  now: string,
  pending: boolean,
): Promise<(AppAuthTicket & { profileId: string }) | undefined> {
  const [row] = await db
    .select({ ticket: appAuthTickets, profileId: sessions.profileId })
    .from(appAuthTickets)
    .innerJoin(sessions, eq(sessions.id, appAuthTickets.sessionId))
    .innerJoin(profiles, eq(profiles.id, sessions.profileId))
    .where(
      and(
        eq(appAuthTickets.id, id),
        isNull(appAuthTickets.usedAt),
        gt(appAuthTickets.expiresAt, now),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        isNull(profiles.deletedAt),
      ),
    );
  if (!row || (row.ticket.outcome === null) !== pending) return undefined;
  return { ...row.ticket, profileId: row.profileId };
}

export async function setTicketOutcome(
  db: Db,
  id: string,
  outcome: { kind: AppAuthOutcome; profileId?: string; reason?: string },
): Promise<void> {
  await db
    .update(appAuthTickets)
    .set({
      outcome: outcome.kind,
      outcomeProfileId: outcome.profileId ?? null,
      reason: outcome.reason ?? null,
    })
    .where(eq(appAuthTickets.id, id));
}

/** 한 번만 쓰인다 — 이미 쓰였으면 false(동시 교환 경합에서 하나만 이긴다). */
export async function consumeTicket(db: Db, id: string, now: string): Promise<boolean> {
  const rows = await db
    .update(appAuthTickets)
    .set({ usedAt: now })
    .where(and(eq(appAuthTickets.id, id), isNull(appAuthTickets.usedAt)))
    .returning({ id: appAuthTickets.id });
  return rows.length === 1;
}
