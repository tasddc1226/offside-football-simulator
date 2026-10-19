import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie } from '../test/http.js';
import { addAppPushDevice, capturePushQueue } from '../test/push.js';
import { queueNotification } from '../db/repos/notifications.js';
import { createPost } from '../db/repos/boards.js';
import { publishPushWork, type PushWork } from './queuePublish.js';
import { consumePushWork } from './queue.js';
import { createApp } from '../app.js';

const time = Date.parse('2026-10-18T03:00:00Z'); // KST noon; session expiry is deliberately later.
let ctx: TestD1;
let queue: ReturnType<typeof capturePushQueue>;
let profileId: string;
let installation: string;
beforeEach(async () => {
  ctx = await createTestD1();
  ctx.env.ENVIRONMENT = 'production';
  ctx.env.NEWS_PUSH_ENABLED = '1';
  ctx.env.PERSONAL_PUSH_ENABLED = '1';
  queue = capturePushQueue(ctx.env);
  profileId = (await issueCookie(ctx)).profileId;
  installation = await addAppPushDevice(ctx, profileId);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await ctx.dispose();
});
async function personal(source = crypto.randomUUID()) {
  await queueNotification(ctx.env.DB, {
    profileId,
    sourceKey: source,
    now: new Date(time).toISOString(),
    push: true,
    content: {
      kind: 'team',
      title: 'Result',
      body: 'Ready',
      target: { type: 'screen', screen: 'team' },
    },
  });
}
function batch(body: unknown) {
  const ack = vi.fn(),
    retry = vi.fn();
  return {
    ack,
    retry,
    value: {
      queue: 'offside-push-production',
      metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
      messages: [
        { id: crypto.randomUUID(), timestamp: new Date(time), attempts: 1, body, ack, retry },
      ],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    },
  };
}
async function consume(body: PushWork, transport: typeof fetch, now = time) {
  const b = batch(body);
  await consumePushWork(b.value, ctx.env, now, transport);
  return b;
}
const state = () =>
  ctx.env.DB.prepare('SELECT state FROM push_deliveries').first<{ state: string }>();

it('publishes committed personal work without contacting Expo, sends once on delivery, then checks its receipt', async () => {
  await personal();
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ status: 'ok', id: 'ticket' }] }));
  vi.stubGlobal('fetch', transport);
  await publishPushWork(ctx.env, 'personal', time);
  expect(transport).not.toHaveBeenCalled();
  const job = queue.jobs.shift()!;
  expect(JSON.stringify(job)).not.toContain('ExpoPushToken');
  expect((await consume(job, transport)).ack).toHaveBeenCalledOnce();
  expect(transport).toHaveBeenCalledOnce();
  expect(await state()).toEqual({ state: 'accepted' });
  const receipt = queue.jobs.shift()!;
  await consume(job, transport); // duplicate before receipt due: neither send nor fork a delayed job
  expect(transport).toHaveBeenCalledOnce();
  expect(queue.jobs).toHaveLength(0);
  transport.mockResolvedValue(Response.json({ data: { ticket: { status: 'ok' } } }));
  await consume(receipt, transport, time + 900_000);
  expect(String(transport.mock.calls[1]![0])).toContain('getReceipts');
  expect(await state()).toEqual({ state: 'confirmed' });
});

it('scopes Queue deliveries to their IDs instead of draining unrelated users or events', async () => {
  await personal();
  await personal();
  const rows = await ctx.env.DB.prepare('SELECT id FROM push_deliveries ORDER BY id').all<{
    id: string;
  }>();
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ status: 'ok', id: 'one' }] }));
  await consume({ version: 1, kind: 'personal', ids: [rows.results[0]!.id] }, transport);
  expect(
    (await ctx.env.DB.prepare(
      "SELECT count(*) AS n FROM push_deliveries WHERE state='pending'",
    ).first<{ n: number }>())!.n,
  ).toBe(1);
  expect(JSON.parse(transport.mock.calls[0]![1]!.body as string)).toHaveLength(1);
});

it('publishes and consumes news using the same Queue and keeps duplicate delivery idempotent', async () => {
  await createPost(
    ctx.db,
    'notice',
    { title: 'News', body: 'Body', pinned: false },
    profileId,
    new Date(time).toISOString(),
  );
  await publishPushWork(ctx.env, 'news', time);
  const job = queue.jobs.shift()!;
  expect(job.kind).toBe('news');
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ status: 'ok', id: 'news-ticket' }] }));
  await consume(job, transport);
  await consume(job, transport);
  expect(transport).toHaveBeenCalledOnce();
});

