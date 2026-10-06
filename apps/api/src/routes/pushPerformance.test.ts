import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, linkGoogle, type TestD1 } from '../test/d1.js';
import { createApp } from '../app.js';
import { callJson, issueCookie } from '../test/http.js';
import { sha256Hex } from '../db/hash.js';
import { queueNotification } from '../db/repos/notifications.js';
import { registerPushDevice, unregisterPushDevice } from '../db/repos/pushDevices.js';
import { getPushPerformance, recordPushInteraction } from '../db/repos/pushPerformance.js';
import { runPersonalPush } from '../push/personal.js';
import { createPost } from '../db/repos/boards.js';
import { PushPerformanceSchema } from '@offside/contracts';

let ctx: TestD1;
const now = () => new Date().toISOString();
beforeEach(async () => {
  ctx = await createTestD1();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await ctx.dispose();
});
async function identity(admin = false) {
  const response = await createApp().request(
    '/v1/app/session',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    ctx.env,
  );
  const { data } = (await response.json()) as { data: { token: string } };
  const session = await ctx.env.DB.prepare(
    'SELECT id, profile_id AS profileId FROM sessions WHERE token_hash = ?',
  )
    .bind(await sha256Hex(data.token))
    .first<{ id: string; profileId: string }>();
  if (admin) {
    await linkGoogle(ctx, session!.profileId, { email: 'admin@example.com' });
    ctx.env.ADMIN_EMAILS = 'admin@example.com';
  }
  return { token: data.token, session: { ...session!, channel: 'app' as const } };
}
function call(a: Awaited<ReturnType<typeof identity>>, path: string, body?: unknown) {
  return createApp().request(
    path,
    {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
    ctx.env,
  );
}
async function device(a: Awaited<ReturnType<typeof identity>>, n = 1) {
  const installationId = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await registerPushDevice(
    ctx.env.DB,
    a.session,
    { installationId, token: `ExpoPushToken[${n}]`, platform: 'ios', appVersion: '1.1.0' },
    now(),
  );
  return installationId;
}
async function queue(
  a: Awaited<ReturnType<typeof identity>>,
  key = 'team:test',
  kind: 'team' | 'test' = 'team',
  at = now(),
) {
  return (
    await queueNotification(ctx.env.DB, {
      profileId: a.session.profileId,
      sourceKey: key,
      now: at,
      push: true,
      content: {
        kind,
        title: '경기 결과',
        body: '새 경기가 있어요.',
        target: { type: 'screen', screen: 'team' },
      },
    })
  ).id!;
}
const report = () => getPushPerformance(ctx.env.DB, { days: '7', page: 0 });
async function accept(id: string) {
  await ctx.env.DB.prepare(
    "UPDATE push_deliveries SET state = 'accepted', ticket_id = 'ticket', updated_at = ? WHERE notification_id = ?",
  )
    .bind(now(), id)
    .run();
}

describe('push performance and private interactions', () => {
  it('captures an accepted answer after unregister during sending, without recreating token copies', async () => {
    const a = await identity();
    const installationId = await device(a);
    const id = await queue(a);
    ctx.env.ENVIRONMENT = 'production';
    ctx.env.PERSONAL_PUSH_ENABLED = '1';
    const day = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const sendAt = Date.parse(`${day}T09:00:00+09:00`);
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => {
      await unregisterPushDevice(ctx.env.DB, installationId);
      return Response.json({ data: [{ status: 'ok', id: 'late-ticket' }] });
    });
    await runPersonalPush(ctx.env, sendAt, transport);
    expect(transport).toHaveBeenCalledTimes(1);
    const r = await ctx.env.DB.prepare(
      'SELECT state, accepted_at FROM push_results WHERE notification_id = ?',
    )
      .bind(id)
      .first();
    expect(r).toMatchObject({ state: 'unknown', accepted_at: new Date(sendAt).toISOString() });
    expect(await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM push_deliveries').first()).toEqual({
      n: 0,
    });
    expect((await report()).totals.accepted).toBe(1);
  });
  it('preserves cumulative multi-device delivery facts through receipts and unregister, deduplicates clicks', async () => {
    const a = await identity();
    const first = await device(a),
      second = await device(a, 2);
    const id = await queue(a);
    expect((await report()).totals).toMatchObject({ queued: 2, pending: 2, acceptedRecipients: 0 });
    await accept(id);
    await Promise.all([
      recordPushInteraction(ctx.env.DB, a.session.profileId, id, 'click', now()),
      recordPushInteraction(ctx.env.DB, a.session.profileId, id, 'click', now()),
    ]);
    await ctx.env.DB.prepare(
      "UPDATE push_deliveries SET state = 'confirmed', token = '', updated_at = ? WHERE notification_id = ?",
    )
      .bind(now(), id)
      .run();
    await recordPushInteraction(ctx.env.DB, a.session.profileId, id, 'target_open', now());
    await unregisterPushDevice(ctx.env.DB, first);
    await unregisterPushDevice(ctx.env.DB, second);
    const metrics = (await report()).totals;
    expect(metrics).toMatchObject({
      queued: 2,
      accepted: 2,
      confirmed: 2,
      recipients: 1,
      acceptedRecipients: 1,
      clicked: 1,
      targetOpened: 1,
    });
    const columns = (await ctx.env.DB.prepare('PRAGMA table_info(push_results)').all()).results.map(
      (c) => c.name,
    );
    expect(columns).not.toContain('token');
    expect(columns).not.toContain('session_id');
    await ctx.env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(id).run();
    expect((await report()).totals.queued).toBe(0);
    expect(await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM push_interactions').first()).toEqual(
      { n: 0 },
    );
  });
  it('counts only owned, sent app notifications; reading and target-only navigation do not count as clicks', async () => {
    const a = await identity(),
      b = await identity();
    await device(a);
    const id = await queue(a);
    const unsent = (
      await queueNotification(ctx.env.DB, {
        profileId: a.session.profileId,
        sourceKey: 'inbox-only',
        now: now(),
        content: {
          kind: 'team',
          title: '알림',
          body: '내용',
          target: { type: 'screen', screen: 'team' },
        },
      })
    ).id!;
    await accept(id);
    expect((await call(a, `/v1/notifications/${id}/read`, {})).status).toBe(200);
    await call(a, `/v1/notifications/${id}/interaction`, { event: 'target_open' });
    await call(b, `/v1/notifications/${id}/interaction`, { event: 'click' });
    await call(a, `/v1/notifications/${unsent}/interaction`, { event: 'click' });
    expect((await report()).totals).toMatchObject({ clicked: 0, targetOpened: 0 });
    await call(a, `/v1/notifications/${id}/interaction`, { event: 'click' });
    await call(a, `/v1/notifications/${id}/interaction`, { event: 'click' });
    expect((await report()).totals.clicked).toBe(1);
    const web = await issueCookie(ctx);
    expect(
      (
        await callJson(ctx.env, 'POST', `/v1/notifications/${id}/interaction`, {
          cookie: web.cookie,
          body: { event: 'click' },
        })
      ).status,
    ).toBe(403);
    expect(
      (await call(a, `/v1/notifications/${id}/interaction`, { event: 'purchase' })).status,
    ).toBe(400);
  });
  it('bounds attribution to 24 hours and ignores stale or future client timestamps', async () => {
    const a = await identity();
    await device(a);
    const id = await queue(a);
    await accept(id);
    const before = new Date(Date.now() - 86400_001).toISOString();
    await call(a, `/v1/notifications/${id}/interaction`, { event: 'click', occurredAt: before });
    await call(a, `/v1/notifications/${id}/interaction`, {
      event: 'click',
      occurredAt: new Date(Date.now() + 600_000).toISOString(),
    });
    expect((await report()).totals.clicked).toBe(0);
    await recordPushInteraction(ctx.env.DB, a.session.profileId, id, 'click', before);
    await recordPushInteraction(ctx.env.DB, a.session.profileId, id, 'target_open', now());
    expect((await report()).totals.targetOpened).toBe(0);
  });
  it('checks administrator access and bounded KST cohorts, separates tests and paginates campaign history', async () => {
    const a = await identity(true),
      b = await identity();
    await device(a);
    expect((await createApp().request('/v1/admin/push-performance', {}, ctx.env)).status).toBe(401);
    expect((await call(b, '/v1/admin/push-performance')).status).toBe(403);
    for (let n = 0; n < 22; n++) await queue(a, `match:${n}`);
    await queue(a, 'test:manual', 'test');
    await queue(a, 'old', 'team', new Date(Date.now() - 8 * 86400_000).toISOString());
    const response = await call(a, '/v1/admin/push-performance?days=7');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { data } = (await response.json()) as { data: unknown };
    const r = PushPerformanceSchema.parse(data);
    expect(r.totals.queued).toBe(22);
    expect(r.campaigns).toHaveLength(20);
    expect(r.hasMore).toBe(true);
    await queue(
      a,
      'arrived-after-open',
      'team',
      new Date(Date.parse(r.cohortThrough) + 1).toISOString(),
    );
    const tail = await getPushPerformance(
      ctx.env.DB,
      { days: '7', page: 1, through: r.cohortThrough },
      new Date(Date.parse(r.cohortThrough) + 1000),
    );
    expect(tail.campaigns).toHaveLength(2);
    expect(tail.hasMore).toBe(false);
    expect(new Set([...r.campaigns, ...tail.campaigns].map((c) => c.id)).size).toBe(22);
    expect(
      (await getPushPerformance(ctx.env.DB, { days: '30', tests: '1', page: 0 })).totals.queued,
    ).toBe(25);
    expect((await call(a, '/v1/admin/push-performance?days=365')).status).toBe(400);
    expect((await call(a, '/v1/admin/push-performance?page=-1')).status).toBe(400);
    const at = new Date('2026-10-05T15:00:00.000Z');
    expect((await getPushPerformance(ctx.env.DB, { days: '7', page: 0 }, at)).from).toBe(
      '2026-09-29T15:00:00.000Z',
    );
  });
  it('mirrors news results and groups a shared announcement without merging recipient clicks', async () => {
    const a = await identity(true),
      b = await identity();
    await device(a);
    await device(b, 2);
    await createPost(
      ctx.db,
      'notice',
      { title: '새 공지', body: '공지 내용', pinned: false },
      a.session.profileId,
      now(),
    );
    await ctx.env.DB.prepare("UPDATE push_news_deliveries SET state = 'accepted', updated_at = ?")
      .bind(now())
      .run();
    const row = await ctx.env.DB.prepare('SELECT id FROM notifications WHERE profile_id = ?')
      .bind(a.session.profileId)
      .first<{ id: string }>();
    await recordPushInteraction(ctx.env.DB, a.session.profileId, row!.id, 'click', now());
    const r = await report();
    expect(r.campaigns).toHaveLength(1);
    expect(r.categories[0]).toMatchObject({
      category: 'notice',
      accepted: 2,
      acceptedRecipients: 2,
      clicked: 1,
    });
    await ctx.env.DB.prepare(
      "UPDATE push_news_deliveries SET state = 'confirmed', token = '', updated_at = ?",
    )
      .bind(now())
      .run();
    await ctx.env.DB.prepare('DELETE FROM push_news_events').run();
    expect((await report()).totals).toMatchObject({ confirmed: 2, accepted: 2, clicked: 1 });
  });
  it('records manual test tickets, checks receipts without re-sending, and retains terminal failure evidence', async () => {
    const a = await identity();
    const installationId = await device(a);
    ctx.env.PUSH_TEST_ENABLED = '1';
    ctx.env.ENVIRONMENT = 'production';
    ctx.env.PERSONAL_PUSH_ENABLED = '1';
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ data: { status: 'ok', id: 'manual-ticket' } })),
    );
    expect((await call(a, '/v1/push/test', { installationId })).status).toBe(200);
    const r = await getPushPerformance(ctx.env.DB, { days: '7', tests: '1', page: 0 });
    expect(r.totals).toMatchObject({ accepted: 1, confirmed: 0 });
    expect((await report()).totals.queued).toBe(0);
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { 'manual-ticket': { status: 'ok' } } }));
    await runPersonalPush(ctx.env, Date.now() + 16 * 60_000, transport);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0]![0])).toContain('getReceipts');
    expect(
      (await getPushPerformance(ctx.env.DB, { days: '7', tests: '1', page: 0 })).totals.confirmed,
    ).toBe(1);
    const b = await identity();
    const next = await device(b, 2);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }),
        ),
    );
    expect((await call(b, '/v1/push/test', { installationId: next })).status).toBe(503);
    expect(
      (await getPushPerformance(ctx.env.DB, { days: '7', tests: '1', page: 0 })).totals.failed,
    ).toBe(1);
  });
});
