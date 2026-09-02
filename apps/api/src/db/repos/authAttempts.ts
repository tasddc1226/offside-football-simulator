import { and, eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { authAttempts } from '../schema.js';

export type AuthAttemptKind = (typeof authAttempts.$inferSelect)['kind'];

/** D-14·D-15: 발급·복구 실패 시도 모두 시간당 5회. */
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function windowExpired(windowStart: string, now: string): boolean {
  return Date.parse(now) - Date.parse(windowStart) >= RATE_LIMIT_WINDOW_MS;
}

/** 현재 윈도우의 시도 횟수. 윈도우가 지났거나 행이 없으면 0. */
export async function getAttemptCount(db: Db, kind: AuthAttemptKind, subject: string, now: string): Promise<number> {
  const [row] = await db
    .select()
    .from(authAttempts)
    .where(and(eq(authAttempts.kind, kind), eq(authAttempts.subject, subject)));
  if (!row || windowExpired(row.windowStart, now)) return 0;
  return row.count;
}

/** 시도 1회를 기록한다. 윈도우가 지났으면 새 윈도우로 리셋한다. */
export async function recordAttempt(db: Db, kind: AuthAttemptKind, subject: string, now: string): Promise<void> {
  const [row] = await db
    .select()
    .from(authAttempts)
    .where(and(eq(authAttempts.kind, kind), eq(authAttempts.subject, subject)));

  if (!row) {
    await db.insert(authAttempts).values({ id: newId('att'), kind, subject, windowStart: now, count: 1 });
    return;
  }
  if (windowExpired(row.windowStart, now)) {
    await db.update(authAttempts).set({ windowStart: now, count: 1 }).where(eq(authAttempts.id, row.id));
    return;
  }
  await db.update(authAttempts).set({ count: row.count + 1 }).where(eq(authAttempts.id, row.id));
}
