import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
import { claimMembership } from '../membership/service.js';
import { MemberVerificationError } from '../membership/types.js';
import { MEMBERSHIP_PRODUCT } from '@offside/contracts/membership';
vi.mock('../membership/service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../membership/service.js')>()),
  claimMembership: vi.fn(),
}));
let ctx: TestD1;
beforeEach(async () => {
  ctx = await createTestD1();
  vi.mocked(claimMembership).mockReset();
});
afterEach(async () => ctx.dispose());
it('keeps sales closed and private state uncacheable by default', async () => {
  const { cookie } = await issueGoogleCookie(ctx);
  const r = await callJson(ctx.env, 'GET', '/v1/membership', { cookie });
  const b = (await r.json()) as {
    data: { stores: string[]; membership: { active: boolean; salesEnabled: boolean } };
  };
  expect(r.status).toBe(200);
  expect(r.headers.get('cache-control')).toContain('no-store');
  expect(b.data.stores).toEqual([]);
  expect(b.data.membership.active).toBe(false);
  expect(b.data.membership.salesEnabled).toBe(false);
});
it('rejects inactive cosmetics and wrong-account receipts', async () => {
  const { cookie } = await issueGoogleCookie(ctx);
  expect(
    (
      await callJson(ctx.env, 'PUT', '/v1/membership/appearance', {
        cookie,
        body: { theme: 'royal', frame: 'brass' },
      })
    ).status,
  ).toBe(409);
  vi.mocked(claimMembership).mockRejectedValue(new MemberVerificationError('OTHER_ACCOUNT'));
  const r = await callJson(ctx.env, 'POST', '/v1/membership/claim', {
    cookie,
    body: { store: 'apple', productId: MEMBERSHIP_PRODUCT, token: 'fake' },
  });
  expect(r.status).toBe(409);
});
it('does not expose receipt data in an upstream failure', async () => {
  const { cookie } = await issueGoogleCookie(ctx);
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(claimMembership).mockRejectedValue(new Error('https://upstream/PRIVATE_TOKEN'));
  const r = await callJson(ctx.env, 'POST', '/v1/membership/claim', {
    cookie,
    body: { store: 'google', productId: MEMBERSHIP_PRODUCT, token: 'PRIVATE_TOKEN' },
  });
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain('PRIVATE_TOKEN');
  expect(JSON.stringify(spy.mock.calls)).not.toContain('PRIVATE_TOKEN');
  spy.mockRestore();
});
