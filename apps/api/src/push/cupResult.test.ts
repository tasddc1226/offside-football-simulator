import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { planCup } from '@offside/contracts/cup';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie } from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';
import {
  cupResultStatements,
  consumeCupResults,
  publishCupResults,
  cupResultSource,
} from './cupResult.js';
import { getPushPerformance, recordPushInteraction } from '../db/repos/pushPerformance.js';
import { runPersonalPush } from './personal.js';
import { cupKo } from '../cupText.js';
import { pushText } from './text.js';

const NOW = Date.parse('2026-10-11T12:00:00.000Z'); // KST21:00, cup window
const now = new Date(NOW).toISOString();
const cup = planCup({ id: 's1-1', season: 1, edition: 1, opensOn: '2026-10-01', capacity: 64 });
let ctx: TestD1;
let user: Awaited<ReturnType<typeof issueCookie>>;
let queue: { sendBatch: ReturnType<typeof vi.fn> };
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ctx = await createTestD1();
  user = await issueCookie(ctx);
  await addAppPushDevice(ctx, user.profileId);
  queue = { sendBatch: vi.fn() };
  Object.assign(ctx.env, {
    ENVIRONMENT: 'production',
    PERSONAL_PUSH_ENABLED: '1',
    CUP_PUSH_QUEUE: queue,
  });
  await ctx.env.DB.prepare('INSERT INTO cup_state(cup_id,seed,groups,drawn_at) VALUES(?,?,1,?)')
    .bind(cup.id, 'seed', now)
    .run();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await ctx.dispose();
});
async function entry(id = user.profileId, status = 'out') {
  await ctx.env.DB.prepare(
    `INSERT INTO cup_entries(cup_id,team_id,profile_id,name,manager,ovr,status,created_at,updated_at)
    VALUES(?,?,?,'Team','Manager',70,?,?,?)`,
  )
    .bind(cup.id, `team_${id}`, id, status, now, now)
    .run();
}
async function prediction(match: string, id = user.profileId, reward = true) {
  await ctx.env.DB.prepare(
    `INSERT OR IGNORE INTO cup_matches(id,cup_id,round,slot,at,played_at) VALUES(?,?,'g1',?,?,?)`,
  )
    .bind(match, cup.id, Number(match.slice(1)), now, now)
    .run();
  await ctx.env.DB.prepare(
    `INSERT INTO cup_predictions(cup_id,match_id,profile_id,pick,correct,settled_at,rewarded_at,created_at,updated_at)
    VALUES(?,?,?,'home',1,?,?,?,?)`,
  )
    .bind(cup.id, match, id, now, reward ? now : null, now, now)
    .run();
}
async function complete(at = now) {
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE cup_state SET done_at=? WHERE cup_id=? AND done_at IS NULL').bind(
      at,
      cup.id,
    ),
    ...cupResultStatements(ctx.env.DB, cup, at),
  ]);
}
async function rows(table: string) {
  return (await ctx.env.DB.prepare(`SELECT * FROM ${table}`).all()).results;
}
const transport = () =>
  vi.fn(async (_url: URL | Request | string, init?: RequestInit) =>
    Response.json({
      data: JSON.parse(String(init?.body)).map(() => ({ status: 'ok', id: 'ticket_1' })),
    }),
  );
