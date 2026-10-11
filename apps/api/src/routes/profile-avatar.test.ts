import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  issueCookie,
  issueGoogleCookie,
  issueAdminCookie,
  callJson,
  ADMIN_EMAIL,
  putJson,
  deleteProfile,
} from '../test/http.js';
import { profileAvatars, profiles } from '../db/schema.js';
import { validateAvatarImage } from '../profile/avatar.js';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9V8AAAAASUVORK5CYII=';

describe('owner avatar', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    delete ctx.env.CHAT;
  });
  afterEach(async () => {
    await ctx.dispose();
  });
  it('uploads a bounded raster, returns an opaque public image, replaces and restores default', async () => {
    const { cookie, profileId } = await issueGoogleCookie(ctx);
    const app = createApp();
    const upload = await putJson(ctx, cookie, '/v1/profile/avatar', { image: PNG });
    expect(upload.status).toBe(200);
    const { data } = (await upload.json()) as { data: { avatarId: string } };
    expect(data.avatarId).not.toContain(profileId);
    const image = await app.request(`/v1/avatars/${data.avatarId}`, {}, ctx.env);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('set-cookie')).toBeNull();
    expect(new Uint8Array(await image.arrayBuffer())[0]).toBe(137);
    const next = await putJson(ctx, cookie, '/v1/profile/avatar', { image: PNG });
    expect(next.status).toBe(200);
    expect((await app.request(`/v1/avatars/${data.avatarId}`, {}, ctx.env)).status).toBe(404);
    const reset = await putJson(ctx, cookie, '/v1/profile/avatar', { image: null });
    expect(((await reset.json()) as { data: { avatarId: null } }).data.avatarId).toBeNull();
    expect(await ctx.db.select().from(profileAvatars)).toHaveLength(0);
    const [me] = await ctx.db.select().from(profiles).where(eq(profiles.id, profileId));
    expect(me?.avatarId).toBeNull();
  });
  it('rejects anonymous uploads, spoofed bytes, SVG and oversized dimensions', async () => {
    const guest = await issueCookie(ctx);
    expect((await putJson(ctx, guest.cookie, '/v1/profile/avatar', { image: PNG })).status).toBe(
      403,
    );
    const { cookie } = await issueGoogleCookie(ctx);
    for (const image of [
      'data:image/png;base64,aGVsbG8=',
      'data:image/svg+xml;base64,PHN2Zz4=',
      PNG.repeat(500),
    ])
      expect((await putJson(ctx, cookie, '/v1/profile/avatar', { image })).status).toBe(400);
    const b = Uint8Array.from(atob(PNG.split(',')[1]!), (c) => c.charCodeAt(0));
    new DataView(b.buffer).setUint32(16, 10000);
    expect(() =>
      validateAvatarImage(`data:image/png;base64,${btoa(String.fromCharCode(...b))}`),
    ).toThrow();
  });
  it('existing comments reflect the current image and default restoration through their author join', async () => {
    const admin = await issueAdminCookie(ctx);
    const author = await issueGoogleCookie(ctx, { nickname: 'avatar-owner' });
    const env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
    const post = await callJson(env, 'POST', '/v1/boards/notice/posts', {
      cookie: admin.cookie,
      body: { title: 'image', body: 'test' },
    });
    const postId = ((await post.json()) as { data: { id: string } }).data.id;
    const comment = await callJson(env, 'POST', `/v1/boards/posts/${postId}/comments`, {
      cookie: author.cookie,
      body: { body: 'hello' },
    });
    expect(comment.status).toBe(201);
    const uploaded = await putJson(ctx, author.cookie, '/v1/profile/avatar', { image: PNG });
    const avatarId = ((await uploaded.json()) as { data: { avatarId: string } }).data.avatarId;
    const detail = () => callJson(env, 'GET', `/v1/boards/posts/${postId}`);
    expect(
      ((await (await detail()).json()) as { data: { comments: { avatarId: string | null }[] } })
        .data.comments[0]?.avatarId,
    ).toBe(avatarId);
    await putJson(ctx, author.cookie, '/v1/profile/avatar', { image: null });
    expect(
      ((await (await detail()).json()) as { data: { comments: { avatarId: string | null }[] } })
        .data.comments[0]?.avatarId,
    ).toBeNull();
  });
  it('account deletion removes image storage and public access', async () => {
    const { cookie } = await issueGoogleCookie(ctx);
    const upload = await putJson(ctx, cookie, '/v1/profile/avatar', { image: PNG });
    const { data } = (await upload.json()) as { data: { avatarId: string } };
    expect((await deleteProfile(ctx.env, cookie, 'avatar-delete')).status).toBe(204);
    expect(await ctx.db.select().from(profileAvatars)).toHaveLength(0);
    expect((await createApp().request(`/v1/avatars/${data.avatarId}`, {}, ctx.env)).status).toBe(
      404,
    );
  });
});
