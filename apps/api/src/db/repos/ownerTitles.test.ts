import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestD1, syncCards, type TestD1 } from '../../test/d1.js';
import { issueGoogleCookie, issueAdminCookie, ADMIN_EMAIL, callJson } from '../../test/http.js';
import {
  careers,
  cards,
  ownerHonors,
  ownerTitleAwards,
  ownerTitleProgress,
  retiredNumbers,
} from '../schema.js';
import {
  backfillOwnerTitles,
  permanentTitlesOf,
  refreshOwnerTitles,
  titleMetricsOf,
  grantPioneerTitles,
} from './ownerTitles.js';

const NOW = '2026-10-10T00:00:00.000Z';
describe('Permanent owner titles', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  async function seed(profileId: string, n = 10) {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      await ctx.db.insert(careers).values({
        id,
        profileId,
        pos: 'FW',
        foot: '오른발',
        type: 'poacher',
        trait: 'late',
        startYear: 2026,
        status: 'retired',
        appVersion: '1',
        createdAt: NOW,
        updatedAt: NOW,
        retiredAt: NOW,
        retireAge: 30,
        peak: i < 3 ? 90 : 80,
        ballon: i === 0 ? 1 : 0,
        serviceSeason: i % 2,
      });
    }
    return ids;
  }

  it('all-season milestones exclude early/hidden careers and award the original developer after a transfer', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    const ids = await seed(a.profileId, 12);
    await ctx.db.update(careers).set({ retireAge: 29 }).where(eq(careers.id, ids[10]!));
    await ctx.db.update(careers).set({ hidden: 1 }).where(eq(careers.id, ids[11]!));
    await syncCards(ctx);
    await ctx.db.update(cards).set({ ownerId: b.profileId }).where(eq(cards.careerId, ids[0]!));
    await ctx.db.insert(retiredNumbers).values({
      season: 0,
      clubId: 'club',
      number: 9,
      careerId: ids[0]!,
      club: 'Club',
      score: 2000,
      seq: 1,
      grantedAt: NOW,
    });
    await ctx.db
      .insert(ownerHonors)
      .values({ profileId: a.profileId, season: 0, kind: 'first', value: 1, grantedAt: NOW });
    expect(await titleMetricsOf(ctx.db, a.profileId)).toEqual({
      midfield: 0,
      defense: 0,
      keeper: 0,
      scorers: 0,
      creators: 0,
      internationals: 0,
      retired: 10,
      elite: 3,
      ballon: 1,
      numbers: 1,
      firsts: 1,
    });
    expect((await titleMetricsOf(ctx.db, b.profileId)).retired).toBe(0);
    const preview = await refreshOwnerTitles(ctx.db, a.profileId, NOW, true);
    expect(preview).toEqual(['owner-developer', 'owner-star-maker', 'owner-pioneer']);
    expect(await ctx.db.select().from(ownerTitleAwards)).toHaveLength(0);
    expect(await ctx.db.select().from(ownerTitleProgress)).toHaveLength(0);
    await Promise.all([
      refreshOwnerTitles(ctx.db, a.profileId, NOW),
      refreshOwnerTitles(ctx.db, a.profileId, NOW),
    ]);
    expect(await ctx.db.select().from(ownerTitleAwards)).toHaveLength(3);
    expect(await refreshOwnerTitles(ctx.db, a.profileId, NOW)).toEqual([]);
    await ctx.db.update(careers).set({ hidden: 1 }).where(eq(careers.profileId, a.profileId));
    await refreshOwnerTitles(ctx.db, a.profileId, '2026-11-01T00:00:00.000Z');
    expect(
      (await permanentTitlesOf(ctx.db, a.profileId, NOW)).filter((t) => t.earnedAt),
    ).toHaveLength(3);
    expect((await ctx.db.select().from(ownerTitleAwards))[0]?.earnedAt).toBe(NOW);
  });

  it('counts repeated feats across distinct careers, position expertise and versioned progress without revoking old awards', async () => {
    const who = await issueGoogleCookie(ctx);
    const ids = await seed(who.profileId, 25);
    for (const [i, id] of ids.entries()) {
      await ctx.db
        .update(careers)
        .set({
          pos: i < 5 ? 'MF' : i < 10 ? 'DF' : i < 15 ? 'GK' : 'FW',
          peak: 90,
          goals: i < 4 ? 500 : 499,
          assists: i < 5 ? 300 : 299,
          caps: i < 5 ? 150 : 149,
          ballon: i < 5 ? 1 : 0,
        })
        .where(eq(careers.id, id));
      await ctx.db.insert(retiredNumbers).values({
        season: i % 2,
        clubId: 'club',
        number: i + 1,
        careerId: id,
        club: 'Club',
        score: 2000,
        seq: i + 1,
        grantedAt: NOW,
      });
    }
    await refreshOwnerTitles(ctx.db, who.profileId, NOW);
    let hall = await permanentTitlesOf(ctx.db, who.profileId, NOW);
    expect(hall.find((t) => t.id === 'owner-goals')).toMatchObject({ value: 4, earnedAt: null });
    for (const id of [
      'owner-midfield',
      'owner-defense',
      'owner-keeper',
      'owner-assists',
      'owner-national',
      'owner-ballon-maker',
      'owner-dynasty',
    ]) {
      expect(hall.find((t) => t.id === id)?.earnedAt).toBe(NOW);
    }
    await ctx.db.update(careers).set({ goals: 500 }).where(eq(careers.id, ids[4]!));
    // A pre-v2 snapshot must be refreshed even without a newer career timestamp.
    await ctx.db
      .update(ownerTitleProgress)
      .set({ criteriaVersion: 0 })
      .where(eq(ownerTitleProgress.profileId, who.profileId));
    const later = '2026-10-11T00:00:00.000Z';
    hall = await permanentTitlesOf(ctx.db, who.profileId, later);
    expect(hall.find((t) => t.id === 'owner-goals')).toMatchObject({ value: 5, earnedAt: later });
    expect((await ctx.db.select().from(ownerTitleProgress))[0]?.criteriaVersion).toBe(2);
    // Historic awards remain valid when their earlier criteria were easier.
    await ctx.db
      .update(ownerTitleAwards)
      .set({ criteriaVersion: 1, evidence: 1 })
      .where(eq(ownerTitleAwards.titleId, 'owner-ballon-maker'));
    await ctx.db.update(careers).set({ ballon: 0 }).where(eq(careers.profileId, who.profileId));
    await refreshOwnerTitles(ctx.db, who.profileId, later);
    expect(
      (await permanentTitlesOf(ctx.db, who.profileId, later)).find(
        (t) => t.id === 'owner-ballon-maker',
      )?.earnedAt,
    ).toBe(NOW);
  });

  it('private hall seeds old records once, validates ownership, preserves manual choice, marks selected title seen', async () => {
    const who = await issueGoogleCookie(ctx);
    await seed(who.profileId);
    const call = (method: string, path: string, body?: unknown) =>
      callJson(ctx.env, method, path, { cookie: who.cookie, ...(body ? { body } : {}) });
    const hall = (await (await call('GET', '/v1/owner/title')).json()) as {
      data: { title: string | null; titles: string[]; permanent: { id: string; isNew: boolean }[] };
    };
    expect(hall.data.title).toBeNull();
    expect(hall.data.titles).toContain('owner-developer');
    expect(hall.data.permanent.find((t) => t.id === 'owner-developer')?.isNew).toBe(true);
    expect((await call('PUT', '/v1/owner/title', { title: 'owner-academy' })).status).toBe(409);
    expect((await call('PUT', '/v1/owner/title', { title: 'owner-made-up' })).status).toBe(400);
    const selected = await call('PUT', '/v1/owner/title', { title: 'owner-developer' });
    expect(await selected.json()).toMatchObject({
      data: { title: 'owner-developer', pinned: true },
    });
    expect(
      (await permanentTitlesOf(ctx.db, who.profileId, NOW)).find((t) => t.id === 'owner-developer')
        ?.isNew,
    ).toBe(false);
    await refreshOwnerTitles(ctx.db, who.profileId, NOW);
    const again = (await (await call('GET', '/v1/owner/title')).json()) as {
      data: { title: string };
    };
    expect(again.data.title).toBe('owner-developer');
    const [newCareer] = await seed(who.profileId, 1);
    await ctx.db
      .update(careers)
      .set({ updatedAt: '2099-01-01T00:00:00.000Z' })
      .where(eq(careers.id, newCareer!));
    expect(
      (await permanentTitlesOf(ctx.db, who.profileId, '2099-01-02T00:00:00.000Z')).find(
        (t) => t.id === 'owner-developer',
      )?.value,
    ).toBe(11);
    expect(await (await call('PUT', '/v1/owner/title', { title: 'none' })).json()).toMatchObject({
      data: { title: null, pinned: true },
    });
    expect(await (await call('PUT', '/v1/owner/title', { title: null })).json()).toMatchObject({
      data: { title: null, pinned: false },
    });
  });

  it('backfill has bounded stable cursors and a read-only default preview; finalized firsts issue once', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    await seed(a.profileId, 50);
    await seed(b.profileId, 10);
    let cursor = '';
    let processed = 0;
    do {
      const r = await backfillOwnerTitles(ctx.db, NOW, cursor, 1, true);
      processed += r.processed;
      cursor = r.next ?? '';
    } while (cursor);
    expect(processed).toBe(2);
    expect(await ctx.db.select().from(ownerTitleAwards)).toHaveLength(0);
    ctx.env.ADMIN_EMAILS = ADMIN_EMAIL;
    const admin = await issueAdminCookie(ctx);
    const previewResponse = await callJson(ctx.env, 'POST', '/v1/admin/owner-titles/backfill', {
      cookie: admin.cookie,
      body: {},
    });
    expect(previewResponse.status).toBe(200);
    expect(await previewResponse.json()).toMatchObject({
      data: { dryRun: true },
      meta: { requestId: expect.any(String) },
    });
    expect(await ctx.db.select().from(ownerTitleAwards)).toHaveLength(0);
    expect(await ctx.db.select().from(ownerTitleProgress)).toHaveLength(0);
    const applied = await backfillOwnerTitles(ctx.db, NOW, '', 50, false);
    expect(applied.counts['owner-academy']).toBe(1);
    expect((await backfillOwnerTitles(ctx.db, NOW, '', 50, false)).counts).toEqual({});
    await ctx.db
      .insert(ownerHonors)
      .values({ profileId: a.profileId, season: 1, kind: 'first', value: 1, grantedAt: NOW });
    await grantPioneerTitles(ctx.db, NOW);
    await grantPioneerTitles(ctx.db, NOW);
    expect(
      (await permanentTitlesOf(ctx.db, a.profileId, NOW)).find((t) => t.id === 'owner-pioneer'),
    ).toMatchObject({ earnedAt: NOW, value: 1 });
    expect(
      (
        await callJson(ctx.env, 'POST', '/v1/admin/owner-titles/backfill', {
          cookie: a.cookie,
          body: {},
        })
      ).status,
    ).toBe(403);
  });
});
