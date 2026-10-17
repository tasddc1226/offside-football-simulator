import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACQUISITION_CONSENT_VERSION as version } from '@offside/contracts/acquisition';
import { createTestD1, linkGoogle, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie, deleteProfile } from '../test/http.js';
import { grantIapPurchase, revokeIapPurchase } from '../db/repos/iap.js';
import { acquisitionReport } from '../db/repos/acquisition.js';
const campaign = '?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a';
describe('optional first-party acquisition and authoritative transactions', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    ctx.env.ACQUISITION_ENABLED = '1';
  });
  afterEach(async () => {
    await ctx.dispose();
  });
  const post = (cookie: string, body: Record<string, unknown>) =>
    callJson(ctx.env, 'POST', '/v1/acquisition', { cookie, body: { version, ...body } });
  it('requires explicit consent; anonymous stays unlinked; account switching never transfers a session', async () => {
    const a = await issueCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    const sessionId = crypto.randomUUID();
    expect((await post(a.cookie, { action: 'session', sessionId, campaign })).status).toBe(409);
    expect((await post(a.cookie, { action: 'grant' })).status).toBe(200);
    expect((await post(a.cookie, { action: 'session', sessionId, campaign })).status).toBe(204);
    let row = await ctx.env.DB.prepare('SELECT * FROM acquisition_sessions WHERE id=?')
      .bind(sessionId)
      .first();
    expect(row?.linked_at).toBeNull();
    await linkGoogle(ctx, a.profileId);
    expect((await post(a.cookie, { action: 'start', sessionId, campaign })).status).toBe(204);
    row = await ctx.env.DB.prepare('SELECT * FROM acquisition_sessions WHERE id=?')
      .bind(sessionId)
      .first();
    expect(row?.linked_at).toBeTruthy();
    expect(row?.started_at).toBeTruthy();
    await post(b.cookie, { action: 'grant' });
    expect((await post(b.cookie, { action: 'grant', profileId: a.profileId })).status).toBe(409);
    expect(
      (
        await post(b.cookie, {
          action: 'start',
          profileId: a.profileId,
          sessionId: crypto.randomUUID(),
          campaign,
        })
      ).status,
    ).toBe(409);
    expect((await post(b.cookie, { action: 'start', sessionId, campaign })).status).toBe(409);
    expect(
      (
        await post(a.cookie, {
          action: 'session',
          sessionId: crypto.randomUUID(),
          campaign: campaign + '&email=PRIVATE',
        })
      ).status,
    ).toBe(400);
    expect((await post(b.cookie, { action: 'revoke', profileId: a.profileId })).status).toBe(409);
    expect((await post(a.cookie, { action: 'revoke', profileId: a.profileId })).status).toBe(204);
    expect((await post(a.cookie, { action: 'start', sessionId, campaign })).status).toBe(409);
  });
  it('snapshots both touches, grants once across crash retries, counts one new payer, isolates test and refund', async () => {
    const a = await issueGoogleCookie(ctx);
    await post(a.cookie, { action: 'grant' });
    const first = crypto.randomUUID(),
      last = crypto.randomUUID();
    await post(a.cookie, { action: 'start', sessionId: first, campaign });
    const now = Date.now(),
      old = new Date(now - 60_000).toISOString(),
      purchaseTime = new Date(now + 1000).toISOString();
    await ctx.env.DB.prepare('UPDATE acquisition_sessions SET received_at=?,linked_at=? WHERE id=?')
      .bind(old, old, first)
      .run();
    await post(a.cookie, {
      action: 'store_click',
      sessionId: last,
      campaign: campaign.replace('jp_a', 'us_b'),
    });
    const purchase = {
      store: 'apple' as const,
      transactionId: 'verified-1',
      profileId: a.profileId,
      productId: 'com.offsidelab.app.reroll_5',
      item: 'reroll' as const,
      qty: 5,
      test: false,
      now: purchaseTime,
      acquisitionEnabled: true,
      metadata: {
        purchasedAt: purchaseTime,
        priceMilliunits: 4990000,
        currency: 'KRW',
        storefront: 'KOR',
      },
    };
    await Promise.all(Array.from({ length: 4 }, () => grantIapPurchase(ctx.db, purchase)));
    const rows = await ctx.env.DB.prepare('SELECT * FROM iap_purchases').all();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]).toMatchObject({
      first_touch_id: first,
      last_touch_id: last,
      price_milliunits: 4990000,
    });
    await grantIapPurchase(ctx.db, { ...purchase, transactionId: 'verified-2' });
    await grantIapPurchase(ctx.db, { ...purchase, transactionId: 'sandbox', test: true });
    const from = new Date(now - 86400_000).toISOString(),
      to = new Date(now + 86400_000).toISOString();
    const report = await acquisitionReport(ctx.env.DB, from, to, 'last');
    expect(report.purchases).toHaveLength(1);
    expect(report.purchases[0]).toMatchObject({
      campaign: campaign.replace('jp_a', 'us_b'),
      transactions: 2,
      unique_payers: 1,
      new_payers: 1,
      repeat_transactions: 1,
      gross_milliunits: 9980000,
    });
    expect(report.coverage[0]).toMatchObject({ sandbox_transactions: 1 });
    await revokeIapPurchase(ctx.db, 'apple', 'verified-1', purchaseTime);
    expect((await acquisitionReport(ctx.env.DB, from, to, 'last')).refunds[0]).toMatchObject({
      refunds: 1,
      purchase_value_of_refunded_transactions_milliunits: 4990000,
    });
    await post(a.cookie, { action: 'revoke', profileId: a.profileId });
    expect(
      await ctx.env.DB.prepare(
        'SELECT first_touch_id,last_touch_id FROM iap_purchases WHERE transaction_id=?',
      )
        .bind('verified-1')
        .first(),
    ).toEqual({ first_touch_id: null, last_touch_id: null });
    expect((await acquisitionReport(ctx.env.DB, from, to, 'last')).purchases[0]).toMatchObject({
      campaign: 'unattributed',
      transactions: 2,
    });
  });
  it('never attributes purchases outside the window or before receiving consent/touch; deletes acquisition on account deletion', async () => {
    const a = await issueGoogleCookie(ctx);
    await post(a.cookie, { action: 'grant' });
    const sessionId = crypto.randomUUID();
    await post(a.cookie, { action: 'session', sessionId, campaign });
    const now = new Date().toISOString(),
      ancient = new Date(Date.now() - 31 * 86400_000).toISOString();
    await ctx.env.DB.prepare('UPDATE acquisition_sessions SET received_at=?,linked_at=?')
      .bind(ancient, ancient)
      .run();
    await grantIapPurchase(ctx.db, {
      store: 'apple',
      transactionId: 'old',
      profileId: a.profileId,
      productId: 'com.offsidelab.app.reroll_5',
      item: 'reroll',
      qty: 5,
      test: false,
      now,
      acquisitionEnabled: true,
      metadata: { purchasedAt: now, priceMilliunits: null, currency: null, storefront: null },
    });
    const row = await ctx.env.DB.prepare('SELECT first_touch_id FROM iap_purchases').first();
    expect(row?.first_touch_id).toBeNull();
    await deleteProfile(ctx.env, a.cookie, 'acquisition-delete');
    expect(
      (await ctx.env.DB.prepare('SELECT * FROM acquisition_sessions').all()).results,
    ).toHaveLength(0);
    expect(
      (await ctx.env.DB.prepare('SELECT * FROM acquisition_consents').all()).results,
    ).toHaveLength(0);
  });
});
