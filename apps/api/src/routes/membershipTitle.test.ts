import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { OwnerTitlesResponseSchema, successEnvelope } from '@offside/contracts';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
import { ownerMemberships, membershipPeriods, profiles } from '../db/schema.js';
import { membershipOf } from '../db/repos/membership.js';
import { getProfile } from '../db/repos/profiles.js';

let ctx: TestD1;
const NOW = '2026-10-12T00:00:00.000Z';
const END = '2026-11-01T00:00:00.000Z';
beforeEach(async () => {
  ctx = await createTestD1();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});
afterEach(async () => {
  vi.useRealTimers();
  await ctx.dispose();
});

it('selects subscription identity without overwriting an earned title and expires on read', async () => {
  const who = await issueGoogleCookie(ctx, { nickname: 'Supporter' });
  await ctx.db
    .update(profiles)
    .set({ title: 'owner-founder', titlePinned: 1 })
    .where(eq(profiles.id, who.profileId));
  await ctx.db.insert(ownerMemberships).values({
    profileId: who.profileId,
    store: 'local',
    environment: 'local',
    chainId: who.profileId,
    status: 'active',
    paidUntil: END,
    verifiedAt: NOW,
    autoRenew: false,
  });
  await ctx.db.insert(membershipPeriods).values(
    Array.from({ length: 3 }, (_, i) => ({
      store: 'local',
      environment: 'local',
      transactionId: `period-${i}`,
      chainId: who.profileId,
      profileId: who.profileId,
      startedAt: `2026-0${7 + i}-01T00:00:00.000Z`,
      expiresAt: END,
      paid: true,
      benefitVersion: 1,
    })),
  );
  const hall = successEnvelope(OwnerTitlesResponseSchema).parse(
    await (await callJson(ctx.env, 'GET', '/v1/owner/title', { cookie: who.cookie })).json(),
  );
  expect(hall.data.membership?.badge).toBe('silver');
  expect(hall.data.permanent.some((p) => String(p.id).startsWith('member-'))).toBe(false);
  expect(
    (
      await callJson(ctx.env, 'PUT', '/v1/owner/title', {
        cookie: who.cookie,
        body: { title: 'member-platinum' },
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await callJson(ctx.env, 'PUT', '/v1/owner/title', {
        cookie: who.cookie,
        body: { title: 'member-silver' },
      })
    ).status,
  ).toBe(200);
  expect((await getProfile(ctx.db, who.profileId, true))?.title).toBe('member-silver');
  const [stored] = await ctx.db.select().from(profiles).where(eq(profiles.id, who.profileId));
  expect(stored?.title).toBe('owner-founder');
  vi.setSystemTime(new Date(END));
  expect((await getProfile(ctx.db, who.profileId, true))?.title).toBe('owner-founder');
  expect((await membershipOf(ctx.db, who.profileId, END)).badge).toBeNull();
  expect(
    (
      await callJson(ctx.env, 'PUT', '/v1/owner/title', {
        cookie: who.cookie,
        body: { title: 'member-silver' },
      })
    ).status,
  ).toBe(409);
});

it('excludes trials, refunds, future renewals and other environments from paid tenure', async () => {
  const who = await issueGoogleCookie(ctx, { nickname: 'Member' });
  await ctx.db.insert(ownerMemberships).values({
    profileId: who.profileId,
    store: 'local',
    environment: 'local',
    chainId: who.profileId,
    status: 'active',
    paidUntil: END,
    verifiedAt: NOW,
    supporterTitle: true,
  });
  const period = {
    store: 'local',
    environment: 'local',
    chainId: who.profileId,
    profileId: who.profileId,
    startedAt: '2026-09-01T00:00:00.000Z',
    expiresAt: END,
    paid: true,
    benefitVersion: 1,
  };
  await ctx.db.insert(membershipPeriods).values([
    { ...period, transactionId: 'paid' },
    { ...period, transactionId: 'trial', paid: false },
    { ...period, transactionId: 'refund', refundedAt: NOW },
    { ...period, transactionId: 'future', startedAt: END },
    { ...period, transactionId: 'sandbox', environment: 'sandbox' },
  ]);
  expect((await membershipOf(ctx.db, who.profileId, NOW)).paidMonths).toBe(1);
  expect((await getProfile(ctx.db, who.profileId, true))?.title).toBe('member-bronze');
  await ctx.db
    .update(ownerMemberships)
    .set({ status: 'revoked' })
    .where(eq(ownerMemberships.profileId, who.profileId));
  expect((await getProfile(ctx.db, who.profileId, true))?.title).toBeNull();
});
