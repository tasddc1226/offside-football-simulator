import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueAdminCookie, issueGoogleCookie } from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';
import { fakeRoom } from '../test/chatRoom.js';
import { boardComments, boardPosts, profiles } from '../db/schema.js';
import { communityOwnerEmail, communityRecipients, communityStatements } from './community.js';
import { runPersonalPush } from './personal.js';
import { queueNotification } from '../db/repos/notifications.js';

let ctx: TestD1;
let owner: Awaited<ReturnType<typeof issueAdminCookie>>;
let user: Awaited<ReturnType<typeof issueGoogleCookie>>;
let postId: string;
beforeEach(async () => {
  ctx = await createTestD1();
  ctx.env.ADMIN_EMAILS = ADMIN_EMAIL;
  ctx.env.ADMIN_COMMUNITY_PUSH_ENABLED = '1';
  owner = await issueAdminCookie(ctx);
  user = await issueGoogleCookie(ctx, { nickname: 'Reader' });
  const r = await callJson(ctx.env, 'POST', '/v1/boards/notice/posts', {
    cookie: owner.cookie,
    body: { title: 'Test notice', body: 'Notice body' },
  });
  expect(r.status).toBe(201);
  postId = ((await r.json()) as { data: { id: string } }).data.id;
  await addAppPushDevice(ctx, owner.profileId);
  await addAppPushDevice(ctx, user.profileId);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await ctx.dispose();
});
const rows = async (table: string) =>
  (await ctx.env.DB.prepare(`SELECT * FROM ${table}`).all()).results;
async function comment(cookie = user.cookie) {
  const res = await callJson(ctx.env, 'POST', `/v1/boards/posts/${postId}/comments`, {
    cookie,
    body: { body: 'A new comment' },
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { data: { id: string } }).data.id;
}
function lounge() {
  return fakeRoom(ctx.env);
}
async function sendChat(fake: ReturnType<typeof lounge>, body = 'A lounge message', admin = false) {
  const ws = await fake.join(
    fake.room.issueTicket({
      profileId: admin ? owner.profileId : user.profileId,
      author: 'hash',
      nickname: admin ? 'Admin' : 'Reader',
      admin,
    }),
  );
  fake.room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: 'send', body }));
  await fake.drain();
}
const expo = () =>
  vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    Response.json({
      data: Array.from({ length: 20 }, (_, i) => ({ status: 'ok', id: `ticket_${i}` })),
    }),
  );
const night = () => Date.parse(`${new Date().toISOString().slice(0, 10)}T14:00:00.000Z`); // KST 23:00
function enable() {
  ctx.env.ENVIRONMENT = 'production';
  ctx.env.PERSONAL_PUSH_ENABLED = '1';
}

