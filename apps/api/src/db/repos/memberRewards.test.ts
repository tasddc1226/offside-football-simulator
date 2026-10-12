import { afterEach, beforeEach, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { issueGoogleCookie } from '../../test/http.js';
import { recordMemberPeriod, type VerifiedMemberPeriod } from './memberRewards.js';
import { ownerItemsOf, spendItem, grantIapPurchase, revokeIapPurchase } from './iap.js';
import { shopSnapshot } from './itemShop.js';
import { MEMBERSHIP_BONUS } from '@offside/contracts/membership';

let ctx: TestD1;
let p: VerifiedMemberPeriod;
const NOW = '2026-10-12T00:00:00.000Z';
beforeEach(async () => {
  ctx = await createTestD1();
  const { profileId } = await issueGoogleCookie(ctx);
  p = {
    store: 'apple',
    environment: 'production',
    transactionId: 'month-1',
    chainId: 'chain-1',
    profileId,
    startedAt: NOW,
    expiresAt: '2026-11-12T00:00:00.000Z',
    paid: true,
    refundedAt: null,
  };
});
afterEach(async () => ctx.dispose());

it('grants once per paid renewal and rejects another account replay', async () => {
  expect(await recordMemberPeriod(ctx.db, p, NOW)).toBe(true);
  await recordMemberPeriod(ctx.db, p, NOW);
  expect(await ownerItemsOf(ctx.db, p.profileId)).toEqual(MEMBERSHIP_BONUS);
  const other = await issueGoogleCookie(ctx);
  expect(await recordMemberPeriod(ctx.db, { ...p, profileId: other.profileId }, NOW)).toBe(false);
  expect(await ownerItemsOf(ctx.db, other.profileId)).toEqual({ reroll: 0, scout: 0, boost: 0 });
  await recordMemberPeriod(
    ctx.db,
    {
      ...p,
      transactionId: 'month-2',
      startedAt: p.expiresAt,
      expiresAt: '2026-12-12T00:00:00.000Z',
    },
    p.expiresAt,
  );
  expect(await ownerItemsOf(ctx.db, p.profileId)).toEqual({ reroll: 80, scout: 10, boost: 20 });
});

it('spends from the refundable lot and refunds only its remaining items', async () => {
  await ctx.db.$client
    .prepare('INSERT INTO owner_items (profile_id, item, qty, updated_at) VALUES (?, ?, ?, ?)')
    .bind(p.profileId, 'reroll', 7, NOW)
    .run();
  await recordMemberPeriod(ctx.db, p, NOW);
  expect((await shopSnapshot(ctx.db, p.profileId, NOW)).reroll).toBe(47);
  expect((await spendItem(ctx.db, p.profileId, 'reroll', NOW))?.reroll).toBe(46);
  await recordMemberPeriod(ctx.db, { ...p, refundedAt: NOW }, NOW);
  await recordMemberPeriod(ctx.db, p, NOW); // stale notification cannot regrant
  expect(await ownerItemsOf(ctx.db, p.profileId)).toEqual({ reroll: 7, scout: 0, boost: 0 });
  expect((await spendItem(ctx.db, p.profileId, 'reroll', NOW))?.reroll).toBe(6);
  expect(await spendItem(ctx.db, p.profileId, 'scout', NOW)).toBeNull();
});

it('does not grant unpaid, future or already-refunded periods', async () => {
  await recordMemberPeriod(ctx.db, { ...p, paid: false }, NOW);
  await recordMemberPeriod(
    ctx.db,
    { ...p, transactionId: 'future', startedAt: '2026-10-13T00:00:00.000Z' },
    NOW,
  );
  await recordMemberPeriod(ctx.db, { ...p, transactionId: 'refunded', refundedAt: NOW }, NOW);
  expect(await ownerItemsOf(ctx.db, p.profileId)).toEqual({ reroll: 0, scout: 0, boost: 0 });
  await recordMemberPeriod(
    ctx.db,
    { ...p, transactionId: 'future', startedAt: '2026-10-13T00:00:00.000Z' },
    '2026-10-13T00:00:00.000Z',
  );
  expect(await ownerItemsOf(ctx.db, p.profileId)).toEqual(MEMBERSHIP_BONUS);
});

it('keeps existing consumable purchase/refund independent of membership lots', async () => {
  await recordMemberPeriod(ctx.db, p, NOW);
  expect(
    (
      await grantIapPurchase(ctx.db, {
        store: 'apple',
        transactionId: 'pack',
        profileId: p.profileId,
        productId: 'pack',
        item: 'scout',
        qty: 2,
        test: false,
        now: NOW,
      })
    )?.scout,
  ).toBe(7);
  await revokeIapPurchase(ctx.db, 'apple', 'pack', NOW);
  expect((await ownerItemsOf(ctx.db, p.profileId)).scout).toBe(5);
});
