import { PUSH_TEST_COOLDOWN_MS, PUSH_TEST_DAILY_MAX } from '@offside/contracts/push-limits';
import { DAY_MS, kstDay } from '@offside/contracts/kst';
import { sha256Hex } from '../db/hash.js';
import { newId } from '../db/ids.js';
import { AppError } from '../errors.js';

/** 기기·프로필 예산을 한 트랜잭션에서 예약한다. 세션·토큰 교체나 동시 요청으로 우회하지 못한다. */
export async function reservePushTest(
  db: D1Database,
  installationId: string,
  profileId: string,
  now: string,
): Promise<string> {
  const device = `device:${await sha256Hex(installationId)}`;
  const profile = `profile:${profileId}`;
  const start = new Date(`${kstDay(now)}T00:00:00+09:00`).toISOString();
  const threshold = new Date(Date.parse(now) - PUSH_TEST_COOLDOWN_MS).toISOString();
  const nextDay = new Date(Date.parse(start) + DAY_MS).toISOString();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO auth_attempts (id, kind, subject, window_start, count)
      SELECT ?, 'PUSH_TEST', ?, ?, 1
      WHERE NOT EXISTS (SELECT 1 FROM auth_attempts WHERE kind = 'PUSH_TEST' AND subject = ?
        AND (window_start > ? OR (window_start >= ? AND count >= ?)))
      ON CONFLICT(kind, subject) DO UPDATE SET
        count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END, window_start = excluded.window_start
      WHERE window_start <= ? AND (window_start < ? OR count < ?)
      RETURNING count`,
      )
      .bind(
        newId('att'),
        device,
        now,
        profile,
        threshold,
        start,
        PUSH_TEST_DAILY_MAX,
        start,
        threshold,
        start,
        PUSH_TEST_DAILY_MAX,
      ),
    db
      .prepare(
        `INSERT INTO auth_attempts (id, kind, subject, window_start, count)
      SELECT ?, 'PUSH_TEST', ?, ?, 1 WHERE changes() = 1
      ON CONFLICT(kind, subject) DO UPDATE SET
        count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END, window_start = excluded.window_start
      RETURNING count`,
      )
      .bind(newId('att'), profile, now, start),
  ]);
  if (results[0]!.meta.changes === 1) {
    const reachedDailyLimit = results.some(
      (r) => (r.results[0] as { count: number }).count >= PUSH_TEST_DAILY_MAX,
    );
    return new Date(
      Math.max(
        Date.parse(now) + PUSH_TEST_COOLDOWN_MS,
        reachedDailyLimit ? Date.parse(nextDay) : 0,
      ),
    ).toISOString();
  }
  const rows = await db
    .prepare(
      `SELECT window_start, count FROM auth_attempts
    WHERE kind = 'PUSH_TEST' AND subject IN (?, ?)`,
    )
    .bind(device, profile)
    .all<{ window_start: string; count: number }>();
  const daily = rows.results.some((r) => r.window_start >= start && r.count >= PUSH_TEST_DAILY_MAX);
  throw new AppError({
    code: 'RATE_LIMITED',
    message: daily
      ? '오늘 테스트 알림을 3회 요청했어요. 내일 다시 보낼 수 있어요.'
      : '테스트 알림은 10분에 한 번 보낼 수 있어요.',
    details: { reason: daily ? 'PUSH_TEST_DAILY_LIMIT' : 'PUSH_TEST_COOLDOWN' },
  });
}
