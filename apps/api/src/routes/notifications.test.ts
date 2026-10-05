import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { sha256Hex } from '../db/hash.js';
import { queueNotification } from '../db/repos/notifications.js';
import { runPersonalPush } from '../push/personal.js';
import { queueReengagement } from '../push/reengagement.js';
import { newsPushStatements } from '../push/enqueue.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';

const NOW = Date.parse('2026-10-05T06:00:00.000Z'); // KST 15:00
const iso = (at = NOW) => new Date(at).toISOString();
const content = {
  kind: 'team' as const,
  title: '내 팀 새 소식',
  body: '확인할 소식이 있어요.',
  target: { type: 'screen' as const, screen: 'team' as const },
};
let ctx: TestD1;
beforeEach(async () => {
  ctx = await createTestD1();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await ctx.dispose();
});
async function identity() {
  const res = await createApp().request(
    '/v1/app/session',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    ctx.env,
  );
  const { data } = (await res.json()) as { data: { token: string } };
  const row = await ctx.env.DB.prepare('SELECT id, profile_id FROM sessions WHERE token_hash = ?')
    .bind(await sha256Hex(data.token))
    .first<{ id: string; profile_id: string }>();
  return { token: data.token, id: row!.id, profileId: row!.profile_id };
}
function call(token: string, path: string, body?: unknown) {
  return createApp().request(
    path,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    ctx.env,
  );
}
async function queue(a: Awaited<ReturnType<typeof identity>>, key: string, at = NOW, push = false) {
  return queueNotification(ctx.env.DB, {
    profileId: a.profileId,
    sourceKey: key,
    content,
    now: iso(at),
    push,
  });
}
async function device(a: Awaited<ReturnType<typeof identity>>, n = 1, enabled = true) {
  const installationId = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const r = await createApp().request(
    '/v1/push/device',
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installationId,
        token: `ExpoPushToken[test_${n}]`,
        platform: 'ios',
        appVersion: '1.1.0',
        engagementEnabled: enabled,
      }),
    },
    ctx.env,
  );
  expect(r.status).toBe(200);
  return installationId;
}
async function deliveries() {
  return (await ctx.env.DB.prepare('SELECT state, token FROM push_deliveries ORDER BY id').all())
    .results;
}
function enable() {
  ctx.env.ENVIRONMENT = 'production';
  ctx.env.PERSONAL_PUSH_ENABLED = '1';
  ctx.env.REENGAGEMENT_PUSH_ENABLED = '1';
}
const send = () =>
  vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    const body = JSON.parse(init!.body as string) as unknown[];
    return Response.json({ data: body.map((_, i) => ({ status: 'ok', id: `ticket_${i}` })) });
  });

