import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { sha256Hex } from '../db/hash.js';
import { queueNotification } from '../db/repos/notifications.js';
import { runPersonalPush } from '../push/personal.js';
import { queueReengagement } from '../push/reengagement.js';
import { fanoutNewsEvent, newsPushStatements } from '../push/enqueue.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';
import { commitNotifiedEvent } from '../push/events.js';
import { eq } from 'drizzle-orm';
import { profiles } from '../db/schema.js';

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
function preferences(a: Awaited<ReturnType<typeof identity>>, body: unknown) {
  return createApp().request(
    '/v1/push/preferences',
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    ctx.env,
  );
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
    await preferences(a, { social: false });
    await preferences(b, { market: false });
    expect(await deliveries()).toHaveLength(3);
    const args = { sessionId: a.id, sessionTokenHash: await sha256Hex(a.token), now: iso() };
    const { confirmToken } = await issueDeleteConfirmToken(args);
    await executeProfileDeletion(ctx.db, { ...args, profileId: a.profileId, confirmToken });
    expect(await deliveries()).toHaveLength(1);
    expect(
      (await ctx.env.DB.prepare('SELECT profile_id FROM push_preferences').all()).results,
    ).toEqual([{ profile_id: b.profileId }]);
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
    // 기기를 한 대씩 나눠 써도 알림함은 한 번만 들어간다(T-11-688).
    await fanoutNewsEvent(ctx.env.DB, 'pst_inbox', 'notice', iso(), 1);
    expect(
      (await ctx.env.DB.prepare('SELECT profile_id, source_key FROM notifications').all()).results,
    ).toEqual([{ profile_id: a.profileId, source_key: 'news:notice:2026-10-05' }]);
    expect(
      (await ctx.env.DB.prepare('SELECT id FROM push_news_deliveries').all()).results,
    ).toHaveLength(2);
  });
});
describe('personal event delivery infrastructure', () => {
  it('T-11-588 개인 알림은 받는 사람의 마지막 게임 언어로 보내고, 기록이 없으면 한국어로 보낸다', async () => {
    const a = await identity();
    const b = await identity();
    await device(a, 1);
    await device(b, 2);
    await ctx.env.DB.prepare(
      "INSERT INTO career_activity (profile_id, state, last_active_at, lang) VALUES (?, 'active', ?, 'ja')",
    )
      .bind(a.profileId, iso())
      .run();
    const result = {
      kind: 'team' as const,
      title: '내 팀에 새 경기 결과가 있어요',
      body: 'A 1 : 0 B. 최근 경기에서 결과를 확인해 주세요.',
      target: { type: 'screen' as const, screen: 'team' as const },
    };
    for (const who of [a, b])
      await queueNotification(ctx.env.DB, {
        profileId: who.profileId,
        sourceKey: 'result',
        content: result,
        now: iso(),
        push: true,
      });
    enable();
    const fetcher = send();
    await runPersonalPush(ctx.env, NOW, fetcher);
    const payload = JSON.parse(fetcher.mock.calls[0]![1]!.body as string) as {
      title: string;
      body: string;
    }[];
    expect(payload.map((p) => p.title).sort()).toEqual(
      [result.title, '自分のチームに新しい試合結果があります'].sort(),
    );
    expect(payload.map((p) => p.body)).toContain('A 1 : 0 B。最近の試合で結果を確認してください。');
    expect(payload.map((p) => p.body)).toContain(result.body);
  });
  it('includes legacy subscribers without a separate engagement opt-in and confirms all device receipts once', async () => {
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
    expect(payload).toHaveLength(3);
    // T-11-547 앱 아이콘 숫자는 받는 사람의 안 읽은 알림 수다(지금 보내는 알림 포함).
    expect(payload.map((p: { badge: number }) => p.badge)).toEqual([1, 1, 1]);
    expect(payload[0].data).toEqual({
      type: 'offside-notification',
      notificationId: n.id,
      kind: 'team',
      target: { type: 'screen', screen: 'team' },
    });
    expect(await deliveries()).toEqual([
      { state: 'accepted', token: expect.any(String) },
      { state: 'accepted', token: expect.any(String) },
      { state: 'accepted', token: expect.any(String) },
    ]);
    const receipt = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          ticket_0: { status: 'ok' },
          ticket_1: { status: 'ok' },
          ticket_2: { status: 'ok' },
        },
      }),
    );
    await runPersonalPush(ctx.env, NOW + 16 * 60_000, receipt);
    expect(receipt.mock.calls[0]![0]).toContain('getReceipts');
    expect(await deliveries()).toEqual([
      { state: 'confirmed', token: '' },
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
    const removal = await createApp().request(
      '/v1/push/device',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ installationId: '00000000-0000-4000-8000-000000000001' }),
      },
      ctx.env,
    );
    expect(removal.status).toBe(200);
    await runPersonalPush(ctx.env, NOW, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends only cup events from 20:00 to 22:00 KST', async () => {
    const cup = await identity();
    const other = await identity();
    await device(cup, 1);
    await device(other, 2);
    enable();
    const at = Date.parse('2026-10-13T12:05:00Z'); // 21:05 KST, 컵 경기 직후
    await queue(cup, 'cup-match:cpm_1:tem_1', at, true);
    await queue(other, 'team-match:tmm_1', at, true);
    const fetcher = send();
    await runPersonalPush(ctx.env, at, fetcher);
    const sent = fetcher.mock.calls.filter(([url]) => String(url).endsWith('/send'));
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]![1]!.body as string)[0].to).toBe('ExpoPushToken[test_1]');
    await queue(cup, 'cup-match:cpm_2:tem_1', at + 61 * 60_000, true);
    await runPersonalPush(ctx.env, Date.parse('2026-10-13T13:05:00Z'), fetcher); // 22:05 KST
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/send'))).toHaveLength(1);
  });
  it('sends cup events past the hourly and daily budget without spending it', async () => {
    const a = await identity();
    await device(a);
    enable();
    const fetcher = send();
    const sends = () => fetcher.mock.calls.filter(([url]) => String(url).endsWith('/send')).length;
    await queue(a, 'team-match:tmm_1', NOW, true);
    await runPersonalPush(ctx.env, NOW, fetcher);
    await queue(a, 'cup:s1-1:moved', NOW + 60_000, true);
    await queue(a, 'cup:s1-1:draw', NOW + 60_000, true);
    await queue(a, 'cup-match:cpm_1:tem_1', NOW + 60_000, true);
    await runPersonalPush(ctx.env, NOW + 60_000, fetcher);
    expect(sends()).toBe(2);
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string)).toHaveLength(3);
    // 컵 알림은 예산을 쓰지 않아서 한 시간 뒤 다른 알림이 오늘 두 번째 자리를 받는다.
    await queue(a, 'team-match:tmm_2', NOW + 61 * 60_000, true);
    await runPersonalPush(ctx.env, NOW + 61 * 60_000, fetcher);
    expect(sends()).toBe(3);
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
  it('queues a return for a legacy subscriber once per absence, excludes active other devices, and cancels on return', async () => {
    const a = await identity(),
      b = await identity();
    await device(a, 1, false);
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

describe('feature push preferences and atomic events', () => {
  it.each(['request', 'accepted'] as const)(
    'delivers a still valid friend %s event to the recipient',
    async (event) => {
      const from = await identity(),
        to = await identity();
      await device(to);
      await ctx.env.DB.prepare(
        'INSERT INTO friends (profile_id, friend_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(
          to.profileId,
          from.profileId,
          event === 'request' ? 'received' : 'accepted',
          iso(),
          iso(),
        )
        .run();
      await queueNotification(ctx.env.DB, {
        profileId: to.profileId,
        sourceKey: `friend-${event}:${from.profileId}:one`,
        content: { ...content, kind: 'social' },
        now: iso(),
        push: true,
      });
      enable();
      const transport = send();
      await runPersonalPush(ctx.env, NOW, transport);
      expect(transport).toHaveBeenCalledTimes(1);
      expect(await deliveries()).toEqual([{ state: 'accepted', token: 'ExpoPushToken[test_1]' }]);
    },
  );
  it.each(['removed', 'accepted', 'blocked'] as const)(
    'cancels a stale friend request after it is %s',
    async (change) => {
      const from = await identity(),
        to = await identity();
      await device(to);
      await ctx.env.DB.prepare(
        "INSERT INTO friends (profile_id, friend_id, state, created_at, updated_at) VALUES (?, ?, 'received', ?, ?)",
      )
        .bind(to.profileId, from.profileId, iso(), iso())
        .run();
      await queueNotification(ctx.env.DB, {
        profileId: to.profileId,
        sourceKey: `friend-request:${from.profileId}:one`,
        content: { ...content, kind: 'social' },
        now: iso(),
        push: true,
      });
      if (change === 'removed') await ctx.env.DB.prepare('DELETE FROM friends').run();
      if (change === 'accepted')
        await ctx.env.DB.prepare("UPDATE friends SET state = 'accepted'").run();
      if (change === 'blocked')
        await ctx.env.DB.prepare(
          "INSERT INTO board_blocks (id, profile_id, blocked_profile_id, nickname, created_at) VALUES ('blk_test', ?, ?, '구단주', ?)",
        )
          .bind(to.profileId, from.profileId, iso())
          .run();
      enable();
      const transport = send();
      await runPersonalPush(ctx.env, NOW, transport);
      expect(transport).not.toHaveBeenCalled();
      expect(await deliveries()).toEqual([{ state: 'cancelled', token: '' }]);
    },
  );
  it('keeps defaults and partial changes per account and rejects unauthenticated, empty and unknown-key writes', async () => {
    const a = await identity(),
      b = await identity();
    expect(await (await call(a.token, '/v1/push/preferences')).json()).toMatchObject({
      data: { notice: true, release: true, team: true, market: true, social: true },
    });
    expect((await preferences(a, { market: false })).status).toBe(200);
    expect(await (await preferences(a, { social: false })).json()).toMatchObject({
      data: { notice: true, release: true, team: true, market: false, social: false },
    });
    expect(await (await call(b.token, '/v1/push/preferences')).json()).toMatchObject({
      data: { market: true, social: true },
    });
    expect((await preferences(a, {})).status).toBe(400);
    expect((await preferences(a, { engagementEnabled: true })).status).toBe(400);
    expect((await preferences(a, { team: 'false' })).status).toBe(400);
    expect((await createApp().request('/v1/push/preferences', {}, ctx.env)).status).toBe(401);
  });
  it('T-11-501 nudge는 ?nudge=1로 묻는 새 앱에만 싣고, 옛 앱에는 옛 모양 그대로 돌려준다', async () => {
    const a = await identity();
    const legacy = (await (await call(a.token, '/v1/push/preferences')).json()) as {
      data: Record<string, boolean>;
    };
    expect(Object.keys(legacy.data).sort()).toEqual([
      'market',
      'notice',
      'release',
      'social',
      'team',
    ]);
    expect(await (await call(a.token, '/v1/push/preferences?nudge=1')).json()).toMatchObject({
      data: { nudge: true },
    });
    const put = await createApp().request(
      '/v1/push/preferences?nudge=1',
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nudge: false }),
      },
      ctx.env,
    );
    expect(await put.json()).toMatchObject({ data: { nudge: false, team: true } });
    // 옛 앱이 다른 항목을 바꿔도 nudge는 그대로이고 응답에 실리지 않는다.
    const old = (await (await preferences(a, { team: false })).json()) as {
      data: Record<string, boolean>;
    };
    expect(old.data).not.toHaveProperty('nudge');
    expect(await (await call(a.token, '/v1/push/preferences?nudge=1')).json()).toMatchObject({
      data: { nudge: false, team: false },
    });
  });
  it('주제 모양은 ?v=2로 묻는 앱에만 주고, 고르지 않은 주제는 옛 설정을 따른다', async () => {
    const a = await identity();
    const v2 = async () =>
      (
        (await (await call(a.token, '/v1/push/preferences?v=2')).json()) as {
          data: Record<string, boolean>;
        }
      ).data;
    expect(Object.keys(await v2()).sort()).toEqual(
      [
        'attendance',
        'comeback',
        'cup',
        'friend',
        'league',
        'market',
        'match',
        'notice',
        'release',
        'reward',
      ].sort(),
    );
    expect(Object.values(await v2()).every(Boolean)).toBe(true);
    // 옛 앱에서 팀을 끄면 경기 · 컵 · 리그가 함께 꺼진다. 보상은 친구 설정이 켜져 있어 켬으로 보인다.
    await preferences(a, { team: false });
    expect(await v2()).toMatchObject({ match: false, cup: false, league: false, reward: true });
    // 새 앱에서 컵만 켠다. 옛 설정(team)은 그대로다.
    const put = await createApp().request(
      '/v1/push/preferences?v=2',
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cup: true, attendance: false }),
      },
      ctx.env,
    );
    expect(await put.json()).toMatchObject({
      data: { cup: true, match: false, league: false, attendance: false, comeback: true },
    });
    expect(await (await call(a.token, '/v1/push/preferences?nudge=1')).json()).toMatchObject({
      data: { team: false, nudge: true },
    });
    // 옛 앱이 팀을 다시 바꾸면 그 아래 주제 선택은 지워지고 옛 설정을 따른다.
    await preferences(a, { cup: false });
    await preferences(a, { team: true });
    expect(await v2()).toMatchObject({ match: true, cup: true, league: true, attendance: false });
    expect((await preferences(a, { cup: 'yes' })).status).toBe(400);
    expect((await preferences(a, { unknownTopic: true })).status).toBe(400);
  });
  it('주제 선택이 옛 설정보다 먼저다: 팀을 꺼도 켠 주제는 보내고, 팀이 켜져 있어도 끈 주제는 안 보낸다', async () => {
    const a = await identity();
    await device(a);
    const event = (sourceKey: string, topic: 'match' | 'cup' | 'league' | null) =>
      queueNotification(ctx.env.DB, {
        profileId: a.profileId,
        sourceKey,
        topic,
        content,
        now: iso(),
        push: true,
      });
    await preferences(a, { team: false });
    await preferences(a, { cup: true });
    await event('topic:match', 'match');
    await event('topic:none', null);
    expect(await deliveries()).toEqual([]);
    await event('topic:cup', 'cup');
    expect(await deliveries()).toHaveLength(1);
    await preferences(a, { team: true });
    await preferences(a, { league: false });
    await event('topic:league', 'league');
    expect(await deliveries()).toHaveLength(1);
    await event('topic:match2', 'match');
    expect(await deliveries()).toHaveLength(2);
    // 알림함에는 설정과 상관없이 모두 남는다.
    expect((await ctx.env.DB.prepare('SELECT id FROM notifications').all()).results).toHaveLength(
      5,
    );
  });
  it('대기 중인 알림도 보내기 직전에 주제 선택을 다시 본다', async () => {
    const a = await identity();
    await device(a);
    await queueNotification(ctx.env.DB, {
      profileId: a.profileId,
      sourceKey: 'pending-topic',
      topic: 'league',
      content,
      now: iso(),
      push: true,
    });
    expect(await deliveries()).toHaveLength(1);
    await preferences(a, { league: false });
    enable();
    const transport = send();
    await runPersonalPush(ctx.env, NOW, transport);
    expect(transport).not.toHaveBeenCalled();
    expect(await deliveries()).toEqual([{ state: 'cancelled', token: '' }]);
  });
  it('알림함을 묶음으로 골라 본다. 주제를 적기 전 알림은 종류로 나눈다', async () => {
    const a = await identity();
    const add = (
      sourceKey: string,
      kind: 'team' | 'market' | 'social',
      topic: 'cup' | 'reward' | 'friend' | 'market' | null,
    ) =>
      queueNotification(ctx.env.DB, {
        profileId: a.profileId,
        sourceKey,
        topic,
        content: { ...content, kind },
        now: iso(),
      });
    const cup = await add('g:cup', 'team', 'cup');
    const oldTeam = await add('g:old-team', 'team', null);
    const grant = await add('g:grant', 'team', 'reward');
    const friend = await add('g:friend', 'social', 'friend');
    const sold = await add('g:sold', 'market', 'market');
    const ids = async (group: string) =>
      (
        (await (await call(a.token, `/v1/notifications?group=${group}`)).json()) as {
          data: { items: { id: string }[]; unreadCount: number };
        }
      ).data;
    expect((await ids('game')).items.map((n) => n.id).sort()).toEqual([cup.id, oldTeam.id].sort());
    expect((await ids('social')).items.map((n) => n.id).sort()).toEqual(
      [grant.id, friend.id].sort(),
    );
    expect((await ids('market')).items.map((n) => n.id)).toEqual([sold.id]);
    expect((await ids('news')).items).toEqual([]);
    // 안 읽은 수는 묶음과 상관없이 전체다.
    expect((await ids('market')).unreadCount).toBe(5);
    expect((await call(a.token, '/v1/notifications?group=unknown')).status).toBe(400);
  });
  it('기기 등록에 실린 OS 권한 상태를 남기고, 보내지 않는 옛 앱은 비워 둔다', async () => {
    const a = await identity();
    const register = (permission?: string) =>
      createApp().request(
        '/v1/push/device',
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            installationId: '00000000-0000-4000-8000-000000000077',
            token: 'ExpoPushToken[test_perm]',
            platform: 'ios',
            appVersion: '1.1.8',
            ...(permission ? { permission } : {}),
          }),
        },
        ctx.env,
      );
    const stored = () => ctx.env.DB.prepare('SELECT permission FROM push_devices').first();
    expect((await register('provisional')).status).toBe(200);
    expect(await stored()).toEqual({ permission: 'provisional' });
    expect((await register('authorized')).status).toBe(200);
    expect(await stored()).toEqual({ permission: 'authorized' });
    expect((await register()).status).toBe(200);
    expect(await stored()).toEqual({ permission: null });
    expect((await register('denied')).status).toBe(400);
  });
  it.each(['team', 'market', 'social'] as const)(
    'preserves %s inbox records without queueing opted-out device tokens or replaying them after opt-in',
    async (kind) => {
      const a = await identity();
      await device(a);
      await preferences(a, { [kind]: false });
      const input = {
        profileId: a.profileId,
        sourceKey: 'feature:one',
        content: { ...content, kind },
        now: iso(),
        push: true,
      };
      const n = await queueNotification(ctx.env.DB, input);
      expect(n.created).toBe(true);
      expect(await deliveries()).toEqual([]);
      await preferences(a, { [kind]: true });
      expect(await queueNotification(ctx.env.DB, input)).toEqual({ id: n.id, created: false });
      expect(await deliveries()).toEqual([]);
      await queueNotification(ctx.env.DB, { ...input, sourceKey: 'feature:two' });
      expect(await deliveries()).toHaveLength(1);
      expect((await ctx.env.DB.prepare('SELECT id FROM notifications').all()).results).toHaveLength(
        2,
      );
    },
  );
  it('cancels an already queued delivery when its category is disabled before dispatch', async () => {
    const a = await identity();
    await device(a);
    await queue(a, 'pending-category', NOW, true);
    await preferences(a, { team: false });
    enable();
    const transport = send();
    await runPersonalPush(ctx.env, NOW, transport);
    expect(transport).not.toHaveBeenCalled();
    expect(await deliveries()).toEqual([{ state: 'cancelled', token: '' }]);
    expect((await ctx.env.DB.prepare('SELECT id FROM notifications').all()).results).toHaveLength(
      1,
    );
  });
  it('separates notice and release preferences while retaining both news inbox records', async () => {
    const a = await identity();
    await device(a);
    await preferences(a, { notice: false });
    for (const board of ['notice', 'release'] as const) {
      const id = `pst_pref_${board}`;
      await ctx.env.DB.batch([
        ctx.env.DB.prepare(
          'INSERT INTO board_posts (id, board, author_profile_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(id, board, a.profileId, '새 소식', '내용', iso(), iso()),
        ...newsPushStatements(ctx.env.DB, id, board, iso()),
      ]);
      await fanoutNewsEvent(ctx.env.DB, id, board, iso());
    }
    expect(
      (await ctx.env.DB.prepare('SELECT event_id FROM push_news_deliveries').all()).results,
    ).toEqual([{ event_id: 'release:2026-10-05' }]);
    expect((await ctx.env.DB.prepare('SELECT id FROM notifications').all()).results).toHaveLength(
      2,
    );
  });
  it('rolls back the business mutation and inbox when the atomic delivery insert fails', async () => {
    const a = await identity();
    await device(a);
    await ctx.env.DB.exec(
      "CREATE TRIGGER fail_push_insert BEFORE INSERT ON push_deliveries BEGIN SELECT RAISE(ABORT, 'test queue failure'); END",
    );
    await expect(
      commitNotifiedEvent(
        ctx.db,
        [ctx.db.update(profiles).set({ nickname: 'changed' }).where(eq(profiles.id, a.profileId))],
        { profileId: a.profileId, sourceKey: 'atomic-fail', topic: 'match', content, now: iso() },
      ),
    ).rejects.toThrow();
    expect(
      await ctx.env.DB.prepare('SELECT nickname FROM profiles WHERE id = ?')
        .bind(a.profileId)
        .first(),
    ).toEqual({ nickname: null });
    expect((await ctx.env.DB.prepare('SELECT id FROM notifications').all()).results).toEqual([]);
    expect(await deliveries()).toEqual([]);
  });
});
