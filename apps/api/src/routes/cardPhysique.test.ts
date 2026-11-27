import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { slotRating } from '@offside/contracts/owner-team';
import { SELECTABLE_DETAIL_POSITIONS, LEGACY_DETAIL_POSITIONS } from '@offside/contracts/positions';
import { PHYSIQUE_SKU } from '@offside/contracts/cup';
import { validRetiredBody } from '@offside/contracts/body';
import { balanceVersions, cards, careers, marketListings, ownerFunds } from '../db/schema.js';
import { careersByIds, eligibleMap } from '../db/repos/ownerTeams.js';
import { grantIapPurchase, revokeIapPurchase } from '../db/repos/iap.js';
import { physiqueTickets } from '../db/repos/cardPhysique.js';
import { buildLineup, lineupOvr, simulateMatch } from '../team/sim.js';
import { createTestD1, seedFunds, syncCards, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

let ctx: TestD1;
const now = '2026-11-27T00:00:00.000Z';
beforeEach(async () => {
  ctx = await createTestD1();
});
afterEach(async () => {
  await ctx.dispose();
});
it('gates legacy and capable clients, preserves performance, carries edits across owners and offsets purchaser refunds', async () => {
  const seller = await issueGoogleCookie(ctx);
  const buyer = await issueGoogleCookie(ctx);
  const id = crypto.randomUUID(),
    path = `/v1/cards/${id}/physique`;
  const post = (cookie: string, revision: number, height = 190, key = crypto.randomUUID()) =>
    callJson(ctx.env, 'POST', path, {
      cookie,
      headers: { 'Idempotency-Key': key },
      body: { expectedRevision: revision, height, weight: 82 },
    });
  const items = async (suffix: string) => {
    const res = await callJson(ctx.env, 'GET', '/v1/items' + suffix, { cookie: seller.cookie });
    return res.json() as Promise<{ data: { physique?: number } }>;
  };
  expect((await items('?physique=1')).data).toEqual((await items('')).data);
  expect((await post(seller.cookie, 0)).status).toBe(404);
  await ctx.db.insert(balanceVersions).values({
    version: 1,
    status: 'active',
    note: '',
    valuesJson: JSON.stringify({ retiredPhysiqueOpen: 1 }),
    createdBy: 'test',
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
  });
  await ctx.db.insert(careers).values({
    id,
    profileId: seller.profileId,
    pos: 'FW',
    height: 178,
    weight: 70,
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
    startYear: 2026,
    status: 'retired',
    appVersion: '1',
    createdAt: now,
    updatedAt: now,
    retiredAt: now,
    peak: 85,
    legendScore: 300,
    serviceSeason: 0,
    value: 3_000_000,
  });
  await syncCards(ctx, 1_000_000);
  await seedFunds(ctx, seller.profileId, 12345);
  const grant = (profileId: string, transactionId: string) =>
    grantIapPurchase(ctx.db, {
      store: 'apple',
      transactionId,
      profileId,
      productId: PHYSIQUE_SKU,
      item: 'physique',
      qty: 1,
      test: true,
      now,
    });
  const performance = async () => {
    const rows = await careersByIds(ctx.db, [id]);
    const map = eligibleMap(rows, seller.profileId, 0, true);
    const lineup = buildLineup('4-3-3', Array<string>(11).fill(id), map);
    return {
      ratings: [...new Set([...SELECTABLE_DETAIL_POSITIONS, ...LEGACY_DETAIL_POSITIONS])].map(
        (slot) => slotRating(slot, map.get(id)!),
      ),
      ovr: lineupOvr(lineup),
      match: simulateMatch('same-seed', lineup, buildLineup('4-3-3', [], new Map()), 2),
      cards: await ctx.db.select().from(cards),
      funds: await ctx.db.select().from(ownerFunds),
    };
  };
  const before = await performance();
  expect((await items('')).data.physique).toBeUndefined();
  expect((await items('?physique=1')).data.physique).toBe(0);
  expect((await post(seller.cookie, 0)).status).toBe(409);
  await grant(seller.profileId, 'purchase1');
  await grant(seller.profileId, 'purchase1');
  expect((await post(buyer.cookie, 0)).status).toBe(404);
  expect((await post(seller.cookie, 0, 159)).status).toBe(409);
  const listing = {
    id: 'lst_test',
    careerId: id,
    sellerId: seller.profileId,
    season: 0,
    price: 1,
    status: 'open' as const,
    createdAt: now,
  };
  await ctx.db.insert(marketListings).values(listing);
  expect((await post(seller.cookie, 0)).status).toBe(409);
  await ctx.db.delete(marketListings).where(eq(marketListings.id, listing.id));
  const key = crypto.randomUUID();
  expect((await post(seller.cookie, 0, 190, key)).status).toBe(200);
  expect((await post(seller.cookie, 0, 190, key)).status).toBe(200);
  expect((await post(seller.cookie, 0, 191)).status).toBe(409);
  expect(await performance()).toEqual(before);
  expect((await careersByIds(ctx.db, [id]))[0]).toMatchObject({ height: 190, weight: 82 });
  expect((await ctx.db.select().from(careers))[0]).toMatchObject({
    height: 178,
    weight: 70,
    foot: '오른발',
  });
  await ctx.db.update(cards).set({ ownerId: buyer.profileId }).where(eq(cards.careerId, id));
  await grant(buyer.profileId, 'purchase2');
  expect((await post(buyer.cookie, 1, 192)).status).toBe(200);
  await revokeIapPurchase(ctx.db, 'apple', 'purchase1', now);
  await revokeIapPurchase(ctx.db, 'apple', 'purchase1', now);
  await grant(seller.profileId, 'purchase3');
  expect(await physiqueTickets(ctx.db, seller.profileId)).toBe(0);
  expect((await careersByIds(ctx.db, [id]))[0]).toMatchObject({ height: 192, weight: 82 });
  expect((await post(seller.cookie, 2, 193)).status).toBe(404);
});
it('checks integer position limits and BMI together', () => {
  expect(validRetiredBody('GK', 167, 70)).toBe(false);
  expect(validRetiredBody('DF', 162, 70)).toBe(false);
  expect(validRetiredBody('MF', 199, 88)).toBe(false);
  expect(validRetiredBody('FW', 200, 74)).toBe(true);
  expect(validRetiredBody('FW', 200, 73)).toBe(false);
  expect(validRetiredBody('FW', 180, 80.5)).toBe(false);
});
