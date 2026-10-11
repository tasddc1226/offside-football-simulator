import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie, callJson } from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';
import { queueCareerReminders, consumeCareerReminders } from './careerReminder.js';
import { runPersonalPush } from './personal.js';
import { queueReengagement } from './reengagement.js';
import { queueNotification } from '../db/repos/notifications.js';
import { pushText } from './text.js';
import { careerReminderText } from '../i18n/ko/careerReminder.js';

const DAY = 86400_000;
const NOW = Date.parse('2026-10-11T06:00:00.000Z'); // KST 15:00
const iso = (n = NOW) => new Date(n).toISOString();
let ctx: TestD1;
let user: Awaited<ReturnType<typeof issueCookie>>;
let careerId: string;
let queue: {
  send: ReturnType<typeof vi.fn>;
  sendBatch: ReturnType<typeof vi.fn>;
  metrics: ReturnType<typeof vi.fn>;
};
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ctx = await createTestD1();
  user = await issueCookie(ctx);
  careerId = crypto.randomUUID();
  const response = await activity('active', careerId);
  expect(response.status).toBe(204);
  await addAppPushDevice(ctx, user.profileId);
  await stale(3);
  queue = { send: vi.fn(), sendBatch: vi.fn(), metrics: vi.fn() };
  Object.assign(ctx.env, {
    ENVIRONMENT: 'production',
    PERSONAL_PUSH_ENABLED: '1',
    REENGAGEMENT_PUSH_ENABLED: '1',
    CAREER_REMINDER_ENABLED: '1',
    CAREER_PUSH_QUEUE: queue,
  });
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await ctx.dispose();
});
function activity(state: string, id: string | null) {
  return callJson({ ...ctx.env, ENVIRONMENT: 'local' }, 'PUT', '/v1/career-activity', {
    cookie: user.cookie,
    body: { careerId: id, state },
  });
}
async function stale(days: number, at = NOW) {
  await ctx.env.DB.prepare('UPDATE career_activity SET last_active_at=?')
    .bind(iso(at - days * DAY))
    .run();
  await ctx.env.DB.prepare('UPDATE push_devices SET updated_at=?')
    .bind(iso(at - days * DAY))
    .run();
}
async function rows(table: string) {
  return (await ctx.env.DB.prepare(`SELECT * FROM ${table}`).all()).results;
}
const transport = () =>
  vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    Response.json({
      data: JSON.parse(String(init?.body)).map((_: unknown, i: number) => ({
        status: 'ok',
        id: `ticket_${i}`,
      })),
    }),
  );
function batch(id = queue.send.mock.calls.at(-1)![0].batchId as string) {
  return {
    queue: 'offside-career-push-production',
    metadata: { metrics: { backlogCount: 1, backlogBytes: 20 } },
    ackAll: vi.fn(),
    retryAll: vi.fn(),
    messages: [
      {
        id: 'test',
        timestamp: new Date(),
        attempts: 1,
        body: { version: 1, batchId: id },
        ack: vi.fn(),
        retry: vi.fn(),
      },
    ],
  };
}
async function historicalCareer(status: 'active' | 'retired', updated = NOW - 10 * DAY) {
  await ctx.env.DB.prepare(
    `INSERT INTO careers (id,profile_id,pos,foot,type,trait,start_year,status,app_version,created_at,updated_at)
    VALUES (?,?, 'FW','오른발','test','test',2026,?,'test',?,?)`,
  )
    .bind(crypto.randomUUID(), user.profileId, status, iso(updated), iso(updated))
    .run();
}