it('preserves quiet hours, and recovery republishes rather than sending directly', async () => {
  await personal();
  await publishPushWork(ctx.env, 'personal', time);
  const transport = vi.fn<typeof fetch>();
  await consume(queue.jobs.shift()!, transport, Date.parse('2026-10-18T13:00:00Z'));
  expect(transport).not.toHaveBeenCalled();
  expect(await state()).toEqual({ state: 'pending' });
  await publishPushWork(ctx.env, 'personal', time);
  expect(queue.jobs[0]!.kind).toBe('personal');
});

it('rechecks token rotation and preference withdrawal before a queued send', async () => {
  await personal();
  await publishPushWork(ctx.env, 'personal', time);
  await ctx.env.DB.prepare(
    "UPDATE push_devices SET token='ExpoPushToken[rotated]' WHERE installation_hash=?",
  )
    .bind(installation)
    .run();
  const transport = vi.fn<typeof fetch>();
  await consume(queue.jobs.shift()!, transport);
  expect(transport).not.toHaveBeenCalled();
  expect(await state()).toEqual({ state: 'cancelled' });
});

it('delays transient rejection, then retries via Queue; never replays an ambiguous transport', async () => {
  await personal();
  await publishPushWork(ctx.env, 'personal', time);
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 }));
  await consume(queue.jobs.shift()!, transport);
  expect(await state()).toEqual({ state: 'pending' });
  const retry = queue.jobs.shift()!;
  transport.mockRejectedValue(new Error('connection lost'));
  await consume(retry, transport, time + 300_000);
  expect(await state()).toEqual({ state: 'unknown' });
  await consume(retry, transport, time + 600_000);
  expect(transport).toHaveBeenCalledTimes(2);
});

