import {
  AttendanceCheckInResponseSchema,
  AttendanceSchema,
  OwnerItemsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ownerAttendance, ownerAttendanceDays } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueCookie, issueGoogleCookie } from '../test/http.js';

const StateRes = successEnvelope(AttendanceSchema);
const CheckRes = successEnvelope(AttendanceCheckInResponseSchema);
const ItemsRes = successEnvelope(OwnerItemsResponseSchema);

// KST 날짜 d일 정오(UTC 03:00).
const at = (day: string) => new Date(`${day}T03:00:00Z`);

describe('T-11-360 출석 체크', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const key = () => ({ 'Idempotency-Key': crypto.randomUUID() });

  it('로그인하지 않은 프로필은 조회도 출석도 못 한다', async () => {
    const guest = await issueCookie(ctx);
    expect((await call('GET', '/v1/attendance', { cookie: guest.cookie })).status).toBe(403);
    const res = await call('POST', '/v1/attendance/check-in', {
      cookie: guest.cookie,
      headers: key(),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: { details: { reason: 'GOOGLE_LOGIN_REQUIRED' } },
    });
    expect(await ctx.db.select().from(ownerAttendance)).toHaveLength(0);
  });

  it('하루 한 번 도장을 찍고, 같은 키 재전송은 같은 응답 · 새 키는 409다', async () => {
    const me = await issueGoogleCookie(ctx);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at('2026-10-17'));
    const state = async () =>
      StateRes.parse(await (await call('GET', '/v1/attendance', { cookie: me.cookie })).json())
        .data;
    expect(await state()).toEqual({
      today: '2026-10-17',
      checkedIn: false,
      stamps: 0,
      streak: 0,
      bestStreak: 0,
      member: false,
    });
    const first = key();
    const check = (headers = key()) =>
      call('POST', '/v1/attendance/check-in', { cookie: me.cookie, headers });
    const got = CheckRes.parse(await (await check(first)).json()).data;
    expect(got).toEqual({
      attendance: {
        today: '2026-10-17',
        checkedIn: true,
        stamps: 1,
        streak: 1,
        bestStreak: 1,
        member: false,
      },
      granted: { reroll: 1, boost: 0, scout: 0, rename: 0 },
    });
    expect(CheckRes.parse(await (await check(first)).json()).data).toEqual(got);
    const again = await check();
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({
      error: { details: { reason: 'ATTENDANCE_CHECKED' } },
    });
    expect(await state()).toMatchObject({ checkedIn: true, stamps: 1, streak: 1 });
    expect(await ctx.db.select().from(ownerAttendanceDays)).toEqual([
      { profileId: me.profileId, day: '2026-10-17', checkedAt: at('2026-10-17').toISOString() },
    ]);
  });

  it('매일 그 칸의 보상(7칸은 강화권 2장)을 주고, 하루 빠짐은 유예 · 이틀은 끊김이다', async () => {
    const me = await issueGoogleCookie(ctx);
    vi.useFakeTimers({ toFake: ['Date'] });
    const checkOn = async (day: string) => {
      vi.setSystemTime(at(day));
      const res = await call('POST', '/v1/attendance/check-in', {
        cookie: me.cookie,
        headers: key(),
      });
      return CheckRes.parse(await res.json()).data;
    };
    // 10-12(월)~10-17(토) 6일, 10-18(일) 빠짐 → 10-19(월) 유예로 이어져 7일 연속 · 7번째 도장.
    for (const d of ['12', '13', '14', '15', '16', '17']) await checkOn(`2026-10-${d}`);
    const seventh = await checkOn('2026-10-19');
    expect(seventh.attendance).toMatchObject({ stamps: 7, streak: 7, bestStreak: 7 });
    expect(seventh.granted).toEqual({ reroll: 0, boost: 2, scout: 0, rename: 0 });
    const items = ItemsRes.parse(
      await (await call('GET', '/v1/items', { cookie: me.cookie })).json(),
    ).data;
    // 1~7칸: 리롤권 5장(1 · 2 · 3 · 5 · 6칸), 강화권 1 + 2장(4 · 7칸).
    expect(items).toMatchObject({ reroll: 5, boost: 3, scout: 0 });

    // 10-20 · 10-21 빠짐 → 끊긴 걸로 보이고(streak 0), 10-22에 1부터. 도장은 그대로 쌓인다.
    vi.setSystemTime(at('2026-10-22'));
    const s = StateRes.parse(
      await (await call('GET', '/v1/attendance', { cookie: me.cookie })).json(),
    ).data;
    expect(s).toMatchObject({ checkedIn: false, stamps: 7, streak: 0, bestStreak: 7 });
    const after = await checkOn('2026-10-22');
    expect(after.attendance).toMatchObject({ stamps: 8, streak: 1, bestStreak: 7 });
  });

  it('계정을 지우면 출석 기록도 지운다', async () => {
    const me = await issueGoogleCookie(ctx);
    await call('POST', '/v1/attendance/check-in', { cookie: me.cookie, headers: key() });
    await deleteProfile(ctx.env, me.cookie, 'attendance-delete');
    expect(await ctx.db.select().from(ownerAttendance)).toHaveLength(0);
    expect(await ctx.db.select().from(ownerAttendanceDays)).toHaveLength(0);
  });
});
