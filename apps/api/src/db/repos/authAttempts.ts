import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { authAttempts } from '../schema.js';

export type AuthAttemptKind = (typeof authAttempts.$inferSelect)['kind'];

/** D-14·D-15: 발급·복구 실패 시도 모두 시간당 5회. */
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** T-2-012 D-55: 분석 이벤트 수집은 분당 60요청/clientId. */
export const ANALYTICS_RATE_LIMIT_MAX = 60;
export const ANALYTICS_RATE_LIMIT_WINDOW_MS = 60 * 1000;

function windowExpired(windowStart: string, now: string, windowMs: number): boolean {
  return Date.parse(now) - Date.parse(windowStart) >= windowMs;
}

/** 현재 윈도우의 시도 횟수. 윈도우가 지났거나 행이 없으면 0. `windowMs`는 kind별 윈도우 길이(기본 1시간). */
export async function getAttemptCount(
  db: Db,
  kind: AuthAttemptKind,
  subject: string,
  now: string,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): Promise<number> {
  const [row] = await db
    .select()
    .from(authAttempts)
    .where(and(eq(authAttempts.kind, kind), eq(authAttempts.subject, subject)));
  if (!row || windowExpired(row.windowStart, now, windowMs)) return 0;
  return row.count;
}

/**
 * 시도 1회를 기록한다. 윈도우가 지났으면 새 윈도우로 리셋한다.
 *
 * SELECT 후 INSERT/UPDATE로 나누면 동시 요청 사이에 lost update가 생겨
 * 레이트리밋을 우회할 수 있으므로, 단일 UPSERT 문으로 원자적으로 처리한다.
 */
export async function recordAttempt(
  db: Db,
  kind: AuthAttemptKind,
  subject: string,
  now: string,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): Promise<void> {
  const threshold = new Date(Date.parse(now) - windowMs).toISOString();
  await db
    .insert(authAttempts)
    .values({ id: newId('att'), kind, subject, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: [authAttempts.kind, authAttempts.subject],
      set: {
        windowStart: sql`CASE WHEN ${authAttempts.windowStart} <= ${threshold} THEN ${now} ELSE ${authAttempts.windowStart} END`,
        count: sql`CASE WHEN ${authAttempts.windowStart} <= ${threshold} THEN 1 ELSE ${authAttempts.count} + 1 END`,
      },
    });
}
