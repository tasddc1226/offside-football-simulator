import type { Attendance } from '@offside/contracts';
import { checkInReward, nextStreak, streakAlive } from '@offside/contracts/attendance';
import { OWNER_ITEMS, type OwnerItem } from '@offside/contracts/cup';
import { kstDay } from '@offside/contracts/kst';
import { MEMBER_ATTENDANCE_MULT, MEMBER_DAILY_BONUS } from '@offside/contracts/membership';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-360 출석 체크 1단계. 출석 버튼을 누를 때만 쓴다(구단주 · 하루 한 번). 규칙은 contracts attendance-rules.ts.

type Row = {
  stamps: number;
  streak: number;
  bestStreak: number;
  lastDay: string | null;
  graceWeek: string | null;
  /** T-11-720 오늘 광고 보상을 받았으면 1. 오늘 출석하지 않았으면 NULL. */
  adBonus?: number | null;
};

// T-11-720 오늘 하루 기록(PK)을 함께 읽어 광고 보상을 받았는지 본다. 요약 줄 조회와 같은 한 번의 쿼리다.
const readRow = (db: Db, profileId: string, today: string) =>
  db.$client
    .prepare(
      `SELECT a.stamps, a.streak, a.best_streak AS bestStreak, a.last_day AS lastDay,
              a.grace_week AS graceWeek, d.ad_claim_id IS NOT NULL AS adBonus
         FROM owner_attendance a
         LEFT JOIN owner_attendance_days d ON d.profile_id = a.profile_id AND d.day = ?
        WHERE a.profile_id = ?`,
    )
    .bind(today, profileId)
    .first<Row>();

const view = (row: Row | null, today: string): Attendance => {
  const checkedIn = row?.lastDay === today;
  return {
    today,
    checkedIn,
    stamps: row?.stamps ?? 0,
    streak: row && streakAlive(row, today) ? row.streak : 0,
    bestStreak: row?.bestStreak ?? 0,
    ...(checkedIn ? { adBonus: !!row?.adBonus } : {}),
  };
};

/** 오늘 출석 상태(PK 조회 한 번). */
export async function attendanceOf(db: Db, profileId: string, now: string): Promise<Attendance> {
  const today = kstDay(now);
  return view(await readRow(db, profileId, today), today);
}

/**
 * 출석하기. 요약 줄을 읽은 값 그대로일 때만(last_day 비교) 바꾸고, 이 batch가 바꿨을 때만(claim_id) 하루 기록과 아이템을
 * 넣는다. 같은 날 이미 출석했으면 null. 자정 무렵 두 요청이 같은 옛 값을 읽어 하나가 밀리면 다시 읽어 한 번 더 해 본다.
 */
export async function checkIn(
  db: Db,
  profileId: string,
  now: string,
  /** T-11-512 클럽 멤버십 구독 중이면 보상 2배, T-11-517 잠재력 강화권 1장을 더 준다. */
  member = false,
): Promise<{ attendance: Attendance; granted: Record<OwnerItem, number> } | null> {
  const d1 = db.$client;
  const today = kstDay(now);
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await readRow(db, profileId, today);
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
    const base = checkInReward(next.stamps);
    const bonus: Partial<Record<OwnerItem, number>> = member ? MEMBER_DAILY_BONUS : {};
    const mult = member ? MEMBER_ATTENDANCE_MULT : 1;
    const reward = Object.fromEntries(
      OWNER_ITEMS.filter((k) => base[k] || bonus[k]).map((k) => [
        k,
        (base[k] ?? 0) * mult + (bonus[k] ?? 0),
      ]),
    ) as typeof base;
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
    return { attendance: view({ ...next, adBonus: 0 }, today), granted };
  }
  return null;
}

/**
 * T-11-720 오늘 출석한 구단주가 앱에서 보상형 광고를 끝까지 보면 그날 칸의 기본 보상을 한 번 더 준다(멤버십 2배 · 매일 강화권은
 * 더하지 않는다). 하루 한 번: 오늘 하루 기록의 ad_claim_id가 비어 있을 때만 이 요청의 id를 적고, 그 id가 적힌 batch에서만
 * 아이템을 넣는다. 오늘 출석하지 않았으면 'not-checked', 이미 받았으면 'taken'.
 */
export async function claimAttendanceAdBonus(
  db: Db,
  profileId: string,
  now: string,
): Promise<
  { attendance: Attendance; granted: Record<OwnerItem, number> } | 'not-checked' | 'taken'
> {
  const d1 = db.$client;
  const today = kstDay(now);
  const row = await readRow(db, profileId, today);
  if (row?.lastDay !== today) return 'not-checked';
  if (row.adBonus) return 'taken';
  const reward = checkInReward(row.stamps);
  const claimId = crypto.randomUUID();
  const guard = {
    sql: `EXISTS (SELECT 1 FROM owner_attendance_days WHERE profile_id = ? AND day = ? AND ad_claim_id = ?)`,
    params: [profileId, today, claimId],
  };
  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE owner_attendance_days SET ad_claim_id = ?
          WHERE profile_id = ? AND day = ? AND ad_claim_id IS NULL`,
      )
      .bind(claimId, profileId, today),
    ...OWNER_ITEMS.filter((k) => reward[k]).map((k) =>
      grantItemStatement(d1, profileId, k, reward[k]!, now, guard),
    ),
  ]);
  if (!results[0]?.meta.changes) return 'taken';
  const granted = Object.fromEntries(OWNER_ITEMS.map((k) => [k, reward[k] ?? 0])) as Record<
    OwnerItem,
    number
  >;
  return { attendance: view({ ...row, adBonus: 1 }, today), granted };
}
