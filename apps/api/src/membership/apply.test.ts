import { beforeEach, afterEach, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie } from '../test/http.js';
import { applyMembership } from './apply.js';
import type { VerifiedMembership } from './types.js';
import { membershipOf } from '../db/repos/membership.js';
import { ownerItemsOf } from '../db/repos/iap.js';
let ctx: TestD1;
let id: string;
const NOW = '2026-10-12T00:00:00.000Z';
const END = '2026-11-12T00:00:00.000Z';
const member = (): VerifiedMembership => ({
  store: 'apple',
  environment: 'production',
  chainId: 'chain',
  status: 'active',
  paidUntil: END,
  graceUntil: null,
  autoRenew: true,
  verifiedAt: NOW,
  periods: [
    {
      store: 'apple',
      environment: 'production',
      chainId: 'chain',
      profileId: id,
      transactionId: 'tx1',
      startedAt: NOW,
      expiresAt: END,
      paid: true,
      refundedAt: null,
    },
  ],
});
beforeEach(async () => {
  ctx = await createTestD1();
  id = (await issueGoogleCookie(ctx)).profileId;
});
afterEach(async () => ctx.dispose());
it('restores idempotently and protects another account from receiving the chain', async () => {
  await applyMembership(ctx.db, id, member(), null);
  await applyMembership(ctx.db, id, member(), null);
  expect((await ownerItemsOf(ctx.db, id)).reroll).toBe(40);
  const other = (await issueGoogleCookie(ctx)).profileId;
  await expect(applyMembership(ctx.db, other, { ...member(), periods: [] }, null)).rejects.toThrow(
    'OTHER_ACCOUNT',
  );
  expect((await membershipOf(ctx.db, other, NOW)).active).toBe(false);
});
it('ignores older status updates, and never undoes a refund or chosen appearance', async () => {
  await applyMembership(ctx.db, id, member(), null);
  await ctx.db.$client
    .prepare("UPDATE owner_memberships SET theme='royal',supporter_title=1 WHERE profile_id=?")
    .bind(id)
    .run();
  const revoked = {
    ...member(),
    status: 'revoked' as const,
    verifiedAt: '2026-10-13T00:00:00.000Z',
    periods: member().periods.map((p) => ({ ...p, refundedAt: NOW })),
  };
  await applyMembership(ctx.db, id, revoked, null);
  await applyMembership(ctx.db, id, member(), null);
  const m = await membershipOf(ctx.db, id, NOW);
  expect(m.active).toBe(false);
  expect(m.appearance.theme).toBe('royal');
  expect(m.paidMonths).toBe(0);
  expect((await ownerItemsOf(ctx.db, id)).reroll).toBe(0);
});
it('does not lose another store entitlement when one chain expires', async () => {
  await applyMembership(ctx.db, id, member(), null);
  await applyMembership(
    ctx.db,
    id,
    {
      ...member(),
      store: 'google',
      chainId: 'second',
      periods: [],
      status: 'expired',
      paidUntil: NOW,
    },
    'encrypted',
  );
  expect((await membershipOf(ctx.db, id, NOW)).store).toBe('apple');
  expect((await membershipOf(ctx.db, id, NOW)).active).toBe(true);
});
it('cancellation keeps paid access and expiry does not remove paid bonus items', async () => {
  await applyMembership(ctx.db, id, { ...member(), autoRenew: false }, null);
  expect((await membershipOf(ctx.db, id, NOW)).active).toBe(true);
  expect((await membershipOf(ctx.db, id, END)).active).toBe(false);
  expect((await ownerItemsOf(ctx.db, id)).reroll).toBe(40);
});