describe('admin community push', () => {
  it('queues a user comment for the one verified owner, with the exact board destination; skips admin replies', async () => {
    const id = await comment();
    await comment(owner.cookie);
    expect(await rows('notifications')).toMatchObject([
      {
        profile_id: owner.profileId,
        source_key: `admin-community-comment:${id}`,
        kind: 'community',
        target_json: JSON.stringify({ type: 'board', board: 'notice', postId }),
        body: 'Reader: A new comment',
      },
    ]);
    expect(await rows('push_deliveries')).toMatchObject([{ profile_id: owner.profileId }]);
  });

  it('routes release-note comments to that release post and stays off until explicitly enabled', async () => {
    ctx.env.ADMIN_COMMUNITY_PUSH_ENABLED = '0';
    await comment();
    expect(await rows('notifications')).toHaveLength(0);
    ctx.env.ADMIN_COMMUNITY_PUSH_ENABLED = '1';
    await ctx.db.update(boardPosts).set({ board: 'release' }).where(eq(boardPosts.id, postId));
    await comment();
    expect(await rows('notifications')).toMatchObject([
      {
        target_json: JSON.stringify({ type: 'board', board: 'release', postId }),
      },
    ]);
  });

  it('fails closed for multiple admins until a single admin recipient is configured, and rejects a spoofed email', async () => {
    ctx.env.ADMIN_EMAILS = `${ADMIN_EMAIL},second@example.com`;
    expect(communityOwnerEmail(ctx.env)).toBeNull();
    await comment();
    expect(await rows('notifications')).toHaveLength(0);
    ctx.env.ADMIN_COMMUNITY_PUSH_EMAIL = 'second@example.com';
    expect(await communityRecipients(ctx.env)).toEqual([]);
    ctx.env.ADMIN_COMMUNITY_PUSH_EMAIL = ` ${ADMIN_EMAIL.toUpperCase()} `;
    expect(await communityRecipients(ctx.env)).toEqual([owner.profileId]);
    ctx.env.ADMIN_COMMUNITY_PUSH_EMAIL = 'attacker@example.com';
    expect(await communityRecipients(ctx.env)).toEqual([]);
    ctx.env.ADMIN_COMMUNITY_PUSH_EMAIL = ADMIN_EMAIL;
    await ctx.db.update(profiles).set({ googleSub: null }).where(eq(profiles.id, owner.profileId));
    expect(await communityRecipients(ctx.env)).toEqual([]);
  });

  it('comment storage and notification queue roll back together on a failed batch', async () => {
    // A real SQL error inside a D1 batch, rather than a mock of transactional behavior.
    await ctx.env.DB.exec(
      "CREATE TRIGGER fail_community BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
    );
    const r = await callJson(ctx.env, 'POST', `/v1/boards/posts/${postId}/comments`, {
      cookie: user.cookie,
      body: { body: 'Must roll back' },
    });
    expect(r.status).toBe(503);
    expect(await rows('board_comments')).toHaveLength(0);
    expect(await rows('push_deliveries')).toHaveLength(0);
  });

  it('persists chat before alarm delivery, retries ambiguous D1 completion without duplicates, and skips admin/hidden messages', async () => {
    const original = ctx.env.DB;
    let loseAcknowledgement = true;
    const flaky = new Proxy(original, {
      get(target, key) {
        if (key === 'batch')
          return async (stmts: D1PreparedStatement[]) => {
            const result = await target.batch(stmts);
            if (loseAcknowledgement) {
              loseAcknowledgement = false;
              throw new Error('lost acknowledgement');
            }
            return result;
          };
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const fake = fakeRoom({ ...ctx.env, DB: flaky });
    await sendChat(fake);
    expect(await rows('notifications')).toHaveLength(0);
    await expect(fake.room.alarm()).rejects.toThrow('lost acknowledgement');
    // Recreate the object with the same SQLite storage, as after hibernation/restart.
    await fake.restart().alarm();
    await fake.room.alarm();
    expect(await rows('notifications')).toMatchObject([
      {
        kind: 'community',
        profile_id: owner.profileId,
        target_json: JSON.stringify({ type: 'screen', screen: 'chat' }),
      },
    ]);
    expect(await rows('push_deliveries')).toHaveLength(1);
    await sendChat(fake, 'Admin response', true);
    await sendChat(fake, 'Hide before dispatch');
    const last = fake.sockets.at(-1)!.sent.at(-1) as { m: { id: string } };
    fake.room.hide(last.m.id);
    await fake.room.alarm();
    expect(await rows('notifications')).toHaveLength(1);
  });

  it('does not queue rejected chat writes', async () => {
    const fake = lounge();
    await sendChat(fake, '');
    await fake.room.alarm();
    expect(await rows('notifications')).toHaveLength(0);
  });

  it('delivers every admin event at night without consuming personal notification budget; regular events wait', async () => {
    await comment();
    await comment();
    await comment();
    await queueNotification(ctx.env.DB, {
      profileId: owner.profileId,
      sourceKey: 'ordinary-event',
      now: new Date().toISOString(),
      push: true,
      content: {
        kind: 'team',
        title: 'Normal event',
        body: 'Wait for daytime',
        target: { type: 'screen', screen: 'team' },
      },
    });
    enable();
    const transport = expo();
    await runPersonalPush(ctx.env, night(), transport);
    expect(transport).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(transport.mock.calls[0]![1]!.body as string) as {
      data: { kind: string };
    }[];
    expect(payload).toHaveLength(3);
    expect(payload.every((m) => m.data.kind === 'community')).toBe(true);
    const ns = await rows('notifications');
    expect(ns.every((n) => n.push_reserved_at === null)).toBe(true);
    expect((await rows('push_deliveries')).filter((r) => r.state === 'accepted')).toHaveLength(3);
    expect((await rows('push_deliveries')).filter((r) => r.state === 'pending')).toHaveLength(1);
  });

  it('cancels a deleted comment and rechecks owner identity before sending', async () => {
    const id = await comment();
    await ctx.db
      .update(boardComments)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(boardComments.id, id));
    enable();
    const transport = expo();
    await runPersonalPush(ctx.env, night(), transport);
    expect(transport).not.toHaveBeenCalled();
    expect(await rows('push_deliveries')).toMatchObject([{ state: 'cancelled' }]);
    const fake = lounge();
    await sendChat(fake);
    await fake.room.alarm();
    await ctx.db
      .update(profiles)
      .set({ email: 'no-longer-admin@example.com' })
      .where(eq(profiles.id, owner.profileId));
    await runPersonalPush(ctx.env, night(), transport);
    expect(transport).not.toHaveBeenCalled();
    expect((await rows('push_deliveries')).every((r) => r.state === 'cancelled')).toBe(true);
  });

  it('cancels queued alerts when disabled, even if the profile email has become empty', async () => {
    await comment();
    ctx.env.ADMIN_COMMUNITY_PUSH_ENABLED = '0';
    await ctx.db.update(profiles).set({ email: '' }).where(eq(profiles.id, owner.profileId));
    enable();
    const transport = expo();
    await runPersonalPush(ctx.env, night(), transport);
    expect(transport).not.toHaveBeenCalled();
    expect(await rows('push_deliveries')).toMatchObject([{ state: 'cancelled' }]);
  });

  it('does not target the author even with an old non-admin chat ticket; no registered device means no queue', async () => {
    expect(
      communityStatements(ctx.env, [owner.profileId], {
        type: 'chat',
        id: crypto.randomUUID(),
        profileId: owner.profileId,
        nickname: 'Self',
        body: 'Self',
        admin: false,
        now: new Date().toISOString(),
      }),
    ).toEqual([]);
    await ctx.env.DB.prepare('DELETE FROM push_devices WHERE profile_id = ?')
      .bind(owner.profileId)
      .run();
    await comment();
    expect(await rows('notifications')).toHaveLength(0);
  });
});
