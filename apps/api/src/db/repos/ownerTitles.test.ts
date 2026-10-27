import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { foundersOf } from './ownerTeams.js';
import { eq } from 'drizzle-orm';
import { createTestD1, syncCards, type TestD1 } from '../../test/d1.js';
import {
  issueCookie,
  issueGoogleCookie,
  issueAdminCookie,
  ADMIN_EMAIL,
  callJson,
} from '../../test/http.js';
import {
  careers,
  cards,
  cupEntries,
  ownerHonors,
  ownerSeasonRecords,
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
  TITLE_PROGRESS_TTL_MS,
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

  it('founder matches the old badge exactly, upgrades v2 progress and stays earned without replacing a selected title', async () => {
    const who = await issueGoogleCookie(ctx);
    const [id] = await seed(who.profileId, 1);
    await ctx.db.update(careers).set({ retireAge: 18, peak: null }).where(eq(careers.id, id!));
    for (const [patch, expected] of [
      [{ serviceSeason: 1 }, 0],
      [{ serviceSeason: null }, 0],
      [{ serviceSeason: 0, hidden: 1 }, 0],
      [{ hidden: 0, status: 'active' }, 0],
      [{ status: 'retired' }, 1],
    ] as const) {
      await ctx.db.update(careers).set(patch).where(eq(careers.id, id!));
      expect((await titleMetricsOf(ctx.db, who.profileId)).preseason).toBe(expected);
      expect((await foundersOf(ctx.db, [who.profileId])).length).toBe(expected);
    }
    const metrics = await titleMetricsOf(ctx.db, who.profileId);
    expect(metrics.retired).toBe(0);
    await ctx.db.insert(ownerTitleProgress).values({
      profileId: who.profileId,
      ...metrics,
      preseason: 0,
      criteriaVersion: 2,
      updatedAt: NOW,
    });
    const hall = await permanentTitlesOf(ctx.db, who.profileId, NOW);
    expect(hall.find((t) => t.id === 'owner-founder')).toMatchObject({
      target: 1,
      value: 1,
      earnedAt: NOW,
    });
    const res = await callJson(ctx.env, 'PUT', '/v1/owner/title', {
      cookie: who.cookie,
      body: { title: 'owner-founder' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { title: 'owner-founder', pinned: true } });
    await ctx.db.update(careers).set({ hidden: 1 }).where(eq(careers.id, id!));
    await refreshOwnerTitles(ctx.db, who.profileId, NOW);
    expect(
      (await permanentTitlesOf(ctx.db, who.profileId, NOW)).find((t) => t.id === 'owner-founder')
        ?.earnedAt,
    ).toBe(NOW);
  });

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
      preseason: 6,
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
      exchanges: 0,
      forwards: 3,
      positions: 1,
      nations: 1,
      cups: 0,
      podiums: 0,
      seasons: 0,
      division: 0,
    });
    expect((await titleMetricsOf(ctx.db, b.profileId)).retired).toBe(0);
    const preview = await refreshOwnerTitles(ctx.db, a.profileId, NOW, true);
    expect(preview).toEqual([
      'owner-developer',
      'owner-star-maker',
      'owner-founder',
      'owner-pioneer',
    ]);
    expect(await ctx.db.select().from(ownerTitleAwards)).toHaveLength(0);
    expect(await ctx.db.select().from(ownerTitleProgress)).toHaveLength(0);
    await Promise.all([
      refreshOwnerTitles(ctx.db, a.profileId, NOW),
      refreshOwnerTitles(ctx.db, a.profileId, NOW),
    ]);
    expect(await ctx.db.select().from(ownerTitleAwards)).toHaveLength(4);
    expect(await refreshOwnerTitles(ctx.db, a.profileId, NOW)).toEqual([]);
    await ctx.db.update(careers).set({ hidden: 1 }).where(eq(careers.profileId, a.profileId));
    await refreshOwnerTitles(ctx.db, a.profileId, '2026-11-01T00:00:00.000Z');
    expect(
      (await permanentTitlesOf(ctx.db, a.profileId, NOW)).filter((t) => t.earnedAt),
    ).toHaveLength(4);
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
      // T-11-547 공격수 10명 · 네 포지션 · 90 이상 10명.
      'owner-forward',
      'owner-all-rounder',
      'owner-star-factory',
    ]) {
      expect(hall.find((t) => t.id === id)?.earnedAt).toBe(NOW);
    }
    expect(hall.find((t) => t.id === 'owner-star-cradle')).toMatchObject({
      value: 25,
      earnedAt: null,
    });
    await ctx.db.update(careers).set({ goals: 500 }).where(eq(careers.id, ids[4]!));
    // A pre-v2 snapshot must be refreshed even without a newer career timestamp.
    await ctx.db
      .update(ownerTitleProgress)
      .set({ criteriaVersion: 0 })
      .where(eq(ownerTitleProgress.profileId, who.profileId));
    const later = '2026-10-11T00:00:00.000Z';
    hall = await permanentTitlesOf(ctx.db, who.profileId, later);
    expect(hall.find((t) => t.id === 'owner-goals')).toMatchObject({ value: 5, earnedAt: later });
    expect((await ctx.db.select().from(ownerTitleProgress))[0]?.criteriaVersion).toBe(4);
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

  it('T-11-547 nations, cups, seasons and division count only that owner and award new tiers', async () => {
    const who = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const ids = await seed(who.profileId, 12);
    // 국적 NULL(대한민국) · 'KR'은 한 나라, 나머지 10개 나라 → 11.
    const nations = [null, 'KR', 'BR', 'AR', 'FR', 'DE', 'ES', 'IT', 'EN', 'JP', 'US', 'MX'];
    for (const [i, id] of ids.entries())
      await ctx.db.update(careers).set({ nation: nations[i] }).where(eq(careers.id, id));
    // 30세 전에 은퇴한 선수의 국적은 세지 않는다.
    const [young] = await seed(who.profileId, 1);
    await ctx.db.update(careers).set({ nation: 'NG', retireAge: 25 }).where(eq(careers.id, young!));
    const entry = (profileId: string, cup: number, stage: string | null, status = 'active') => ({
      cupId: `cup-${cup}`,
      teamId: `team-${profileId}-${cup}`,
      profileId,
      name: 'Team',
      manager: 'M',
      ovr: 80,
      status,
      stage,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await ctx.db
      .insert(cupEntries)
      .values([
        entry(who.profileId, 1, 'champion'),
        entry(who.profileId, 2, 'sf'),
        entry(who.profileId, 3, 'group'),
        entry(who.profileId, 4, null),
        entry(who.profileId, 5, null, 'withdrawn'),
        entry(other.profileId, 1, 'runnerup'),
      ]);
    const record = (profileId: string, season: number, retired: number) => ({
      profileId,
      season,
      players: retired,
      retired,
      retiredNumbers: 0,
      wallOfHonor: 0,
      firsts: 0,
      createdAt: NOW,
    });
    await ctx.db
      .insert(ownerSeasonRecords)
      .values([
        record(who.profileId, 0, 3),
        record(who.profileId, 1, 1),
        record(who.profileId, 2, 0),
        record(other.profileId, 3, 5),
      ]);
    await ctx.db.insert(ownerHonors).values([
      { profileId: who.profileId, season: 1, kind: 'division', value: 5, grantedAt: NOW },
      { profileId: who.profileId, season: 1, kind: 'first', value: 1, grantedAt: NOW },
      { profileId: other.profileId, season: 1, kind: 'division', value: 7, grantedAt: NOW },
    ]);
    expect(await titleMetricsOf(ctx.db, who.profileId)).toMatchObject({
      nations: 11,
      cups: 3,
      podiums: 2,
      seasons: 2,
      division: 5,
      firsts: 1,
    });
    const earned = await refreshOwnerTitles(ctx.db, who.profileId, NOW);
    expect(earned).toEqual(expect.arrayContaining(['owner-world', 'owner-cup-regular']));
    expect(earned).toContain('owner-division-elite');
    for (const id of ['owner-world-tour', 'owner-cup-contender', 'owner-seasons'])
      expect(earned).not.toContain(id);
    expect(earned).not.toContain('owner-division-master');
    const hall = await permanentTitlesOf(ctx.db, who.profileId, NOW);
    expect(hall.find((t) => t.id === 'owner-cup-contender')).toMatchObject({
      value: 2,
      target: 3,
    });
    expect(hall.find((t) => t.id === 'owner-division-master')).toMatchObject({
      value: 5,
      target: 7,
      earnedAt: null,
    });
  });

  it('T-11-547 unlinked owners get no progress or awards', async () => {
    const anon = await issueCookie(ctx);
    await seed(anon.profileId, 60);
    expect(await refreshOwnerTitles(ctx.db, anon.profileId, NOW)).toEqual([]);
    expect(await permanentTitlesOf(ctx.db, anon.profileId, NOW)).toSatisfy(
      (hall: { earnedAt: string | null }[]) => hall.every((t) => !t.earnedAt),
    );
    expect(await ctx.db.select().from(ownerTitleAwards)).toHaveLength(0);
    expect(await ctx.db.select().from(ownerTitleProgress)).toHaveLength(0);
  });

  it('T-11-547 a version-3 snapshot is recounted once, team metrics refresh daily, old awards stay', async () => {
    const who = await issueGoogleCookie(ctx);
    await seed(who.profileId, 10);
    await refreshOwnerTitles(ctx.db, who.profileId, NOW);
    // v3 기준(헌납의 명가 10일)으로 받은 칭호 · 지금 기준보다 낮은 증거도 그대로 둔다.
    await ctx.db.insert(ownerTitleAwards).values({
      profileId: who.profileId,
      titleId: 'owner-exchange',
      criteriaVersion: 3,
      evidence: 10,
      earnedAt: NOW,
    });
    await ctx.db
      .update(ownerTitleProgress)
      .set({ criteriaVersion: 3, forwards: 0 })
      .where(eq(ownerTitleProgress.profileId, who.profileId));
    const later = '2026-10-10T01:00:00.000Z';
    let hall = await permanentTitlesOf(ctx.db, who.profileId, later);
    let [progress] = await ctx.db.select().from(ownerTitleProgress);
    expect(progress).toMatchObject({ criteriaVersion: 4, forwards: 3, updatedAt: later });
    expect(hall.find((t) => t.id === 'owner-exchange')).toMatchObject({
      earnedAt: NOW,
      value: 10,
    });
    // 같은 날 컵 성적이 생겨도 다시 세지 않고(쓰기 없음), 하루가 지나면 다시 센다.
    await ctx.db.insert(cupEntries).values(
      [1, 2, 3].map((n) => ({
        cupId: `cup-${n}`,
        teamId: `team-${n}`,
        profileId: who.profileId,
        name: 'Team',
        manager: 'M',
        ovr: 80,
        stage: 'sf',
        createdAt: NOW,
        updatedAt: NOW,
      })),
    );
    const sameDay = '2026-10-10T20:00:00.000Z';
    hall = await permanentTitlesOf(ctx.db, who.profileId, sameDay);
    expect(hall.find((t) => t.id === 'owner-cup-contender')?.earnedAt).toBeNull();
    [progress] = await ctx.db.select().from(ownerTitleProgress);
    expect(progress?.updatedAt).toBe(later);
    const nextDay = new Date(Date.parse(later) + TITLE_PROGRESS_TTL_MS + 1).toISOString();
    hall = await permanentTitlesOf(ctx.db, who.profileId, nextDay);
    expect(hall.find((t) => t.id === 'owner-cup-contender')?.earnedAt).toBe(nextDay);
    expect(hall.find((t) => t.id === 'owner-cup-regular')?.earnedAt).toBe(nextDay);
  });
});
