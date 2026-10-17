import type { Attendance } from '@offside/contracts';
import { checkInReward, nextStreak, streakAlive } from '@offside/contracts/attendance';
import { OWNER_ITEMS, type OwnerItem } from '@offside/contracts/cup';
import { kstDay } from '@offside/contracts/kst';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-360 출석 체크 1단계. 출석 버튼을 누를 때만 쓴다(구단주 · 하루 한 번). 규칙은 contracts attendance-rules.ts.

type Row = {
  stamps: number;
  streak: number;
  bestStreak: number;
  lastDay: string | null;
  graceWeek: string | null;
};

const readRow = (db: Db, profileId: string) =>
  db.$client
    .prepare(
      `SELECT stamps, streak, best_streak AS bestStreak, last_day AS lastDay, grace_week AS graceWeek
         FROM owner_attendance WHERE profile_id = ?`,
    )
    .bind(profileId)
    .first<Row>();

const view = (row: Row | null, today: string): Attendance => ({
  today,
  checkedIn: row?.lastDay === today,
  stamps: row?.stamps ?? 0,
  streak: row && streakAlive(row, today) ? row.streak : 0,
  bestStreak: row?.bestStreak ?? 0,
});

/** 오늘 출석 상태(PK 조회 한 번). */
export async function attendanceOf(db: Db, profileId: string, now: string): Promise<Attendance> {
  return view(await readRow(db, profileId), kstDay(now));
}

/**
 * 출석하기. 요약 줄을 읽은 값 그대로일 때만(last_day 비교) 바꾸고, 이 batch가 바꿨을 때만(claim_id) 하루 기록과 아이템을
 * 넣는다. 같은 날 이미 출석했으면 null. 자정 무렵 두 요청이 같은 옛 값을 읽어 하나가 밀리면 다시 읽어 한 번 더 해 본다.
 */
export async function checkIn(
  db: Db,
  profileId: string,
  now: string,
): Promise<{ attendance: Attendance; granted: Record<OwnerItem, number> } | null> {
  const d1 = db.$client;
  const today = kstDay(now);
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await readRow(db, profileId);
    if (row?.lastDay === today) return null;
    const prev = row ?? { stamps: 0, streak: 0, bestStreak: 0, lastDay: null, graceWeek: null };
    const { streak, graceWeek } = nextStreak(prev, today);
    const next: Row = {
      stamps: prev.stamps + 1,
      streak,
      bestStreak: Math.max(prev.bestStreak, streak),
      lastDay: today,
      graceWeek,
    };
    const reward = checkInReward(next.stamps);
    const claimId = crypto.randomUUID();
    const guard = {
      sql: `EXISTS (SELECT 1 FROM owner_attendance WHERE profile_id = ? AND claim_id = ?)`,
      params: [profileId, claimId],
    };
    const results = await d1.batch([
      d1
        .prepare(
          `INSERT INTO owner_attendance
             (profile_id, stamps, streak, best_streak, last_day, grace_week, claim_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (profile_id) DO UPDATE SET
             stamps = excluded.stamps, streak = excluded.streak, best_streak = excluded.best_streak,
             last_day = excluded.last_day, grace_week = excluded.grace_week, claim_id = excluded.claim_id,
             updated_at = excluded.updated_at
           WHERE owner_attendance.last_day IS ?`,
        )
        .bind(
          profileId,
          next.stamps,
          next.streak,
          next.bestStreak,
          today,
          next.graceWeek,
          claimId,
          now,
          prev.lastDay,
        ),
      d1
        .prepare(
          `INSERT OR IGNORE INTO owner_attendance_days (profile_id, day, checked_at)
           SELECT ?, ?, ? WHERE ${guard.sql}`,
        )
        .bind(profileId, today, now, ...guard.params),
      ...OWNER_ITEMS.filter((k) => reward[k]).map((k) =>
        grantItemStatement(d1, profileId, k, reward[k]!, now, guard),
      ),
    ]);
    if (!results[0]?.meta.changes) continue;
    const granted = Object.fromEntries(OWNER_ITEMS.map((k) => [k, reward[k] ?? 0])) as Record<
      OwnerItem,
      number
    >;
    return { attendance: view(next, today), granted };
  }
  return null;
}
