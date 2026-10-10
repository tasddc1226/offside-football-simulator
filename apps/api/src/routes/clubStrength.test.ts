import { afterEach, beforeEach, expect, it } from 'vitest';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { callJson, ADMIN_EMAIL, issueAdminCookie, issueCookie } from '../test/http.js';

let ctx: TestD1;
beforeEach(async () => {
  ctx = await createTestD1();
  ctx.env.ADMIN_EMAILS = ADMIN_EMAIL;
});
afterEach(async () => ctx.dispose());
it('public snapshot does not resolve sessions and excludes private history', async () => {
  const { DB, seen } = spyDb(ctx.env.DB);
  const res = await callJson({ ...ctx.env, DB }, 'GET', '/v1/club-strength', {
    cookie: 'ft_session=invalid',
  });
  expect(res.status).toBe(200);
  expect(Object.keys(((await res.json()) as { data: unknown }).data!)).toEqual([
    'v',
    'asOf',
    'source',
    'values',
  ]);
  expect(seen.some((s) => /\b(sessions|profiles)\b/.test(s))).toBe(false);
});
it('history is owner-only, including when other administrators exist', async () => {
  expect((await callJson(ctx.env, 'GET', '/v1/admin/club-strength')).status).toBe(401);
  const user = await issueCookie(ctx);
  expect(
    (await callJson(ctx.env, 'GET', '/v1/admin/club-strength', { cookie: user.cookie })).status,
  ).toBe(403);
  const admin = await issueAdminCookie(ctx);
  const ok = await callJson(ctx.env, 'GET', '/v1/admin/club-strength', { cookie: admin.cookie });
  expect(ok.status).toBe(200);
  expect(ok.headers.get('Cache-Control')).toBe('private, no-store');
  const other = { ...ctx.env, CLUB_STRENGTH_OWNER_EMAIL: 'another@example.com' };
  expect(
    (await callJson(other, 'GET', '/v1/admin/club-strength', { cookie: admin.cookie })).status,
  ).toBe(403);
  expect(
    (
      await callJson(
        { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL + ',another@example.com' },
        'GET',
        '/v1/admin/club-strength',
        { cookie: admin.cookie },
      )
    ).status,
  ).toBe(403);
  expect(
    (await callJson(ctx.env, 'GET', '/v1/admin/club-strength?before=bad', { cookie: admin.cookie }))
      .status,
  ).toBe(400);
});