describe('private notification inbox', () => {
  it('isolates list, detail, read and read-all by the authenticated profile', async () => {
    const a = await identity(),
      b = await identity();
    const own = await queue(a, 'own'),
      other = await queue(b, 'other');
    const list = await call(a.token, '/v1/notifications');
    expect(list.headers.get('Cache-Control')).toContain('no-store');
    expect(await list.json()).toMatchObject({ data: { items: [{ id: own.id }], unreadCount: 1 } });
    expect((await call(a.token, `/v1/notifications/${other.id}`)).status).toBe(404);
    expect((await call(a.token, `/v1/notifications/${other.id}/read`, {})).status).toBe(404);
    await call(a.token, '/v1/notifications/read-all', { through: iso(NOW + 1000) });
    expect(await (await call(b.token, '/v1/notifications')).json()).toMatchObject({
      data: { unreadCount: 1 },
    });
    expect((await createApp().request('/v1/notifications', {}, ctx.env)).status).toBe(401);
    expect((await call(a.token, '/v1/notifications?profileId=' + b.profileId)).status).toBe(400);
  });
  it('paginates equal timestamps without gaps or duplicates and supports unread filtering', async () => {
    const a = await identity();
    for (let i = 0; i < 25; i++) await queue(a, `page${i}`);
    const first = (await (await call(a.token, '/v1/notifications')).json()) as {
      data: { items: { id: string }[]; nextCursor: string };
    };
    expect(first.data.items).toHaveLength(20);
    const second = (await (
      await call(a.token, '/v1/notifications?cursor=' + encodeURIComponent(first.data.nextCursor))
    ).json()) as { data: { items: { id: string }[]; nextCursor: null } };
    expect(second.data.items).toHaveLength(5);
    expect(new Set([...first.data.items, ...second.data.items].map((x) => x.id)).size).toBe(25);
    expect(second.data.nextCursor).toBeNull();
    const path = `/v1/notifications/${first.data.items[0]!.id}/read`;
    const read = (await (await call(a.token, path, {})).json()) as { data: unknown };
    expect(await (await call(a.token, path, {})).json()).toMatchObject({ data: read.data });
    const unread = (await (await call(a.token, '/v1/notifications?unread=1')).json()) as {
      data: { items: { id: string }[]; unreadCount: number };
    };
    expect(unread.data.unreadCount).toBe(24);
    expect(unread.data.items.map((x) => x.id)).not.toContain(first.data.items[0]!.id);
    expect((await call(a.token, '/v1/notifications?cursor=broken')).status).toBe(400);
  });
  it('keeps later arrivals unread during read-all and hides expired records', async () => {
    const a = await identity();
    const old = await queue(a, 'old'),
      later = await queue(a, 'later', NOW + 1000),
      expired = await queue(a, 'expired', NOW - 91 * 86400_000);
    expect(
      await (await call(a.token, '/v1/notifications/read-all', { through: iso() })).json(),
    ).toMatchObject({ data: { updated: 1 } });
    expect(await (await call(a.token, `/v1/notifications/${later.id}`)).json()).toMatchObject({
      data: { readAt: null },
    });
    expect(await (await call(a.token, `/v1/notifications/${old.id}`)).json()).toMatchObject({
      data: { readAt: expect.any(String) },
    });
    expect((await call(a.token, `/v1/notifications/${expired.id}`)).status).toBe(404);
  });
  it('creates one source record and two device deliveries and deletes only the removed profile', async () => {
    const a = await identity(),
      b = await identity();
    await device(a, 1);
    await device(a, 2);
    await device(b, 3);
    const first = await queue(a, 'dedupe', NOW, true);
    expect(await queue(a, 'dedupe', NOW, true)).toEqual({ id: first.id, created: false });
    await queue(b, 'dedupe', NOW, true);
    expect(await deliveries()).toHaveLength(3);
    const args = { sessionId: a.id, sessionTokenHash: await sha256Hex(a.token), now: iso() };
    const { confirmToken } = await issueDeleteConfirmToken(args);
    await executeProfileDeletion(ctx.db, { ...args, profileId: a.profileId, confirmToken });
    expect(await deliveries()).toHaveLength(1);
    expect(
      (await ctx.env.DB.prepare('SELECT profile_id FROM notifications').all()).results,
    ).toEqual([{ profile_id: b.profileId }]);
  });
  it('stores one news inbox record for multiple recipient devices and adds its ID to legacy delivery', async () => {
    const a = await identity();
    await device(a, 1);
    await device(a, 2);
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        "INSERT INTO board_posts (id, board, author_profile_id, title, body, created_at, updated_at) VALUES ('pst_inbox', 'notice', ?, '새 공지', '본문', ?, ?)",
      ).bind(a.profileId, iso(), iso()),
      ...newsPushStatements(ctx.env.DB, 'pst_inbox', 'notice', iso()),
    ]);
    expect(
      (await ctx.env.DB.prepare('SELECT profile_id, source_key FROM notifications').all()).results,
    ).toEqual([{ profile_id: a.profileId, source_key: 'news:notice:2026-10-05' }]);
    expect(
      (await ctx.env.DB.prepare('SELECT id FROM push_news_deliveries').all()).results,
    ).toHaveLength(2);
  });
});
describe('personal event delivery infrastructure', () => {
  it('requires optional consent, sends all devices once, then confirms receipts without resending', async () => {
    const a = await identity();
    await device(a, 1);
    await device(a, 2);
    await device(a, 3, false);
    const n = await queue(a, 'multi', NOW, true);
    enable();
    const fetcher = send();
    await runPersonalPush(ctx.env, NOW, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    const payload = JSON.parse(fetcher.mock.calls[0]![1]!.body as string);
    expect(payload).toHaveLength(2);
    expect(payload[0].data).toEqual({ type: 'offside-notification', notificationId: n.id });
    expect(await deliveries()).toEqual([
      { state: 'accepted', token: expect.any(String) },
      { state: 'accepted', token: expect.any(String) },
    ]);
    const receipt = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: { ticket_0: { status: 'ok' }, ticket_1: { status: 'ok' } } }),
      );
    await runPersonalPush(ctx.env, NOW + 16 * 60_000, receipt);
    expect(receipt.mock.calls[0]![0]).toContain('getReceipts');
    expect(await deliveries()).toEqual([
      { state: 'confirmed', token: '' },
      { state: 'confirmed', token: '' },
    ]);
  });
  it('cancels read or opted-out events and ignores quiet hours; flags default off', async () => {
    const a = await identity();
    await device(a);
    const n = await queue(a, 'read', NOW, true);
    const fetcher = send();
    expect(await runPersonalPush(ctx.env, NOW, fetcher)).toEqual({ enabled: false });
    enable();
    await runPersonalPush(ctx.env, Date.parse('2026-10-05T12:00:00Z'), fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    await call(a.token, `/v1/notifications/${n.id}/read`, {});
    await runPersonalPush(ctx.env, NOW, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await deliveries()).toEqual([{ state: 'cancelled', token: '' }]);
    await queue(a, 'off', NOW, true);
    await device(a, 1, false);
    await runPersonalPush(ctx.env, NOW, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('treats ambiguous transport as unknown and never retries that event', async () => {
    const a = await identity();
    await device(a);
    await queue(a, 'unknown', NOW, true);
    enable();
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout'));
    await runPersonalPush(ctx.env, NOW, fetcher);
    await runPersonalPush(ctx.env, NOW + 60 * 60_000, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(await deliveries()).toEqual([{ state: 'unknown', token: '' }]);
  });
  it('enforces one hour spacing and a two-event daily budget shared by device fan-out', async () => {
    const a = await identity();
    await device(a, 1);
    await device(a, 2);
    enable();
    const fetcher = send();
    await queue(a, 'first', NOW, true);
    await queue(a, 'tooSoon', NOW, true);
    await runPersonalPush(ctx.env, NOW, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toHaveLength(2);
    await queue(a, 'second', NOW + 61 * 60_000, true);
    await runPersonalPush(ctx.env, NOW + 61 * 60_000, fetcher);
    await queue(a, 'third', NOW + 122 * 60_000, true);
    await runPersonalPush(ctx.env, NOW + 122 * 60_000, fetcher);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/send'))).toHaveLength(2);
    expect(
      (
        await ctx.env.DB.prepare(
          'SELECT id FROM notifications WHERE push_reserved_at IS NOT NULL',
        ).all()
      ).results,
    ).toHaveLength(2);
  });
  it('queues a return only once per absence, excludes active other devices, and cancels on return', async () => {
    const a = await identity(),
      b = await identity();
    await device(a, 1);
    await device(b, 2);
    await device(b, 3);
    enable();
    await ctx.env.DB.prepare(
      'UPDATE push_devices SET updated_at = ? WHERE profile_id = ? OR token = ?',
    )
      .bind(iso(NOW - 8 * 86400_000), a.profileId, 'ExpoPushToken[test_2]')
      .run();
    expect(await queueReengagement(ctx.env, NOW)).toEqual({ enabled: true, created: 1 });
    expect(await queueReengagement(ctx.env, NOW)).toEqual({ enabled: true, created: 0 });
    await device(a, 1);
    const fetcher = send();
    await runPersonalPush(ctx.env, NOW, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await deliveries()).toEqual([{ state: 'cancelled', token: '' }]);
  });
  it('claims concurrent workers once and limits explicit retry attempts', async () => {
    const a = await identity();
    await device(a);
    await queue(a, 'retry', NOW, true);
    enable();
    const throttled = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 }));
    await Promise.all([
      runPersonalPush(ctx.env, NOW, throttled),
      runPersonalPush(ctx.env, NOW, throttled),
    ]);
    expect(throttled).toHaveBeenCalledOnce();
    for (const minutes of [5, 15, 35, 80])
      await runPersonalPush(ctx.env, NOW + minutes * 60_000, throttled);
    expect(throttled).toHaveBeenCalledTimes(4);
    expect(await deliveries()).toEqual([{ state: 'failed', token: '' }]);
  });
  it('cancels previous-account and expired recipients without sending to a newly bound device', async () => {
    const a = await identity(),
      b = await identity();
    const install = await device(a);
    await queue(a, 'switch', NOW, true);
    await createApp().request(
      '/v1/push/device',
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installationId: install,
          token: 'ExpoPushToken[replacement]',
          platform: 'ios',
          appVersion: '1.1.0',
          engagementEnabled: true,
        }),
      },
      ctx.env,
    );
    enable();
    const fetcher = send();
    await runPersonalPush(ctx.env, NOW, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    await queue(b, 'expired', NOW - 2 * 86400_000, true);
    await runPersonalPush(ctx.env, NOW, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await ctx.env.DB.prepare('SELECT profile_id FROM push_devices').all()).results).toEqual(
      [{ profile_id: b.profileId }],
    );
  });
  it('does not remove a newer registration when the old in-flight token is rejected', async () => {
    const a = await identity(),
      b = await identity();
    const install = await device(a);
    await queue(a, 'race', NOW, true);
    enable();
    let complete!: (r: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const running = runPersonalPush(ctx.env, NOW, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    await createApp().request(
      '/v1/push/device',
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installationId: install,
          token: 'ExpoPushToken[current]',
          platform: 'ios',
          appVersion: '1.1.0',
          engagementEnabled: true,
        }),
      },
      ctx.env,
    );
    complete(
      Response.json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
    );
    await running;
    expect((await ctx.env.DB.prepare('SELECT token FROM push_devices').all()).results).toEqual([
      { token: 'ExpoPushToken[current]' },
    ]);
  });
  it('removes queued token copies on unregister while retaining the inbox record', async () => {
    const a = await identity();
    const installationId = await device(a);
    const n = await queue(a, 'unregister', NOW, true);
    await createApp().request(
      '/v1/push/device',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ installationId }),
      },
      ctx.env,
    );
    expect(await deliveries()).toEqual([]);
    expect(await (await call(a.token, `/v1/notifications/${n.id}`)).json()).toMatchObject({
      data: { id: n.id },
    });
  });
});
