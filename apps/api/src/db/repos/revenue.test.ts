import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../client.js';
import { billingAlerts, iapPurchases, profiles, seasonPasses } from '../schema.js';
import { createTestD1, spyDb, type TestD1 } from '../../test/d1.js';
import { revenueReport } from './revenue.js';

const NOW = new Date('2026-11-01T15:00:00.000Z');
const BEFORE = '2026-10-31T14:59:59.999Z';
const START = '2026-10-31T15:00:00.000Z';
const AT = '2026-11-01T15:00:00.000Z';
const PID = 'revenue-fixture-owner';
const product = (name: string) => `com.offsidelab.app.${name}`;

describe('revenue read-model characterization (R2)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    await ctx.db.insert(profiles).values({
      id: PID,
      settingsJson: '{}',
      nickname: 'Fixture',
      createdAt: BEFORE,
      lastSeenAt: BEFORE,
    });
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  async function report() {
    const spy = spyDb(ctx.env.DB);
    const result = await revenueReport(createDb(spy.DB), NOW, 2);
    expect(spy.seen).toHaveLength(10);
    expect(
      spy.seen.map((q) => createHash('sha256').update(q.replace(/\s+/g, ' ').trim()).digest('hex')),
    ).toMatchSnapshot('SQL baseline');
    expect(spy.trips.n).toBe(1);
    expect(spy.seen.every((q) => !/\b(insert|update|delete)\b/i.test(q))).toBe(true);
    // SQL intentionally has no tie-breaker. Compare the complete bag of tied recent rows,
    // without imposing a new ordering contract on the production query.
    return {
      ...result,
      recent: [...result.recent].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    };
  }
  const buy = (id: string, name: string, at: string, extra = {}) => ({
    store: 'google',
    transactionId: id,
    profileId: PID,
    productId: product(name),
    item: 'boost',
    qty: 1,
    createdAt: at,
    ...extra,
  });
  const alert = (id: string, name: string, kind: string, at: string, test = false) => ({
    id,
    store: 'apple',
    productId: product(name),
    kind,
    createdAt: at,
    test,
  });

  it('empty database returns zero totals, null since and every KST day', async () => {
    expect(await report()).toMatchSnapshot();
  });

  it('KST midnight, old purchase/new refund, unknown products and test ledgers', async () => {
    await ctx.db
      .insert(iapPurchases)
      .values([
        buy('outside', 'boost_10', BEFORE),
        buy('boundary', 'boost_100', START, { qty: 100 }),
        buy('old-refund', 'scout_5', BEFORE, { refundedAt: AT }),
        buy('unknown', 'not_registered', AT),
        buy('sandbox', 'boost_100', AT, { test: true }),
      ]);
    await ctx.db.insert(seasonPasses).values([
      { profileId: PID, season: 1, store: 'xsolla', transactionId: 'pass', createdAt: START },
      {
        profileId: PID,
        season: 2,
        store: 'google',
        transactionId: 'old-pass',
        createdAt: BEFORE,
        refundedAt: AT,
      },
      {
        profileId: PID,
        season: 3,
        store: 'google',
        transactionId: 'test-pass',
        createdAt: AT,
        test: true,
      },
    ]);
    await ctx.db
      .insert(billingAlerts)
      .values([
        alert('duplicate-pass-notice', 'season_pass', 'purchase', START),
        alert('duplicate-item-notice', 'boost_100', 'purchase', START),
        alert('member-buy', 'club_monthly', 'purchase', START),
        alert('member-renew', 'club_monthly', 'renewal', AT),
        alert('member-refund', 'club_monthly', 'refund', AT),
        alert('member-test', 'club_monthly', 'renewal', AT, true),
        alert('ads-before', 'remove_ads', 'purchase', BEFORE),
        alert('ads-buy', 'remove_ads', 'purchase', START),
        alert('ads-refund', 'remove_ads', 'refund', AT),
        alert('ads-test', 'remove_ads', 'purchase', AT, true),
      ]);
    const r = await report();
    expect(r.total).toEqual({
      count: 5,
      krw: 34600,
      buyers: 1,
      firstBuyers: 0,
      refunds: 3,
      refundKrw: 19200,
    });
    expect(r.products.find((p) => p.productId === product('not_registered'))).toEqual({
      productId: product('not_registered'),
      count: 1,
      krw: 0,
      refunded: 0,
    });
    expect(r).toMatchSnapshot();
  });

  it('refund-only day is negative for membership/ads, item refunds keep original purchase-date semantics', async () => {
    await ctx.db.insert(iapPurchases).values(buy('old', 'boost_100', BEFORE, { refundedAt: AT }));
    await ctx.db
      .insert(billingAlerts)
      .values([
        alert('member', 'club_monthly', 'refund', AT),
        alert('ads', 'remove_ads', 'refund', AT),
      ]);
    const r = await report();
    expect(r.daily[1]).toEqual({
      day: '2026-11-02',
      count: 0,
      krw: -4900,
      adCount: 0,
      adKrw: -6600,
    });
    expect(r.total.refundKrw).toBe(24700);
    expect(r).toMatchSnapshot();
  });

  it('recent is all-time and capped at 30, independently of the window', async () => {
    for (let i = 0; i < 35; i++)
      await ctx.db
        .insert(iapPurchases)
        .values(
          buy(`recent-${i}`, 'boost_10', new Date(Date.parse(BEFORE) - i * 1000).toISOString()),
        );
    const r = await report();
    expect(r.total.count).toBe(0);
    expect(r.recent).toHaveLength(30);
    expect(r.recent.map((x) => x.createdAt).sort()).toEqual(
      Array.from({ length: 30 }, (_, i) =>
        new Date(Date.parse(BEFORE) - i * 1000).toISOString(),
      ).sort(),
    );
    expect(r).toMatchSnapshot();
  });
});