describe('first-career retention and fatigue budget', () => {
  it('includes a created-only player, sends to one recent device and deduplicates Queue/cron', async () => {
    expect(await rows('careers')).toHaveLength(0);
    await addAppPushDevice(ctx, user.profileId);
    await stale(3);
    const [a, b] = await Promise.all([
      queueCareerReminders(ctx.env, NOW),
      queueCareerReminders(ctx.env, NOW),
    ]);
    expect(a.created + b.created).toBe(1);
    expect(queue.send).toHaveBeenCalledOnce();
    expect(await rows('push_deliveries')).toHaveLength(1);
    const send = transport();
    await runPersonalPush(ctx.env, NOW, send);
    expect(send).not.toHaveBeenCalled();
    await consumeCareerReminders(batch(), ctx.env, NOW, send);
    expect(send).toHaveBeenCalledOnce();
    expect(await rows('push_deliveries')).toMatchObject([{ state: 'accepted' }]);
    await Promise.all([
      consumeCareerReminders(batch(), ctx.env, NOW + 300_000, send),
      runPersonalPush(ctx.env, NOW + 300_000, send),
    ]);
    expect(send).toHaveBeenCalledOnce();
    expect(await rows('push_deliveries')).toMatchObject([{ state: 'accepted', attempts: 1 }]);
  });
  it('uses stages 3/7/14 with a lifetime maximum and never restarts the campaign on a new career', async () => {
    for (const day of [3, 7, 14])
      expect((await queueCareerReminders(ctx.env, NOW + (day - 3) * DAY)).created).toBe(1);
    expect(await rows('notifications')).toHaveLength(3);
    expect((await queueCareerReminders(ctx.env, NOW + 20 * DAY)).created).toBe(0);
    vi.setSystemTime(NOW + 21 * DAY);
    await activity('active', crypto.randomUUID());
    await stale(14, NOW + 35 * DAY);
    expect((await queueCareerReminders(ctx.env, NOW + 35 * DAY)).created).toBe(0);
    expect(await rows('career_activity')).toMatchObject([{ reminder_stage: 3 }]);
  });
  it('skips missed stages instead of catching up; stops beyond 30 days', async () => {
    await stale(15);
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(1);
    expect(await rows('career_activity')).toMatchObject([{ reminder_stage: 3 }]);
    expect((await queueCareerReminders(ctx.env, NOW + 7 * DAY)).created).toBe(0);
  });
  it.each([2, 31])('does not target users inactive for %i days', async (days) => {
    await stale(days);
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
  });
  it('requires four days between reminders even when a stage boundary is crossed', async () => {
    await stale(6);
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(1);
    expect((await queueCareerReminders(ctx.env, NOW + DAY)).created).toBe(0);
    expect((await queueCareerReminders(ctx.env, NOW + 4 * DAY)).created).toBe(1);
  });
  it.each(['none', 'retired'])(
    'excludes %s saves and never clears a retirement marker',
    async (state) => {
      await activity(state, state === 'none' ? null : careerId);
      await stale(7);
      expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
      if (state === 'retired') {
        await activity('active', crypto.randomUUID());
        await stale(7);
        expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
      }
    },
  );
  it('excludes a user with any server retirement or recent season upload', async () => {
    await historicalCareer('active', NOW - DAY);
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
    await ctx.env.DB.prepare("UPDATE careers SET status='retired',updated_at=?")
      .bind(iso(NOW - 10 * DAY))
      .run();
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
  });
  it('respects device opt-out, revoked sessions and activity on another device', async () => {
    await addAppPushDevice(ctx, user.profileId);
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
    await stale(3);
    await ctx.env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE channel='app'")
      .bind(iso())
      .run();
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
    await ctx.env.DB.prepare('DELETE FROM push_devices').run();
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
  });
  it('suppresses other notifications for 24h and replaces generic return reminders', async () => {
    await queueNotification(ctx.env.DB, {
      profileId: user.profileId,
      sourceKey: 'other',
      now: iso(NOW - 3600_000),
      content: {
        kind: 'team',
        title: 'event',
        body: 'event',
        target: { type: 'screen', screen: 'home' },
      },
    });
    expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(0);
    await stale(8);
    expect((await queueReengagement(ctx.env, NOW)).created).toBe(0);
  });
  it.each(['return', 'retirement', 'other-notification', 'disabled'])(
    'rechecks %s after enqueue before sending',
    async (reason) => {
      await queueCareerReminders(ctx.env, NOW);
      if (reason === 'return') await activity('active', careerId);
      if (reason === 'retirement') await historicalCareer('retired');
      if (reason === 'other-notification')
        await queueNotification(ctx.env.DB, {
          profileId: user.profileId,
          sourceKey: 'other',
          now: iso(),
          content: {
            kind: 'team',
            title: 'event',
            body: 'event',
            target: { type: 'screen', screen: 'home' },
          },
        });
      if (reason === 'disabled') ctx.env.CAREER_REMINDER_ENABLED = '0';
      const send = transport();
      await consumeCareerReminders(batch(), ctx.env, NOW, send);
      await runPersonalPush(ctx.env, NOW + 300_000, send);
      expect(send).not.toHaveBeenCalled();
      expect(await rows('push_deliveries')).toMatchObject([{ state: 'cancelled' }]);
    },
  );
  it('rolls back the lifetime reservation on failed notification storage and recovers failed publication via cron', async () => {
    await ctx.env.DB.exec(
      "CREATE TRIGGER fail_reminder BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'fixture'); END;",
    );
    await expect(queueCareerReminders(ctx.env, NOW)).rejects.toThrow();
    expect(await rows('career_activity')).toMatchObject([{ reminder_stage: 0 }]);
    expect(queue.send).not.toHaveBeenCalled();
    await ctx.env.DB.exec('DROP TRIGGER fail_reminder;');
    queue.send.mockRejectedValue(new Error('Queue offline'));
    await queueCareerReminders(ctx.env, NOW);
    const send = transport();
    await runPersonalPush(ctx.env, NOW + 300_000, send);
    expect(send).toHaveBeenCalledOnce();
  });
  it('does not send at night including delayed retries; respects 429 backoff', async () => {
    expect((await queueCareerReminders(ctx.env, NOW + 4 * 3600_000)).created).toBe(0);
    await queueCareerReminders(ctx.env, NOW);
    const job = batch();
    const send = transport();
    await consumeCareerReminders(job, ctx.env, NOW + 4 * 3600_000, send);
    expect(job.messages[0]!.retry).toHaveBeenCalledWith({ delaySeconds: 16 * 3600 });
    await runPersonalPush(ctx.env, NOW + 4 * 3600_000, send);
    expect(send).not.toHaveBeenCalled();
    const throttled = vi.fn(async () => new Response(null, { status: 429 }));
    await consumeCareerReminders(job, ctx.env, NOW, throttled);
    expect(job.messages[0]!.retry).toHaveBeenCalledWith({ delaySeconds: 300 });
  });
  it('provides English and Japanese inbox copy for every stage', () => {
    for (const row of careerReminderText)
      for (const value of [row.title, row.body])
        for (const lang of ['en', 'ja'] as const) {
          expect(pushText(value, lang)).not.toBe(value);
          expect(pushText(value, lang)).not.toMatch(/[가-힣]/);
        }
  });
  it('rejects malformed state and a career belonging to another account', async () => {
    expect((await activity('active', null)).status).toBe(400);
    const other = await issueCookie(ctx);
    const id = crypto.randomUUID();
    await ctx.env.DB.prepare(
      `INSERT INTO careers (id,profile_id,pos,foot,type,trait,start_year,status,app_version,created_at,updated_at) VALUES (?,?,'FW','오른발','test','test',2026,'active','test',?,?)`,
    )
      .bind(id, other.profileId, iso(), iso())
      .run();
    expect((await activity('active', id)).status).toBe(409);
  });
});