function batch(body: unknown = { version: 1, cupId: cup.id }) {
  const message = {
    id: 'message',
    timestamp: new Date(),
    body,
    attempts: 1,
    ack: vi.fn(),
    retry: vi.fn(),
  };
  return {
    queue: 'offside-cup-push-production',
    metadata: { metrics: { backlogCount: 1, backlogBytes: 20 } },
    messages: [message],
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  };
}
it('deduplicates participant + multiple predictions and devices, prefers the participant message', async () => {
  await entry();
  await prediction('m1');
  await prediction('m2');
  await addAppPushDevice(ctx, user.profileId);
  await complete();
  await complete();
  await complete(new Date(NOW + 300000).toISOString());
  expect(await rows('notifications')).toHaveLength(1);
  expect(await rows('push_deliveries')).toHaveLength(1);
  expect((await rows('notifications'))[0]).toMatchObject({
    source_key: cupResultSource(cup.id),
    body: cupKo('completeBody'),
  });
});
it('predictor-only receives one reward message; withdrawn entrant uses prediction message', async () => {
  await entry(user.profileId, 'withdrawn');
  await prediction('m1');
  await prediction('m2');
  await complete();
  expect(await rows('notifications')).toHaveLength(1);
  expect((await rows('notifications'))[0]?.body).toBe(cupKo('predictionRewardBody'));
});
it('does not promise rerolls for unsuccessful predictions or notify unrelated users', async () => {
  await prediction('m1', user.profileId, false);
  await issueCookie(ctx);
  await complete();
  expect(await rows('notifications')).toHaveLength(1);
  expect((await rows('notifications'))[0]?.body).toBe(cupKo('predictionResultBody'));
});
it('respects team push preference at creation', async () => {
  await entry();
  await ctx.env.DB.prepare('INSERT INTO push_preferences(profile_id,team) VALUES(?,0)')
    .bind(user.profileId)
    .run();
  await complete();
  expect(await rows('notifications')).toHaveLength(1);
  expect(await rows('push_deliveries')).toHaveLength(0);
});
it('repeated Queue wakeups and cron never resend accepted notifications', async () => {
  await entry();
  await complete();
  const send = transport();
  await consumeCupResults(batch(), ctx.env, NOW, send);
  await consumeCupResults(batch(), ctx.env, NOW, send);
  await runPersonalPush(ctx.env, NOW + 300000, send);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await rows('push_deliveries'))[0]?.state).toBe('accepted');
});
it('cron repairs a missed Queue publish after five minutes', async () => {
  await entry();
  await complete();
  queue.sendBatch.mockRejectedValue(new Error('queue down'));
  await publishCupResults(ctx.env, [cup.id, cup.id]);
  expect(queue.sendBatch).toHaveBeenCalledTimes(1);
  const send = transport();
  await runPersonalPush(ctx.env, NOW, send);
  expect(send).not.toHaveBeenCalled();
  await runPersonalPush(ctx.env, NOW + 300000, send);
  expect(send).toHaveBeenCalledTimes(1);
});
it('retries explicit 503 with D1 backoff, but does not repeat an ambiguous timeout', async () => {
  await entry();
  await complete();
  const first = batch();
  await consumeCupResults(
    first,
    ctx.env,
    NOW,
    vi.fn(async () => new Response('', { status: 503 })),
  );
  expect(first.messages[0]!.retry).toHaveBeenCalledWith({ delaySeconds: 300 });
  const send = vi.fn(async () => {
    throw new Error('timeout');
  });
  await consumeCupResults(batch(), ctx.env, NOW + 300000, send);
  await consumeCupResults(batch(), ctx.env, NOW + 600000, send);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await rows('push_deliveries'))[0]?.state).toBe('unknown');
});
it('defers outside cup hours and sends at 09:00 KST', async () => {
  await entry();
  await complete();
  const job = batch();
  const send = transport();
  const late = Date.parse('2026-10-11T13:00:00Z');
  await consumeCupResults(job, ctx.env, late, send);
  expect(send).not.toHaveBeenCalled();
  expect(job.messages[0]!.retry).toHaveBeenCalledWith({ delaySeconds: 39600 });
  await consumeCupResults(batch(), ctx.env, Date.parse('2026-10-12T00:00:00Z'), send);
  expect(send).toHaveBeenCalledTimes(1);
});
it('cancels revoked devices and ignores malformed Queue messages', async () => {
  await entry();
  await complete();
  await ctx.env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE channel='app'").bind(now).run();
  const send = transport();
  await consumeCupResults(batch(), ctx.env, NOW, send);
  expect(send).not.toHaveBeenCalled();
  expect((await rows('push_deliveries'))[0]?.state).toBe('cancelled');
  const invalid = batch({ version: 1, cupId: 'bad:%' });
  await consumeCupResults(invalid, ctx.env, NOW, send);
  expect(invalid.messages[0]!.ack).toHaveBeenCalledOnce();
});
it('localizes completion and reward copy in English and Japanese', () => {
  for (const key of [
    'completeTitle',
    'completeBody',
    'predictionRewardBody',
    'predictionResultBody',
  ] as const) {
    const text = cupKo(key, { cup: '시즌 1 제1회 오프사이드 컵' });
    expect(pushText(text, 'en')).not.toMatch(/[가-힣]/);
    expect(pushText(text, 'ja')).not.toMatch(/[가-힣]/);
  }
});

