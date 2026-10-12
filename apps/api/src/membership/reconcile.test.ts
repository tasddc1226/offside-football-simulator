import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie } from '../test/http.js';
import { applyMembership } from './apply.js';
import { reconcileMemberships } from './reconcile.js';
import { refreshMembershipChain } from './service.js';
vi.mock('./service.js', () => ({ refreshMembershipChain: vi.fn() }));
let ctx: TestD1;
const NOW = Date.parse('2026-10-12T12:00:00.000Z');
beforeEach(async () => {
  ctx = await createTestD1();
  vi.mocked(refreshMembershipChain).mockReset();
  const { profileId } = await issueGoogleCookie(ctx);
  await applyMembership(
    ctx.db,
    profileId,
    {
      store: 'apple',
      environment: 'production',
      chainId: 'chain',
      status: 'active',
      paidUntil: '2026-11-12T00:00:00.000Z',
      graceUntil: null,
      autoRenew: true,
      verifiedAt: '2026-10-11T00:00:00.000Z',
      periods: [],
    },
    null,
  );
});
afterEach(async () => ctx.dispose());
it('is disabled by default independently of sales', async () => {
  expect(await reconcileMemberships(ctx.env, NOW)).toEqual({ checked: 0, failed: 0 });
  expect(refreshMembershipChain).not.toHaveBeenCalled();
});
it('backs off failures, retries later, and clears the repair record after success', async () => {
  ctx.env.MEMBERSHIP_RECONCILE_ENABLED = '1';
  vi.mocked(refreshMembershipChain).mockRejectedValueOnce(new Error('SECRET'));
  expect(await reconcileMemberships(ctx.env, NOW)).toEqual({ checked: 0, failed: 1 });
  expect(await reconcileMemberships(ctx.env, NOW + 60_000)).toEqual({ checked: 0, failed: 0 });
  expect(await reconcileMemberships(ctx.env, NOW + 300_000)).toEqual({ checked: 1, failed: 0 });
  expect(await ctx.db.$client.prepare('SELECT id FROM membership_events').first()).toBeNull();
});
