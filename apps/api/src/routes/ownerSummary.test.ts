import { ownerTierHistoryOfProfile } from '../db/repos/ownerTiers.js';
import { applySeasonSchedule, seasonSchedule } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  issueGoogleCookie,
  issueCookie,
  issueAdminCookie,
  ADMIN_EMAIL,
  TEST_CAREER,
} from '../test/http.js';
import { appMeta, ownerSeasonRecords, careers, retiredNumbers } from '../db/schema.js';
import { listOwnHof } from '../db/repos/careers.js';
import { OwnerSummaryResponseSchema } from '@offside/contracts';

describe('compact owner summary', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });
  it('requires a session and keeps account reads private', async () => {
    const app = createApp();
    expect((await app.request('/v1/owner/summary', {}, ctx.env)).status).toBe(401);
    const { cookie } = await issueCookie(ctx);
    const res = await app.request('/v1/owner/summary', { headers: { Cookie: cookie } }, ctx.env);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const status = await app.request(
      '/v1/owner/recap-status',
      { headers: { Cookie: cookie } },
      ctx.env,
    );
    expect(status.headers.get('cache-control')).toBe('private, no-store');
    expect(((await status.json()) as { data: unknown }).data).toEqual({ tier: null });
    expect(((await res.json()) as { data: unknown }).data).toEqual({
      linked: false,
      admin: false,
      tier: null,
      tiers: [],
      entries: [],
    });
  });
  it('preserves private/hidden retired records, season and number semantics without full player payloads or another owner records', async () => {
    const me = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const now = new Date().toISOString();
    await ctx.db.insert(careers).values([
      {
        id: 'one',
        profileId: me.profileId,
        ...TEST_CAREER,
        pos: 'FW',
        foot: '오른발',
        status: 'retired',
        createdAt: now,
        updatedAt: now,
        retiredAt: now,
        legendScore: 80,
        hidden: 1,
        serviceSeason: 1,
      },
      {
        id: 'old',
        profileId: me.profileId,
        ...TEST_CAREER,
        pos: 'FW',
        foot: '오른발',
        status: 'retired',
        createdAt: now,
        updatedAt: now,
        retiredAt: now,
        legendScore: 20,
        serviceSeason: 0,
      },
      {
        id: 'active',
        profileId: me.profileId,
        ...TEST_CAREER,
        pos: 'FW',
        foot: '오른발',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        legendScore: 90,
      },
      {
        id: 'other',
        profileId: other.profileId,
        ...TEST_CAREER,
        pos: 'FW',
        foot: '오른발',
        status: 'retired',
        createdAt: now,
        updatedAt: now,
        retiredAt: now,
        legendScore: 500,
      },
    ]);
    await ctx.db.insert(retiredNumbers).values({
      careerId: 'one',
      season: 1,
      clubId: 'test',
      number: 9,
      club: 'test',
      score: 80,
      seq: 1,
      grantedAt: now,
    });
    const res = await createApp().request(
      '/v1/owner/summary',
      { headers: { Cookie: me.cookie } },
      ctx.env,
    );
    expect(res.status).toBe(200);
    const data = OwnerSummaryResponseSchema.parse(((await res.json()) as { data: unknown }).data);
    const full = await listOwnHof(ctx.db, me.profileId);
    expect(data.entries).toEqual(
      full.map((e) => ({
        id: e.id,
        season: e.season ?? null,
        legendScore: e.legendScore,
        retiredNumber: e.retiredNumber?.number ?? null,
      })),
    );
    expect(data.entries).toHaveLength(2);
    expect(data.admin).toBe(false);
  });
  it('returns finalized season tiers newest first, excluding pending, malformed, active and other-owner records', async () => {
    const who = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const old = seasonSchedule();
    try {
      applySeasonSchedule([
        { id: 1, startsAt: old[0]!.startsAt, endsAt: '2026-11-01T00:00:00Z', retireAt: 45 },
        { id: 2, startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', retireAt: 45 },
        { id: 3, startsAt: '2026-12-01T00:00:00Z', endsAt: '2027-01-01T00:00:00Z', retireAt: 45 },
        { id: 4, startsAt: '2027-01-01T00:00:00Z', endsAt: '2027-02-01T00:00:00Z', retireAt: 45 },
        { id: 5, startsAt: '2027-02-01T00:00:00Z', endsAt: null, retireAt: 45 },
      ]);
      for (const season of [0, 1, 2, 3, 4, 5]) {
        await ctx.db.insert(ownerSeasonRecords).values({
          profileId: who.profileId,
          season,
          players: 0,
          retired: 0,
          retiredNumbers: 0,
          wallOfHonor: 0,
          firsts: 0,
          achScore: 1480,
          createdAt: '2027-02-01T00:00:00Z',
        });
        await ctx.db.insert(appMeta).values({
          key: `season-close:${season}`,
          value:
            season === 3 ? 'invalid' : JSON.stringify({ step: season === 2 ? 'ranks' : 'done' }),
        });
      }
      expect(
        await ownerTierHistoryOfProfile(ctx.db, who.profileId, '2027-02-02T00:00:00Z'),
      ).toEqual([
        { season: 4, tier: 'gold' },
        { season: 1, tier: 'gold' },
        { season: 0, tier: 'gold' },
      ]);
      expect(
        await ownerTierHistoryOfProfile(ctx.db, other.profileId, '2027-02-02T00:00:00Z'),
      ).toEqual([]);
    } finally {
      applySeasonSchedule(old);
    }
  });
  it('uses the same admin identity as profile editing', async () => {
    ctx.env.ADMIN_EMAILS = ADMIN_EMAIL;
    const { cookie } = await issueAdminCookie(ctx);
    const res = await createApp().request(
      '/v1/owner/summary',
      { headers: { Cookie: cookie } },
      ctx.env,
    );
    expect(((await res.json()) as { data: { admin: boolean } }).data.admin).toBe(true);
  });
});