it('concurrent Queue consumers claim one delivery', async () => {
  await entry();
  await complete();
  const send = transport();
  await Promise.all([
    consumeCupResults(batch(), ctx.env, NOW, send),
    consumeCupResults(batch(), ctx.env, NOW, send),
  ]);
  expect(send).toHaveBeenCalledTimes(1);
});
it('rolls back completion and notification together if the final transaction fails', async () => {
  await entry();
  await expect(
    ctx.env.DB.batch([
      ctx.env.DB.prepare('UPDATE cup_state SET done_at=? WHERE cup_id=? AND done_at IS NULL').bind(
        now,
        cup.id,
      ),
      ...cupResultStatements(ctx.env.DB, cup, now),
      ctx.env.DB.prepare('INSERT INTO nonexistent_cup_table VALUES(1)'),
    ]),
  ).rejects.toThrow();
  expect((await rows('cup_state'))[0]?.done_at).toBeNull();
  expect(await rows('notifications')).toHaveLength(0);
  expect(await rows('push_deliveries')).toHaveLength(0);
  await complete();
  expect(await rows('push_deliveries')).toHaveLength(1);
});
it('does not conflate separate accounts participating in the same cup', async () => {
  await entry();
  const other = await issueCookie(ctx);
  await addAppPushDevice(ctx, other.profileId);
  await prediction('m1', other.profileId);
  await prediction('m2', other.profileId);
  await complete();
  expect(await rows('notifications')).toHaveLength(2);
  expect(await rows('push_deliveries')).toHaveLength(2);
  const send = transport();
  await consumeCupResults(batch(), ctx.env, NOW, send);
  const payload = JSON.parse(String(send.mock.calls[0]?.[1]?.body)) as unknown[];
  expect(payload).toHaveLength(2);
});

it('reports one cup with deduplicated audience including accounts without push devices', async () => {
  await entry();
  await prediction('m1');
  await prediction('m2');
  const predictor = await issueCookie(ctx);
  await addAppPushDevice(ctx, predictor.profileId);
  await prediction('m1', predictor.profileId);
  await prediction('m2', predictor.profileId);
  const noDevice = await issueCookie(ctx);
  await entry(noDevice.profileId);
  await complete();
  const report = await getPushPerformance(ctx.env.DB, { days: '7', page: 0 }, new Date(NOW));
  expect(report.cups).toHaveLength(1);
  expect(report.cups![0]).toMatchObject({
    cupId: cup.id,
    recipients: 3,
    participants: 2,
    predictors: 2,
    overlap: 1,
    predictionOnly: 1,
    predictionEntries: 4,
    duplicatesRemoved: 3,
    notQueued: 1,
    queued: 2,
    pending: 2,
    accepted: 0,
  });
  expect(report.campaigns).toHaveLength(1);
  expect(report.campaigns[0]!.recipients).toBe(2);
  const send = transport();
  await consumeCupResults(batch(), ctx.env, NOW, send);
  const id = (await rows('notifications')).find((n) => n.profile_id === user.profileId)!
    .id as string;
  await recordPushInteraction(ctx.env.DB, user.profileId, id, 'click', now);
  await recordPushInteraction(ctx.env.DB, user.profileId, id, 'click', now);
  const after = await getPushPerformance(ctx.env.DB, { days: '7', page: 0 }, new Date(NOW));
  expect(after.cups![0]).toMatchObject({
    recipients: 3,
    notQueued: 1,
    acceptedRecipients: 2,
    clicked: 1,
  });
});
it('shows cups even when nobody has enabled push, and respects the date filter', async () => {
  await entry();
  await ctx.env.DB.prepare('DELETE FROM push_devices').run();
  await complete();
  const current = await getPushPerformance(ctx.env.DB, { days: '7', page: 0 }, new Date(NOW));
  expect(current.cups![0]).toMatchObject({ recipients: 1, queued: 0, notQueued: 1, accepted: 0 });
  expect(current.campaigns).toHaveLength(0);
  expect(
    (await getPushPerformance(ctx.env.DB, { days: '7', page: 0 }, new Date(NOW + 8 * 86400_000)))
      .cups,
  ).toEqual([]);
});
it('paginates cups independently of device registrations and keeps the cohort cutoff', async () => {
  for (let i = 0; i < 21; i++)
    await ctx.env.DB.prepare(
      `INSERT INTO notifications
    (id,profile_id,source_key,kind,title,body,target_json,created_at,expires_at)
    VALUES(?,?,?,'team','Cup','Done','{}',?,?)`,
    )
      .bind(
        `cup-report-${i}`,
        user.profileId,
        `cup-complete:report-${i}`,
        now,
        new Date(NOW + 86400_000).toISOString(),
      )
      .run();
  const first = await getPushPerformance(ctx.env.DB, { days: '7', page: 0 }, new Date(NOW));
  const second = await getPushPerformance(
    ctx.env.DB,
    { days: '7', page: 1, through: first.cohortThrough },
    new Date(NOW + 1000),
  );
  expect(first.cups).toHaveLength(20);
  expect(first.hasMore).toBe(true);
  expect(second.cups).toHaveLength(1);
  expect(second.hasMore).toBe(false);
  expect(new Set([...first.cups!, ...second.cups!].map((x) => x.cupId)).size).toBe(21);
});
