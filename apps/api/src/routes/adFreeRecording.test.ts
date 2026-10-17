import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie, callJson } from '../test/http.js';
import { recordAdFreePurchase, markPurchaseRefund } from '../db/repos/adFreePurchases.js';
import { grantIapPurchase } from '../db/repos/iap.js';
import { acquisitionReport } from '../db/repos/acquisition.js';
import { handleAppleNotification } from '../iap/refunds.js';
const tx = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
  note: null as Record<string, unknown> | null,
}));
vi.mock('../iap/apple.js', async (orig) => ({
  ...(await orig<typeof import('../iap/apple.js')>()),
  verifyAppleTransaction: async () => tx.value,
  verifyAppleNotification: async () => tx.note,
}));
const productId = 'com.offsidelab.app.remove_ads';
describe('ad removal verified recording', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    ctx.env.ACQUISITION_ENABLED = '1';
    tx.value = null;
    tx.note = null;
  });
  afterEach(async () => {
    await ctx.dispose();
  });
  const post = (cookie: string) =>
    callJson(ctx.env, 'POST', '/v1/iap/ad-free/record', {
      cookie,
      body: { store: 'apple', token: 'signed-fixture' },
    });
  it('records exactly once, never grants items, preserves unbound legacy restores and rejects account/product tampering', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    for (const me of [a, b])
      await callJson(ctx.env, 'POST', '/v1/acquisition', {
        cookie: me.cookie,
        body: { action: 'grant', version: 'account-acquisition-v1' },
      });
    const now = Date.now();
    tx.value = {
      transactionId: 'ad-1',
      bundleId: 'com.offsidelab.app',
      productId,
      type: 'Non-Consumable',
      environment: 'Production',
      appAccountToken: a.profileId.replace(/^prf_/, ''),
      purchaseDate: now,
      price: 3300000,
      currency: 'KRW',
      storefront: 'KOR',
    };
    for (let n = 0; n < 3; n++) expect((await post(a.cookie)).status).toBe(204);
    expect((await post(b.cookie)).status).toBe(409);
    tx.value = {
      ...tx.value,
      originalTransactionId: 'ad-1',
      transactionId: 'restore-new-id',
      originalPurchaseDate: now,
    };
    expect((await post(a.cookie)).status).toBe(204);
    expect(
      (await ctx.env.DB.prepare('SELECT * FROM iap_ad_free_purchases').all()).results,
    ).toHaveLength(1);
    expect((await ctx.env.DB.prepare('SELECT * FROM owner_items').all()).results).toHaveLength(0);
    tx.value = {
      ...tx.value,
      originalTransactionId: undefined,
      transactionId: 'legacy',
      appAccountToken: undefined,
    };
    expect((await post(b.cookie)).status).toBe(204);
    expect(
      (
        await ctx.env.DB.prepare(
          'SELECT profile_id FROM iap_ad_free_purchases WHERE transaction_id=?',
        )
          .bind('legacy')
          .first()
      )?.profile_id,
    ).toBeNull();
    const noConsent = await issueGoogleCookie(ctx);
    tx.value = { ...tx.value, transactionId: 'no-consent', appAccountToken: undefined };
    expect((await post(noConsent.cookie)).status).toBe(204);
    expect(
      (await ctx.env.DB.prepare('SELECT * FROM iap_ad_free_purchases').all()).results,
    ).toHaveLength(2);
    tx.value = { ...tx.value, transactionId: 'family', inAppOwnershipType: 'FAMILY_SHARED' };
    expect((await post(a.cookie)).status).toBe(204);
    expect(
      (await ctx.env.DB.prepare('SELECT * FROM iap_ad_free_purchases').all()).results,
    ).toHaveLength(2);
    tx.value = {
      ...tx.value,
      transactionId: 'wrong',
      inAppOwnershipType: undefined,
      type: 'Consumable',
    };
    expect((await post(a.cookie)).status).toBe(409);
    tx.value = { ...tx.value, type: 'Non-Consumable', revocationDate: now };
    expect((await post(a.cookie)).status).toBe(409);
  });

  it('does not recreate optional records after consent withdrawal or profile deletion during verification', async () => {
    const a = await issueGoogleCookie(ctx);
    const p = {
      store: 'apple' as const,
      transactionId: 'late',
      profileId: a.profileId,
      consentProfileId: a.profileId,
      test: false,
      now: new Date().toISOString(),
      metadata: { purchasedAt: null, priceMilliunits: null, currency: null, storefront: null },
    };
    await callJson(ctx.env, 'POST', '/v1/acquisition', {
      cookie: a.cookie,
      body: { action: 'grant', version: 'account-acquisition-v1' },
    });
    await callJson(ctx.env, 'POST', '/v1/acquisition', {
      cookie: a.cookie,
      body: { action: 'revoke', profileId: a.profileId },
    });
    await recordAdFreePurchase(ctx.env.DB, p);
    await recordAdFreePurchase(ctx.env.DB, {
      ...p,
      transactionId: 'unbound-late',
      profileId: null,
    });
    expect(
      (await ctx.env.DB.prepare('SELECT * FROM iap_ad_free_purchases').all()).results,
    ).toHaveLength(0);
    await callJson(ctx.env, 'POST', '/v1/acquisition', {
      cookie: a.cookie,
      body: { action: 'grant', version: 'account-acquisition-v1' },
    });
    await ctx.env.DB.prepare('UPDATE profiles SET deleted_at=? WHERE id=?')
      .bind(p.now, a.profileId)
      .run();
    await recordAdFreePurchase(ctx.env.DB, p);
    expect(
      (await ctx.env.DB.prepare('SELECT * FROM iap_ad_free_purchases').all()).results,
    ).toHaveLength(0);
  });
  it('never grants consumables when a verified refund marker arrived before an old purchase replay', async () => {
    const a = await issueGoogleCookie(ctx);
    const now = new Date().toISOString();
    await markPurchaseRefund(ctx.env.DB, 'apple', 'early-refund', now);
    const p = {
      store: 'apple' as const,
      transactionId: 'early-refund',
      profileId: a.profileId,
      productId: 'com.offsidelab.app.reroll_5',
      item: 'reroll' as const,
      qty: 5,
      test: false,
      now,
      alertId: 'early-refund-alert',
    };
    for (let n = 0; n < 3; n++)
      expect(await grantIapPurchase(ctx.db, p)).toMatchObject({ reroll: 0 });
    const rows = (
      await ctx.env.DB.prepare(
        'SELECT refunded_at,revoked_qty FROM iap_purchases WHERE transaction_id=?',
      )
        .bind('early-refund')
        .all()
    ).results;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refunded_at: now, revoked_qty: 0 });
    expect((await ctx.env.DB.prepare('SELECT * FROM owner_items').all()).results).toHaveLength(0);
    expect((await ctx.env.DB.prepare('SELECT * FROM billing_alerts').all()).results).toHaveLength(
      0,
    );
  });
  it('uses one payer across consumable/nonconsumable events and separates anonymous legacy/test/refund', async () => {
    const a = await issueGoogleCookie(ctx);
    await callJson(ctx.env, 'POST', '/v1/acquisition', {
      cookie: a.cookie,
      body: { action: 'grant', version: 'account-acquisition-v1' },
    });
    const now = new Date().toISOString();
    const metadata = {
      purchasedAt: now,
      priceMilliunits: 3300000,
      currency: 'KRW',
      storefront: 'KOR',
    };
    const p = {
      store: 'apple' as const,
      transactionId: 'ad-1',
      profileId: a.profileId,
      consentProfileId: a.profileId,
      test: false,
      now,
      metadata,
    };
    await Promise.all([recordAdFreePurchase(ctx.env.DB, p), recordAdFreePurchase(ctx.env.DB, p)]);
    await recordAdFreePurchase(ctx.env.DB, { ...p, transactionId: 'legacy', profileId: null });
    await recordAdFreePurchase(ctx.env.DB, { ...p, transactionId: 'sandbox', test: true });
    await markPurchaseRefund(ctx.env.DB, 'apple', 'refund-before-record', now);
    await recordAdFreePurchase(ctx.env.DB, {
      ...p,
      transactionId: 'refund-before-record',
      test: true,
    });
    expect(
      (
        await ctx.env.DB.prepare(
          'SELECT refunded_at FROM iap_ad_free_purchases WHERE transaction_id=?',
        )
          .bind('refund-before-record')
          .first()
      )?.refunded_at,
    ).toBe(now);
    await grantIapPurchase(ctx.db, {
      ...p,
      transactionId: 'consumable',
      productId: 'com.offsidelab.app.reroll_5',
      item: 'reroll',
      qty: 5,
    });
    const start = new Date(Date.now() - 86400_000).toISOString(),
      end = new Date(Date.now() + 86400_000).toISOString();
    const report = await acquisitionReport(ctx.env.DB, start, end, 'last');
    expect(report.purchases[0]).toMatchObject({
      transactions: 3,
      unique_payers: 1,
      new_payers: 1,
      repeat_transactions: 1,
      unknown_account_transactions: 1,
      gross_milliunits: 9900000,
    });
    tx.value = { transactionId: 'ad-1' };
    tx.note = {
      notificationType: 'REFUND',
      data: { bundleId: 'com.offsidelab.app', signedTransactionInfo: 'fixture' },
    };
    await handleAppleNotification(ctx.env, ctx.db, 'signed-note', now);
    await handleAppleNotification(ctx.env, ctx.db, 'signed-note', now);
    expect((await acquisitionReport(ctx.env.DB, start, end, 'last')).refunds[0]).toMatchObject({
      refunds: 1,
      purchase_value_of_refunded_transactions_milliunits: 3300000,
    });
  });
});