it('recovers interrupted sends as unknown without replay and retries Queue/DB failures', async () => {
  await personal();
  await publishPushWork(ctx.env, 'personal', time);
  await ctx.env.DB.prepare("UPDATE push_deliveries SET state='sending'").run();
  const transport = vi.fn<typeof fetch>();
  await consume(queue.jobs.shift()!, transport, time + 180_000);
  expect(await state()).toEqual({ state: 'unknown' });
  expect(transport).not.toHaveBeenCalled();
  const failed = batch({ version: 1, kind: 'personal', ids: ['missing'] });
  const db = ctx.env.DB;
  ctx.env.DB = new Proxy(db, {
    get(target, key) {
      if (key === 'batch')
        return async () => {
          throw new Error('D1 down');
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  await consumePushWork(failed.value, ctx.env, time, transport);
  ctx.env.DB = db;
  expect(failed.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
  expect(failed.ack).not.toHaveBeenCalled();
});

it('rejects invalid jobs without a database read or external send', async () => {
  const transport = vi.fn<typeof fetch>();
  for (const body of [
    null,
    { version: 2, kind: 'personal', ids: ['a'] },
    { version: 1, kind: 'personal', ids: Array(81).fill('x') },
    { version: 1, kind: 'test', id: 'ordinary', lang: 'ko' },
  ]) {
    const b = batch(body);
    await consumePushWork(b.value, ctx.env, time, transport);
    expect(b.ack).toHaveBeenCalledOnce();
  }
  expect(transport).not.toHaveBeenCalled();
});

it('splits at 80 IDs so D1 claims remain below the 100 bound-parameter limit', async () => {
  for (let i = 0; i < 82; i++) await personal(`bulk:${i}`);
  await publishPushWork(ctx.env, 'personal', time);
  expect(queue.jobs.map((j) => ('ids' in j ? j.ids.length : 0))).toEqual([80, 2]);
  // Cancel via disabled preference, exercising a real D1 80-ID claim without sending 80 pushes.
  await ctx.env.DB.prepare('INSERT INTO push_preferences (profile_id,team) VALUES (?,0)')
    .bind(profileId)
    .run();
  const transport = vi.fn<typeof fetch>();
  expect((await consume(queue.jobs.shift()!, transport)).ack).toHaveBeenCalledOnce();
  expect(transport).not.toHaveBeenCalled();
});

it('acknowledges manual tests only after Queue publication and sends the requested language in its consumer', async () => {
  const response = await createApp().request(
    '/v1/app/session',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    ctx.env,
  );
  const { data } = (await response.json()) as { data: { token: string } };
  const call = (path: string, method: string, body: unknown) =>
    createApp().request(
      path,
      {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify(body),
      },
      ctx.env,
    );
  ctx.env.PUSH_TEST_ENABLED = '1';
  const installationId = crypto.randomUUID();
  await call('/v1/push/device', 'PUT', {
    installationId,
    token: 'ExpoPushToken[manual]',
    platform: 'ios',
    appVersion: '1.1.0',
  });
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: { status: 'ok', id: 'manual-ticket' } }));
  vi.stubGlobal('fetch', transport);
  expect((await call('/v1/push/test?lang=en', 'POST', { installationId })).status).toBe(200);
  expect(transport).not.toHaveBeenCalled();
  const work = queue.jobs.shift()!;
  expect(work.kind).toBe('test');
  await consume(work, transport, Date.now());
  expect(JSON.parse(transport.mock.calls[0]![1]!.body as string)).toMatchObject({
    title: 'OFFSIDE notification test',
    data: { test: true },
  });
  await consume(work, transport, Date.now());
  expect(transport).toHaveBeenCalledOnce();
});

it('fails closed when the Queue is missing or publishing fails; never falls back to direct Expo', async () => {
  await personal();
  delete ctx.env.PUSH_QUEUE;
  await expect(publishPushWork(ctx.env, 'personal', time)).rejects.toThrow('PUSH_QUEUE');
  queue = capturePushQueue(ctx.env);
  ctx.env.PUSH_QUEUE!.sendBatch = vi.fn().mockRejectedValue(new Error('Queue unavailable'));
  await expect(publishPushWork(ctx.env, 'personal', time)).rejects.toThrow('Queue unavailable');
  expect(await state()).toEqual({ state: 'pending' });
  queue = capturePushQueue(ctx.env);
  await publishPushWork(ctx.env, 'personal', time);
  expect(queue.jobs).toHaveLength(1);
});

it('publishes only the requested source/cohort through its source-key index', async () => {
  await personal('career-reminder:cohort:one');
  await personal('career-reminder:other:two');
  await publishPushWork(ctx.env, 'personal', time, {
    key: 'career-reminder:cohort:',
    prefix: true,
  });
  expect(queue.jobs).toHaveLength(1);
  expect('ids' in queue.jobs[0]! && queue.jobs[0]!.ids).toHaveLength(1);
  const plan = await ctx.env.DB.prepare(
    'EXPLAIN QUERY PLAN SELECT id FROM notifications INDEXED BY notifications_source_key_idx WHERE source_key>=? AND source_key<?',
  )
    .bind('career-reminder:cohort:', 'career-reminder:cohort:\uffff')
    .all<{ detail: string }>();
  expect(plan.results.some((r) => /SEARCH.*notifications_source_key_idx/.test(r.detail))).toBe(
    true,
  );
});

it('cancels a manual test on failed publication and never sends even if that message arrives late', async () => {
  const response = await createApp().request(
    '/v1/app/session',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    ctx.env,
  );
  const { data } = (await response.json()) as { data: { token: string } };
  const call = (path: string, method: string, body: unknown) =>
    createApp().request(
      path,
      {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify(body),
      },
      ctx.env,
    );
  ctx.env.PUSH_TEST_ENABLED = '1';
  const installationId = crypto.randomUUID();
  await call('/v1/push/device', 'PUT', {
    installationId,
    token: 'ExpoPushToken[late]',
    platform: 'ios',
    appVersion: '1.1.0',
  });
  let late: PushWork | undefined;
  ctx.env.PUSH_QUEUE!.send = vi.fn().mockImplementation(async (body: PushWork) => {
    late = body;
    throw new Error('publish response lost');
  });
  const transport = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', transport);
  const failed = await call('/v1/push/test?lang=en', 'POST', { installationId });
  expect(failed.status).toBe(503);
  expect(await failed.json()).toMatchObject({
    error: { message: "We couldn't send the notification request." },
  });
  expect(await state()).toEqual({ state: 'cancelled' });
  await consume(late!, transport, Date.now());
  expect(transport).not.toHaveBeenCalled();
});