describe('retention reporting', () => {
  it('counts accepted, click, return and first retirement once in the immutable stage cohort', async () => {
    const { getPushPerformance, recordPushInteraction } =
      await import('../db/repos/pushPerformance.js');
    await queueCareerReminders(ctx.env, NOW);
    await consumeCareerReminders(batch(), ctx.env, NOW, transport());
    const id = (await rows('notifications'))[0]!.id as string;
    await recordPushInteraction(ctx.env.DB, user.profileId, id, 'click', iso(NOW + 1000));
    vi.setSystemTime(NOW + DAY);
    await activity('active', careerId);
    await activity('active', careerId);
    const first = (await rows('career_reminder_outcomes'))[0]!.returned_at;
    vi.setSystemTime(NOW + 2 * DAY);
    await activity('retired', careerId);
    await activity('retired', careerId);
    expect((await rows('career_reminder_outcomes'))[0]!.returned_at).toBe(first);
    const report = await getPushPerformance(
      ctx.env.DB,
      { days: '7', page: 0 },
      new Date(NOW + 2 * DAY),
    );
    expect(report.retention).toEqual([
      expect.objectContaining({
        stage: 1,
        recipients: 1,
        acceptedRecipients: 1,
        clicked: 1,
        returned: 1,
        retired: 1,
      }),
    ]);
    const { PushPerformanceSchema } = await import('@offside/contracts');
    expect(PushPerformanceSchema.safeParse(report).success).toBe(true);
  });
  it('does not credit unsent reminders, other accounts or returns outside the window', async () => {
    const { recordCareerReminderOutcome } = await import('../db/repos/careerReminderOutcome.js');
    await queueCareerReminders(ctx.env, NOW);
    await recordCareerReminderOutcome(ctx.env.DB, user.profileId, true, iso(NOW + 1000));
    expect((await rows('career_reminder_outcomes'))[0]!.returned_at).toBeNull();
    await consumeCareerReminders(batch(), ctx.env, NOW, transport());
    const other = await issueCookie(ctx);
    await recordCareerReminderOutcome(ctx.env.DB, other.profileId, true, iso(NOW + DAY));
    await recordCareerReminderOutcome(ctx.env.DB, user.profileId, true, iso(NOW + 8 * DAY));
    expect((await rows('career_reminder_outcomes'))[0]!.returned_at).toBeNull();
  });
  it('attributes a return only to the latest accepted stage and cascades account deletion', async () => {
    const { recordCareerReminderOutcome } = await import('../db/repos/careerReminderOutcome.js');
    await queueCareerReminders(ctx.env, NOW);
    await consumeCareerReminders(batch(), ctx.env, NOW, transport());
    await queueCareerReminders(ctx.env, NOW + 4 * DAY);
    await consumeCareerReminders(batch(), ctx.env, NOW + 4 * DAY, transport());
    await recordCareerReminderOutcome(ctx.env.DB, user.profileId, false, iso(NOW + 5 * DAY));
    const outcomes = await rows('career_reminder_outcomes');
    expect(outcomes.find((r) => r.stage === 1)!.returned_at).toBeNull();
    expect(outcomes.find((r) => r.stage === 2)!.returned_at).toBe(iso(NOW + 5 * DAY));
    await ctx.env.DB.prepare('DELETE FROM notifications WHERE profile_id=?')
      .bind(user.profileId)
      .run();
    expect(await rows('career_reminder_outcomes')).toEqual([]);
  });
  it('sends localized text and fixed analytics metadata without career/profile identifiers', async () => {
    await ctx.env.DB.prepare("UPDATE career_activity SET lang='en'").run();
    await queueCareerReminders(ctx.env, NOW);
    const send = transport();
    await consumeCareerReminders(batch(), ctx.env, NOW, send);
    const payload = JSON.parse(String(send.mock.calls[0]![1]!.body))[0];
    expect(payload.title).not.toBe(careerReminderText[0].title);
    expect(payload.data).toMatchObject({ campaign: 'career_reminder', reminderStage: 1 });
    expect(JSON.stringify(payload)).not.toContain(careerId);
    expect(JSON.stringify(payload)).not.toContain(user.profileId);
  });
});

it('keeps the one-device cohort when legacy return notifications are generated in the same cron tick', async () => {
  await addAppPushDevice(ctx, user.profileId);
  await stale(3);
  const legacy = await issueCookie(ctx);
  await addAppPushDevice(ctx, legacy.profileId);
  await ctx.env.DB.prepare('UPDATE push_devices SET updated_at=? WHERE profile_id=?')
    .bind(iso(NOW - 8 * DAY), legacy.profileId)
    .run();
  expect((await queueCareerReminders(ctx.env, NOW)).created).toBe(1);
  expect((await queueReengagement(ctx.env, NOW)).created).toBe(1);
  const deliveries = await rows('push_deliveries');
  expect(deliveries.filter((r) => r.profile_id === user.profileId)).toHaveLength(1);
  expect(deliveries.filter((r) => r.profile_id === legacy.profileId)).toHaveLength(1);
});
