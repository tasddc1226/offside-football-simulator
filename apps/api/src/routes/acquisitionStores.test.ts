import { ACQUISITION_CONSENT_VERSION } from '@offside/contracts/acquisition';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquisitionReport } from '../db/repos/acquisition.js';
import { grantIapPurchase, revokeIapPurchase } from '../db/repos/iap.js';
import { recordAdFreePurchase } from '../db/repos/adFreePurchases.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie } from '../test/http.js';

const start = '2026-10-20T00:00:00.000Z';
const now = '2026-10-21T00:00:00.000Z';
const end = '2026-10-22T00:00:00.000Z';
const firstCampaign = '?utm_source=meta&utm_content=jp_a';
const lastCampaign = '?utm_source=meta&utm_content=us_b';

describe('acquisition all-store totals and independent store breakdown', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('preserves the empty total and does not fabricate per-store zero values', async () => {
    const report = await acquisitionReport(ctx.env.DB, start, end, 'last');
    expect(report.purchases).toEqual([]);
    expect(report.refunds).toEqual([]);
    expect(report.coverage).toEqual([{ sandbox_transactions: 0 }]);
    expect(report.unattributedReasons).toEqual([]);
    expect(report.byStore).toEqual({
      purchases: [],
      refunds: [],
      coverage: [],
      unattributedReasons: [],
    });
  });

  it('does not promote a first web purchase when an older unknown-price app purchase exists', async () => {
    const { profileId } = await issueGoogleCookie(ctx);
    const purchase = {
      store: 'apple' as const,
      transactionId: 'old-app',
      profileId,
      productId: 'com.offsidelab.app.reroll_5',
      item: 'reroll' as const,
      qty: 5,
      test: false,
      now: '2026-10-19T00:00:00.000Z',
      metadata: { purchasedAt: null, priceMilliunits: null, currency: null, storefront: null },
    };
    await grantIapPurchase(ctx.db, purchase);
    for (const store of ['apple', 'xsolla'] as const)
      await grantIapPurchase(ctx.db, {
        ...purchase,
        store,
        transactionId: 'new',
        now,
        metadata: {
          ...purchase.metadata,
          purchasedAt: now,
          priceMilliunits: 1000,
          currency: 'KRW',
        },
      });
    const report = await acquisitionReport(ctx.env.DB, start, end, 'last');
    expect(report.purchases).toEqual([
      expect.objectContaining({
        transactions: 2,
        unique_payers: 1,
        new_payers: 0,
        repeat_transactions: 2,
      }),
    ]);
    expect(report.byStore.purchases).toHaveLength(2);
    for (const row of report.byStore.purchases)
      expect(row).toMatchObject({ new_payers: 0, repeat_transactions: 1 });
    expect(report.unattributedReasons).toEqual([
      { reason: 'no_consent', transactions: 2, purchasers: 1, purchasers_with_campaign_session: 0 },
    ]);
    expect(report.byStore.unattributedReasons).toHaveLength(2);
    for (const row of report.byStore.unattributedReasons)
      expect(row).toMatchObject({ reason: 'no_consent', transactions: 1, purchasers: 1 });
  });

  it.each(['first', 'last'] as const)(
    'keeps %s attribution, currencies, global payers, refunds and unknown values',
    async (model) => {
      const { profileId } = await issueGoogleCookie(ctx);
      await ctx.env.DB.prepare(
        'INSERT INTO acquisition_consents(profile_id,version,granted_at,revision) VALUES (?,?,?,?)',
      )
        .bind(profileId, ACQUISITION_CONSENT_VERSION, start, 'fixture-revision')
        .run();
      const first = 'store-first',
        last = 'store-last';
      for (const [id, campaign] of [
        [first, firstCampaign],
        [last, lastCampaign],
      ]) {
        await ctx.env.DB.prepare(
          `INSERT INTO acquisition_sessions(id,profile_id,campaign,received_at,linked_at)
        VALUES (?,?,?,?,?)`,
        )
          .bind(id, profileId, campaign, start, start)
          .run();
      }
      const purchase = {
        store: 'apple' as const,
        transactionId: 'app',
        profileId,
        productId: 'com.offsidelab.app.reroll_5',
        item: 'reroll' as const,
        qty: 5,
        test: false,
        now,
        metadata: { purchasedAt: now, priceMilliunits: 1000, currency: 'KRW', storefront: null },
      };
      await grantIapPurchase(ctx.db, purchase);
      await grantIapPurchase(ctx.db, {
        ...purchase,
        store: 'xsolla',
        transactionId: 'web',
        now: '2026-10-21T01:00:00.000Z',
        metadata: {
          ...purchase.metadata,
          purchasedAt: '2026-10-21T01:00:00.000Z',
          priceMilliunits: 2000,
        },
      });
      await grantIapPurchase(ctx.db, {
        ...purchase,
        store: 'xsolla',
        transactionId: 'free',
        metadata: { ...purchase.metadata, priceMilliunits: 0 },
      });
      await grantIapPurchase(ctx.db, {
        ...purchase,
        store: 'google',
        transactionId: 'unknown-usd',
        metadata: {
          ...purchase.metadata,
          priceMilliunits: null,
          currency: 'USD',
          purchasedAt: null,
        },
      });
      await grantIapPurchase(ctx.db, {
        ...purchase,
        transactionId: 'future-store',
        metadata: { ...purchase.metadata, priceMilliunits: null, currency: null },
      });
      // Preserve unknown stores verbatim, rather than silently treating them as app revenue.
      await ctx.env.DB.prepare(
        "UPDATE iap_purchases SET store='future' WHERE transaction_id='future-store'",
      ).run();
      await ctx.env.DB.prepare('UPDATE iap_purchases SET first_touch_id=?,last_touch_id=?')
        .bind(first, last)
        .run();
      for (const store of ['apple', 'xsolla'] as const) {
        await grantIapPurchase(ctx.db, {
          ...purchase,
          store,
          transactionId: 'sandbox',
          test: true,
        });
        await revokeIapPurchase(ctx.db, store, 'sandbox', now);
      }
      // Unknown-account legacy restore is idempotent and remains unattributed.
      const ad = {
        store: 'apple' as const,
        transactionId: 'legacy-restore',
        profileId: null,
        consentProfileId: profileId,
        test: false,
        now,
        metadata: { purchasedAt: now, priceMilliunits: null, currency: null, storefront: null },
      };
      await recordAdFreePurchase(ctx.env.DB, ad);
      await recordAdFreePurchase(ctx.env.DB, ad);
      await revokeIapPurchase(ctx.db, 'xsolla', 'web', end); // excluded at the refund end boundary
      await ctx.env.DB.prepare('UPDATE iap_ad_free_purchases SET refunded_at=?').bind(now).run();
      await ctx.env.DB.prepare(
        "UPDATE iap_purchases SET refunded_at=? WHERE transaction_id='unknown-usd'",
      )
        .bind(now)
        .run();
      const spy = spyDb(ctx.env.DB);
      const report = await acquisitionReport(spy.DB, start, end, model);
      expect(spy.trips.n).toBe(1);
      expect(spy.seen).toHaveLength(5);
      const campaign = model === 'first' ? firstCampaign : lastCampaign;
      const krw = report.purchases.find((r) => r.currency === 'KRW')!;
      expect(krw).toMatchObject({
        campaign,
        transactions: 3,
        unique_purchasers: 1,
        unique_payers: 1,
        new_payers: 1,
        repeat_transactions: 2,
        gross_milliunits: 3000,
        priced_transactions: 3,
        unknown_price_transactions: 0,
        zero_price_transactions: 1,
      });
      const stores = report.byStore.purchases.filter((r) => r.currency === 'KRW');
      expect(stores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            store: 'apple',
            campaign,
            transactions: 1,
            new_payers: 1,
            gross_milliunits: 1000,
          }),
          expect.objectContaining({
            store: 'xsolla',
            campaign,
            transactions: 2,
            new_payers: 0,
            repeat_transactions: 2,
            gross_milliunits: 2000,
            zero_price_transactions: 1,
          }),
        ]),
      );
      expect(stores.reduce((n, r) => n + r.transactions, 0)).toBe(krw.transactions);
      // Distinct users are not additive: same payer used both stores.
      expect(stores.reduce((n, r) => n + r.unique_payers, 0)).toBe(2);
      expect(report.byStore.purchases.find((r) => r.store === 'google')).toMatchObject({
        campaign,
        currency: 'USD',
        gross_milliunits: null,
        unknown_price_transactions: 1,
        unique_payers: 0,
        missing_purchase_time: 1,
      });
      expect(report.byStore.purchases.find((r) => r.store === 'future')).toMatchObject({
        currency: null,
        gross_milliunits: null,
        unknown_price_transactions: 1,
      });
      expect(report.byStore.purchases.find((r) => r.campaign === 'unattributed')).toMatchObject({
        store: 'apple',
        transactions: 1,
        unknown_account_transactions: 1,
        gross_milliunits: null,
      });
      expect(report.coverage).toEqual([{ sandbox_transactions: 2 }]);
      expect(report.byStore.coverage).toEqual([
        { store: 'apple', sandbox_transactions: 1 },
        { store: 'xsolla', sandbox_transactions: 1 },
      ]);
      expect(report.refunds).toHaveLength(2);
      expect(report.byStore.refunds).toEqual(
        expect.arrayContaining([
          {
            store: 'apple',
            campaign: 'unattributed',
            currency: null,
            refunds: 1,
            purchase_value_of_refunded_transactions_milliunits: null,
            priced_refunds: 0,
          },
          {
            store: 'google',
            campaign,
            currency: 'USD',
            refunds: 1,
            purchase_value_of_refunded_transactions_milliunits: null,
            priced_refunds: 0,
          },
        ]),
      );
      expect(report.unattributedReasons).toEqual([
        {
          reason: 'unknown_account',
          transactions: 1,
          purchasers: 0,
          purchasers_with_campaign_session: 0,
        },
      ]);
      expect(report.byStore.unattributedReasons).toEqual([
        { store: 'apple', ...report.unattributedReasons[0] },
      ]);
      expect(JSON.stringify(report)).not.toContain(profileId);
      expect(report.purchases.every((r) => !('store' in r) && !('report_store' in r))).toBe(true);
      // Refund processing uses its own period, including purchases outside that period.
      const later = await acquisitionReport(ctx.env.DB, end, '2026-10-23T00:00:00.000Z', model);
      expect(later.purchases).toEqual([]);
      expect(later.byStore.refunds).toEqual([
        {
          store: 'xsolla',
          campaign,
          currency: 'KRW',
          refunds: 1,
          purchase_value_of_refunded_transactions_milliunits: 2000,
          priced_refunds: 1,
        },
      ]);
    },
  );
});
