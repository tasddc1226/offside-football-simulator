import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, linkGoogle, type TestD1 } from '../test/d1.js';
import { issueCookie, callJson } from '../test/http.js';
import { sha256Hex } from '../db/hash.js';
import { ownPushDevice, rememberPushTestTicket } from '../db/repos/pushDevices.js';
import { reservePushTest } from '../push/testLimit.js';
import { cleanupExpired } from '../cron/cleanup.js';
import type { SessionContext } from '../env.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';

const INSTALL = '4997aa50-5dc0-4379-aa0b-b5d934df106d';
const OTHER_INSTALL = '7801198d-0cd2-4532-a7c6-bb3b1c3c893a';
const INPUT = {
  installationId: INSTALL,
  token: 'ExpoPushToken[own_device]',
  platform: 'ios',
  appVersion: '1.0.2',
};
let ctx: TestD1;
function call(token: string, method: string, path: string, body: unknown) {
  return createApp().request(
    path,
    {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
    ctx.env,
  );
}
async function identity() {
  const res = await createApp().request(
    '/v1/app/session',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    ctx.env,
  );
  expect(res.status).toBe(200);
  const { data } = (await res.json()) as { data: { token: string } };
  const row = await ctx.env.DB.prepare('SELECT id, profile_id FROM sessions WHERE token_hash = ?')
    .bind(await sha256Hex(data.token))
    .first<{ id: string; profile_id: string }>();
  return {
    token: data.token,
    session: { id: row!.id, profileId: row!.profile_id, channel: 'app' } satisfies SessionContext,
  };
}
beforeEach(async () => {
  ctx = await createTestD1();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await ctx.dispose();
});
describe('app push registration and own-device test', () => {
  it('keeps receipt evidence private and clears it on token or account changes', async () => {
    const a = await identity();
    const b = await identity();
    await linkGoogle(ctx, a.session.profileId, { email: 'admin@example.com' });
    ctx.env.ADMIN_EMAILS = 'admin@example.com';
    ctx.env.PUSH_TEST_ENABLED = '1';
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ data: { status: 'ok', id: 'private-ticket' } })),
    );
    const response = await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL });
    expect(await response.json()).toMatchObject({ data: { accepted: true } });
    const receipt = () =>
      ctx.env.DB.prepare(
        'SELECT last_test_ticket_id AS ticket, last_test_sent_at AS sent FROM push_devices',
      ).first();
    expect(await receipt()).toMatchObject({ ticket: 'private-ticket', sent: expect.any(String) });
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    expect(await receipt()).toMatchObject({ ticket: 'private-ticket' });
    await call(a.token, 'PUT', '/v1/push/device', { ...INPUT, token: 'ExpoPushToken[rotated]' });
    expect(await receipt()).toEqual({ ticket: null, sent: null });
    // A late result from the old token must not overwrite the new registration.
    await rememberPushTestTicket(
      ctx.env.DB,
      INSTALL,
      { token: INPUT.token, sessionId: a.session.id },
      'stale-ticket',
      new Date().toISOString(),
    );
    expect(await receipt()).toEqual({ ticket: null, sent: null });
    await rememberPushTestTicket(
      ctx.env.DB,
      INSTALL,
      { token: 'ExpoPushToken[rotated]', sessionId: a.session.id },
      'current-ticket',
      new Date().toISOString(),
    );
    await call(b.token, 'PUT', '/v1/push/device', { ...INPUT, token: 'ExpoPushToken[rotated]' });
    expect(await receipt()).toEqual({ ticket: null, sent: null });
    await rememberPushTestTicket(
      ctx.env.DB,
      INSTALL,
      { token: 'ExpoPushToken[rotated]', sessionId: a.session.id },
      'previous-account-ticket',
      new Date().toISOString(),
    );
    expect(await receipt()).toEqual({ ticket: null, sent: null });
  });
  it('T-11-106: ?lang=en sends the test push and errors in English; the inbox keeps the Korean original and translates on read', async () => {
    const a = await identity();
    await linkGoogle(ctx, a.session.profileId, { email: 'admin@example.com' });
    ctx.env.ADMIN_EMAILS = 'admin@example.com';
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    const disabled = await call(a.token, 'POST', '/v1/push/test?lang=en', {
      installationId: INSTALL,
    });
    expect(disabled.status).toBe(503);
    expect(await disabled.json()).toMatchObject({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'The notification test is being prepared.' },
    });
    const korean = await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL });
    expect(await korean.json()).toMatchObject({ error: { message: '알림 테스트 준비 중이에요.' } });

    ctx.env.PUSH_TEST_ENABLED = '1';
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { status: 'ok', id: 'en-ticket' } }));
    vi.stubGlobal('fetch', send);
    const ok = await call(a.token, 'POST', '/v1/push/test?lang=en', { installationId: INSTALL });
    expect(ok.status).toBe(200);
    expect(JSON.parse(send.mock.calls[0]![1]!.body as string)).toMatchObject({
      title: 'OFFSIDE notification test',
      body: 'Notices and release note alerts are connected.',
    });
    const inbox = async (lang: string) =>
      (await (
        await createApp().request(
          `/v1/notifications${lang}`,
          { headers: { Authorization: `Bearer ${a.token}` } },
          ctx.env,
        )
      ).json()) as { data: { items: { title: string; body: string }[] } };
    expect((await inbox('')).data.items[0]).toMatchObject({
      title: '오프사이드 알림 테스트',
      body: '이 기기의 알림 연결을 확인하는 테스트예요.',
    });
    expect((await inbox('?lang=en')).data.items[0]).toMatchObject({
      title: 'OFFSIDE notification test',
      body: 'This is a test to check the notification connection on this device.',
    });
  });
  it('does not remove a newer registration after an old in-flight token is rejected', async () => {
    const a = await identity();
    const b = await identity();
    await linkGoogle(ctx, a.session.profileId, { email: 'admin@example.com' });
    ctx.env.ADMIN_EMAILS = 'admin@example.com';
    ctx.env.PUSH_TEST_ENABLED = '1';
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    let finish!: (response: Response) => void;
    const send = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', send);
    const pending = call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL });
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    await call(b.token, 'PUT', '/v1/push/device', {
      ...INPUT,
      token: 'ExpoPushToken[new_session_token]',
    });
    finish(Response.json({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }));
    expect((await pending).status).toBe(503);
    expect(await ownPushDevice(ctx.env.DB, b.session, INSTALL, new Date().toISOString())).toEqual({
      token: 'ExpoPushToken[new_session_token]',
    });
  });
  it('atomically removes a deleted profile’s tokens while preserving other profiles', async () => {
    const a = await identity();
    const b = await identity();
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    await call(b.token, 'PUT', '/v1/push/device', {
      ...INPUT,
      installationId: OTHER_INSTALL,
      token: 'ExpoPushToken[other]',
    });
    const base = {
      sessionId: a.session.id,
      sessionTokenHash: await sha256Hex(a.token),
      now: new Date().toISOString(),
    };
    const { confirmToken } = await issueDeleteConfirmToken(base);
    await executeProfileDeletion(ctx.db, { ...base, profileId: a.session.profileId, confirmToken });
    expect((await ctx.env.DB.prepare('SELECT token FROM push_devices').all()).results).toEqual([
      { token: 'ExpoPushToken[other]' },
    ]);
  });
  it('registers idempotently, rotates tokens, hashes installation identity, and keeps responses private', async () => {
    const a = await identity();
    for (const token of [INPUT.token, INPUT.token, 'ExpoPushToken[rotated]']) {
      const r = await call(a.token, 'PUT', '/v1/push/device', { ...INPUT, token });
      expect(r.status).toBe(200);
      expect(r.headers.get('Cache-Control')).toContain('no-store');
      expect(await r.json()).toMatchObject({ data: { enabled: true } });
    }
    const rows = await ctx.env.DB.prepare(
      'SELECT installation_hash, token FROM push_devices',
    ).all();
    expect(rows.results).toEqual([
      { installation_hash: await sha256Hex(INSTALL), token: 'ExpoPushToken[rotated]' },
    ]);
  });
  it('rejects a different installation claiming a registered token', async () => {
    const a = await identity();
    const b = await identity();
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    expect(
      (await call(b.token, 'PUT', '/v1/push/device', { ...INPUT, installationId: OTHER_INSTALL }))
        .status,
    ).toBe(409);
  });
  it('rebinds the same secure installation to a new session and supports removal there', async () => {
    const a = await identity();
    const b = await identity();
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    expect((await call(b.token, 'PUT', '/v1/push/device', INPUT)).status).toBe(200);
    expect(
      await ownPushDevice(ctx.env.DB, a.session, INSTALL, new Date().toISOString()),
    ).toBeNull();
    expect(await ownPushDevice(ctx.env.DB, b.session, INSTALL, new Date().toISOString())).toEqual({
      token: INPUT.token,
    });
    expect(
      (await call(b.token, 'DELETE', '/v1/push/device', { installationId: INSTALL })).status,
    ).toBe(200);
    expect(
      await ownPushDevice(ctx.env.DB, b.session, INSTALL, new Date().toISOString()),
    ).toBeNull();
  });
  it('rejects web-cookie registration and malformed or extra payload fields', async () => {
    const web = await issueCookie(ctx);
    expect(
      (await callJson(ctx.env, 'PUT', '/v1/push/device', { cookie: web.cookie, body: INPUT }))
        .status,
    ).toBe(403);
    const a = await identity();
    for (const input of [
      { ...INPUT, token: 'not-a-token' },
      { ...INPUT, installationId: 'guess' },
      { ...INPUT, profileId: 'prf_other' },
    ])
      expect((await call(a.token, 'PUT', '/v1/push/device', input)).status).toBe(400);
  });
  it('excludes revoked, expired, deleted, and stale registrations before cleanup', async () => {
    const a = await identity();
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    const now = new Date().toISOString();
    const run = (sql: string) => ctx.env.DB.prepare(sql).bind(a.session.id).run();
    await run('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?');
    expect(await ownPushDevice(ctx.env.DB, a.session, INSTALL, now)).toBeNull();
    await run(
      "UPDATE sessions SET revoked_at = NULL, expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
    );
    expect(await ownPushDevice(ctx.env.DB, a.session, INSTALL, now)).toBeNull();
    await run("UPDATE sessions SET expires_at = '2099-01-01T00:00:00.000Z' WHERE id = ?");
    await ctx.env.DB.prepare('UPDATE profiles SET deleted_at = ? WHERE id = ?')
      .bind(now, a.session.profileId)
      .run();
    expect(await ownPushDevice(ctx.env.DB, a.session, INSTALL, now)).toBeNull();
    await ctx.env.DB.prepare('UPDATE profiles SET deleted_at = NULL WHERE id = ?')
      .bind(a.session.profileId)
      .run();
    await ctx.env.DB.prepare(
      "UPDATE push_devices SET updated_at = '2000-01-01T00:00:00.000Z'",
    ).run();
    expect(await ownPushDevice(ctx.env.DB, a.session, INSTALL, now)).toBeNull();
    expect((await cleanupExpired(ctx.env.DB, Date.parse(now))).push_devices).toBe(1);
  });
  it('defaults test delivery off, including for registered non-admin users', async () => {
    const a = await identity();
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    expect((await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL })).status).toBe(
      503,
    );
  });
  it('lets an anonymous app user test only their own device and blocks a repeated request', async () => {
    const a = await identity();
    const b = await identity();
    ctx.env.PUSH_TEST_ENABLED = '1';
    await call(b.token, 'PUT', '/v1/push/device', INPUT);
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { status: 'ok', id: 'ticket' } }));
    vi.stubGlobal('fetch', send);
    expect((await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL })).status).toBe(
      404,
    );
    expect(send).not.toHaveBeenCalled();
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    const response = await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(await response.json()).toMatchObject({
      data: { accepted: true, nextTestAt: expect.any(String) },
    });
    const payload = JSON.parse(send.mock.calls[0]![1]!.body as string);
    expect(payload.to).toBe(INPUT.token);
    expect(payload.data.test).toBe(true);
    expect((await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL })).status).toBe(
      429,
    );
    expect(send).toHaveBeenCalledOnce();
    // Re-registering with a new session/profile keeps the device cooldown.
    await call(b.token, 'PUT', '/v1/push/device', INPUT);
    expect((await call(b.token, 'POST', '/v1/push/test', { installationId: INSTALL })).status).toBe(
      429,
    );
    expect(send).toHaveBeenCalledOnce();
  });
  it('blocks web sessions and arbitrary targets without sending', async () => {
    ctx.env.PUSH_TEST_ENABLED = '1';
    const web = await issueCookie(ctx);
    expect(
      (
        await callJson(ctx.env, 'POST', '/v1/push/test', {
          cookie: web.cookie,
          body: { installationId: INSTALL },
        })
      ).status,
    ).toBe(403);
    const a = await identity();
    const send = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', send);
    for (const extra of [{ token: INPUT.token }, { profileId: a.session.profileId }])
      expect(
        (await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL, ...extra }))
          .status,
      ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('allows only one of concurrent requests, including across devices of the same profile', async () => {
    const a = await identity();
    const result = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        reservePushTest(
          ctx.env.DB,
          i % 2 ? INSTALL : OTHER_INSTALL,
          a.session.profileId,
          '2026-10-05T05:00:00.000Z',
        ),
      ),
    );
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(result.filter((r) => r.status === 'rejected')).toHaveLength(7);
    const counters = await ctx.env.DB.prepare(
      "SELECT count FROM auth_attempts WHERE kind = 'PUSH_TEST'",
    ).all();
    expect(counters.results).toEqual([{ count: 1 }, { count: 1 }]);
  });
  it('limits each KST day to three requests and keeps cooldown across midnight', async () => {
    const a = await identity();
    const sendAt = (now: string) => reservePushTest(ctx.env.DB, INSTALL, a.session.profileId, now);
    await sendAt('2026-10-05T14:30:00.000Z');
    await sendAt('2026-10-05T14:40:00.000Z');
    expect(await sendAt('2026-10-05T14:55:00.000Z')).toBe('2026-10-05T15:05:00.000Z');
    await expect(sendAt('2026-10-05T14:59:00.000Z')).rejects.toMatchObject({
      details: { reason: 'PUSH_TEST_DAILY_LIMIT' },
    });
    await expect(sendAt('2026-10-05T15:01:00.000Z')).rejects.toMatchObject({
      details: { reason: 'PUSH_TEST_COOLDOWN' },
    });
    expect(await sendAt('2026-10-05T15:05:00.000Z')).toBe('2026-10-05T15:15:00.000Z');
  });
  it('keeps the daily budget across removal, token rotation and profile changes', async () => {
    const a = await identity();
    const b = await identity();
    for (const minute of ['00', '10', '20'])
      await reservePushTest(
        ctx.env.DB,
        INSTALL,
        a.session.profileId,
        `2026-10-05T05:${minute}:00.000Z`,
      );
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    await call(a.token, 'DELETE', '/v1/push/device', { installationId: INSTALL });
    await call(b.token, 'PUT', '/v1/push/device', { ...INPUT, token: 'ExpoPushToken[rotated]' });
    await expect(
      reservePushTest(ctx.env.DB, INSTALL, b.session.profileId, '2026-10-05T05:30:00.000Z'),
    ).rejects.toMatchObject({ details: { reason: 'PUSH_TEST_DAILY_LIMIT' } });
    await expect(
      reservePushTest(ctx.env.DB, OTHER_INSTALL, a.session.profileId, '2026-10-05T05:30:00.000Z'),
    ).rejects.toMatchObject({ details: { reason: 'PUSH_TEST_DAILY_LIMIT' } });
  });
  it('reserves the cooldown before an uncertain external send and does not resend', async () => {
    const a = await identity();
    ctx.env.PUSH_TEST_ENABLED = '1';
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout'));
    vi.stubGlobal('fetch', send);
    expect((await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL })).status).toBe(
      503,
    );
    expect((await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL })).status).toBe(
      429,
    );
    expect(send).toHaveBeenCalledOnce();
  });
  it('removes invalid tokens after an Expo rejection', async () => {
    const a = await identity();
    await linkGoogle(ctx, a.session.profileId, { email: 'admin@example.com' });
    ctx.env.ADMIN_EMAILS = 'admin@example.com';
    ctx.env.PUSH_TEST_ENABLED = '1';
    await call(a.token, 'PUT', '/v1/push/device', INPUT);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }),
        ),
    );
    expect((await call(a.token, 'POST', '/v1/push/test', { installationId: INSTALL })).status).toBe(
      503,
    );
    expect(
      await ownPushDevice(ctx.env.DB, a.session, INSTALL, new Date().toISOString()),
    ).toBeNull();
  });
});
