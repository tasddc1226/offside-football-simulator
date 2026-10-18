import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie, issueGoogleCookie } from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';
import { ATTENDANCE_REMINDER_MAX, queueAttendanceReminders } from './attendanceReminder.js';
import { runPersonalPush } from './personal.js';
import { pushText } from './text.js';
import { attendanceReminderText } from '../i18n/ko/attendanceReminder.js';

// T-11-378 출석 독려 푸시.
const NOW = Date.parse('2026-10-17T10:05:00.000Z'); // KST 19:05
const TODAY = '2026-10-17';
let ctx: TestD1;
let owner: Awaited<ReturnType<typeof issueGoogleCookie>>;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ctx = await createTestD1();
  owner = await issueGoogleCookie(ctx);
  await addAppPushDevice(ctx, owner.profileId);
  Object.assign(ctx.env, {
    ENVIRONMENT: 'production',
    PERSONAL_PUSH_ENABLED: '1',
    ATTENDANCE_REMINDER_ENABLED: '1',
  });
});
afterEach(async () => {
  vi.useRealTimers();
  await ctx.dispose();
});

const rows = async (table: string) =>
  (await ctx.env.DB.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()).results;
const attended = (profileId: string, lastDay: string, updatedAt = `${lastDay}T00:00:00.000Z`) =>
  ctx.env.DB.prepare(
    `INSERT INTO owner_attendance (profile_id, stamps, streak, best_streak, last_day, grace_week, claim_id, updated_at)
     VALUES (?, 1, 1, 1, ?, NULL, 'claim', ?)`,
  )
    .bind(profileId, lastDay, updatedAt)
    .run();
const transport = () =>
  vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    Response.json({
      data: JSON.parse(String(init?.body)).map((_: unknown, i: number) => ({
        status: 'ok',
        id: `ticket_${i}`,
      })),
    }),
  );

describe('T-11-378 출석 독려 푸시', () => {
  it('오늘 출석하지 않은 로그인한 구단주에게 19시대 한 번 쌓고, 다시 돌아도 하루 하나다', async () => {
    expect(await queueAttendanceReminders(ctx.env, NOW)).toEqual({ created: 1 });
    expect(await queueAttendanceReminders(ctx.env, NOW + 5 * 60_000)).toEqual({ created: 0 });
    const [n] = await rows('notifications');
    expect(n).toMatchObject({
      profile_id: owner.profileId,
      source_key: `attendance-reminder:${TODAY}:${owner.profileId}`,
      kind: 'return',
      title: attendanceReminderText.title,
      body: attendanceReminderText.body,
      target_json: '{"type":"screen","screen":"home"}',
    });
    const deliveries = await rows('push_deliveries');
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ expires_at: '2026-10-17T12:00:00.000Z' });

    const send = transport();
    await runPersonalPush(ctx.env, NOW, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(send.mock.calls[0]![1]!.body))[0]).toMatchObject({
      title: attendanceReminderText.title,
    });
  });

  it('출석했거나 · 로그인하지 않았거나 · 19시대가 아니거나 · 꺼져 있으면 쌓지 않는다', async () => {
    await attended(owner.profileId, TODAY);
    const guest = await issueCookie(ctx);
    await addAppPushDevice(ctx, guest.profileId);
    expect(await queueAttendanceReminders(ctx.env, NOW)).toEqual({ created: 0 });
    await ctx.env.DB.prepare('DELETE FROM owner_attendance').run();
    expect(await queueAttendanceReminders(ctx.env, NOW - 5 * 3600_000)).toEqual({ created: 0 });
    expect(
      await queueAttendanceReminders({ ...ctx.env, ATTENDANCE_REMINDER_ENABLED: '0' }, NOW),
    ).toEqual({ created: 0 });
    expect(await rows('notifications')).toEqual([]);
  });

  it('앱 기기가 14일 넘게 갱신되지 않았으면 보내지 않는다', async () => {
    await ctx.env.DB.prepare('UPDATE push_devices SET updated_at = ?')
      .bind(new Date(NOW - 15 * 86400_000).toISOString())
      .run();
    expect(await queueAttendanceReminders(ctx.env, NOW)).toEqual({ created: 0 });
  });

  it(`마지막 출석 뒤 ${ATTENDANCE_REMINDER_MAX}번 받고도 오지 않으면 멈추고, 다시 출석하면 이어서 보낸다`, async () => {
    await attended(owner.profileId, '2026-10-10', '2026-10-10T03:00:00.000Z');
    for (const d of ['14', '15', '16']) {
      const at = Date.parse(`2026-10-${d}T10:05:00.000Z`);
      vi.setSystemTime(at);
      expect(await queueAttendanceReminders(ctx.env, at)).toEqual({ created: 1 });
    }
    vi.setSystemTime(NOW);
    expect(await queueAttendanceReminders(ctx.env, NOW)).toEqual({ created: 0 });
    // 10-17 아침에 다시 출석했으면 오늘은 출석한 날이라 보내지 않고, 다음 날부터 다시 보낸다.
    await ctx.env.DB.prepare(
      `UPDATE owner_attendance SET last_day = ?, updated_at = '2026-10-16T23:00:00.000Z'`,
    )
      .bind(TODAY)
      .run();
    expect(await queueAttendanceReminders(ctx.env, NOW)).toEqual({ created: 0 });
    const tomorrow = NOW + 86400_000;
    vi.setSystemTime(tomorrow);
    expect(await queueAttendanceReminders(ctx.env, tomorrow)).toEqual({ created: 1 });
  });

  it('쌓은 뒤 보내기 전에 출석했으면 보내지 않는다', async () => {
    await queueAttendanceReminders(ctx.env, NOW);
    await attended(owner.profileId, TODAY);
    const send = transport();
    await runPersonalPush(ctx.env, NOW, send);
    expect(send).not.toHaveBeenCalled();
  });

  it('알림함은 요청 언어로 보인다', () => {
    expect(pushText(attendanceReminderText.title, 'en')).toBe("Today's check-in stamp is waiting");
    expect(pushText(attendanceReminderText.body, 'ja')).toBe(
      'ホームで出席して今日のマスの報酬を受け取りましょう。',
    );
  });
});
