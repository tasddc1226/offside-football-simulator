import {
  CompetitionDailyResponseSchema,
  CompetitionEntrySchema,
  CompetitionWeeklyResponseSchema,
  ProfileSchema,
  successEnvelope,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { competitionChallengeVersions, competitionEntries, sessions } from '../db/schema.js';
import { moveCareersAndRebind } from '../profile/merge.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const app = createApp();
const KST_MIDDAY = '2026-09-21T03:00:00.000Z';
let ctx: TestD1;

async function account() {
  const response = await app.request('/v1/profile', {}, ctx.env);
  return {
    id: successEnvelope(ProfileSchema).parse(await response.json()).data.id,
    cookie: response.headers.get('set-cookie')!.split(';')[0]!,
  };
}
function request(
  cookie: string,
  method: string,
  path: string,
  body?: unknown,
  key = crypto.randomUUID(),
) {
  return app.request(
    path,
    {
      method,
      headers: {
        Cookie: cookie,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    ctx.env,
  );
}
const actions = ['PRESS', 'FIRST_TOUCH', 'COMPACT'];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(KST_MIDDAY));
  ctx = await createTestD1();
});
afterEach(async () => {
  vi.useRealTimers();
  await ctx.dispose();
});

describe('daily authored competition and weekly public projection', () => {
  it('uses KST boundaries and pins immutable 3.3/.12 challenge proof', async () => {
    const a = await account();
    const response = await request(a.cookie, 'GET', '/v1/competition/daily');
    expect(response.status).toBe(200);
    const daily = successEnvelope(CompetitionDailyResponseSchema).parse(await response.json()).data;
    expect(daily.challenge.id).toBe('daily-2026-09-21');
    expect(daily.challenge.rulesetVersion).toBe('3.3.0');
    expect(daily.challenge.contentPackVersion).toBe('0.12.0');
    expect(daily.entry).toBeNull();
    const { kstDayKey } = await import('./competition.js');
    expect(kstDayKey(new Date('2026-09-20T14:59:59.999Z'))).toBe('2026-09-20');
    expect(kstDayKey(new Date('2026-09-20T15:00:00.000Z'))).toBe('2026-09-21');
  });

  it('replays allowed actions on the server, rejects forged score and enforces one entry atomically', async () => {
    const a = await account();
    const key = 'daily-entry-key';
    const forged = await request(
      a.cookie,
      'POST',
      '/v1/competition/challenges/daily-2026-09-21/entries',
      { actionIds: actions, publicOptIn: false, score: 999 },
      key,
    );
    expect(forged.status).toBe(400);
    const responses = await Promise.all([
      request(
        a.cookie,
        'POST',
        '/v1/competition/challenges/daily-2026-09-21/entries',
        { actionIds: actions, publicOptIn: false },
        key,
      ),
      request(
        a.cookie,
        'POST',
        '/v1/competition/challenges/daily-2026-09-21/entries',
        { actionIds: actions, publicOptIn: false },
        key,
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const entries = await Promise.all(
      responses.map(async (response) => (await response.json()) as { data: unknown }),
    );
    expect(entries[0]!.data).toEqual(entries[1]!.data);
    expect(CompetitionEntrySchema.parse(entries[0]!.data).verificationStatus).toBe('VERIFIED');
    expect(await ctx.db.select().from(competitionEntries)).toHaveLength(1);
    expect(
      (
        await request(
          a.cookie,
          'POST',
          '/v1/competition/challenges/daily-2026-09-21/entries',
          { actionIds: actions, publicOptIn: false },
          'different-key',
        )
      ).status,
    ).toBe(409);
    const daily = successEnvelope(CompetitionDailyResponseSchema).parse(
      await (await request(a.cookie, 'GET', '/v1/competition/daily')).json(),
    ).data;
    expect(daily.entry?.verificationStatus).toBe('VERIFIED');
    expect(daily.entry?.proof.method).toBe('SERVER_REPLAY');
    expect(daily.entry?.score).toBe(110);
  });

  it('keeps entries private by default, supports opt-in withdrawal, and exposes only safe proof rows', async () => {
    const a = await account();
    const b = await account();
    const submit = await request(
      a.cookie,
      'POST',
      '/v1/competition/challenges/daily-2026-09-21/entries',
      { actionIds: actions, publicOptIn: false },
    );
    expect(submit.status).toBe(201);
    const foreignDaily = successEnvelope(CompetitionDailyResponseSchema).parse(
      await (await request(b.cookie, 'GET', '/v1/competition/daily')).json(),
    ).data;
    expect(foreignDaily.entry).toBeNull();
    expect(
      successEnvelope(CompetitionWeeklyResponseSchema).parse(
        await (await app.request('/v1/competition/weekly', {}, ctx.env)).json(),
      ).data.rows,
    ).toHaveLength(0);
    expect(
      (
        await request(a.cookie, 'PUT', '/v1/competition/leaderboard/visibility', {
          publicOptIn: true,
        })
      ).status,
    ).toBe(200);
    const weekly = successEnvelope(CompetitionWeeklyResponseSchema).parse(
      await (await app.request('/v1/competition/weekly', {}, ctx.env)).json(),
    ).data;
    expect(weekly.rows).toHaveLength(1);
    expect(weekly.rows[0]).toMatchObject({
      score: 110,
      challengeDays: 1,
      proof: { method: 'SERVER_REPLAY', rulesetVersion: '3.3.0', contentPackVersion: '0.12.0' },
    });
    expect(JSON.stringify(weekly)).not.toContain(a.id);
    expect(JSON.stringify(weekly)).not.toContain('PRESS');
    expect(
      (
        await request(a.cookie, 'PUT', '/v1/competition/leaderboard/visibility', {
          publicOptIn: false,
        })
      ).status,
    ).toBe(200);
    expect(
      successEnvelope(CompetitionWeeklyResponseSchema).parse(
        await (await app.request('/v1/competition/weekly', {}, ctx.env)).json(),
      ).data.rows,
    ).toHaveLength(0);
  });

  it('rejects stale challenge versions after the KST day changes', async () => {
    const [today] = await ctx.db
      .select()
      .from(competitionChallengeVersions)
      .where(eq(competitionChallengeVersions.id, 'daily-2026-09-21'));
    await ctx.db.insert(competitionChallengeVersions).values({
      ...today!,
      id: 'daily-2026-09-20',
      dayKey: '2026-09-20',
      weekKey: '2026-09-14',
      startsAt: '2026-09-19T15:00:00.000Z',
      endsAt: '2026-09-20T15:00:00.000Z',
    });
    const a = await account();
    expect(
      (
        await request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-20/entries', {
          actionIds: actions,
          publicOptIn: false,
        })
      ).status,
    ).toBe(409);
  });

  it('moves entries safely on merge and removes them on profile deletion', async () => {
    const from = await account();
    const to = await account();
    expect(
      (
        await request(from.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/entries', {
          actionIds: actions,
          publicOptIn: true,
        })
      ).status,
    ).toBe(201);
    const [session] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, from.id));
    await moveCareersAndRebind(ctx.db, {
      fromProfileId: from.id,
      toProfileId: to.id,
      sessionId: session!.id,
      now: KST_MIDDAY,
    });
    expect(
      await ctx.db
        .select()
        .from(competitionEntries)
        .where(eq(competitionEntries.ownerProfileId, to.id)),
    ).toHaveLength(1);
    const [targetSession] = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.profileId, to.id));
    const confirm = await issueDeleteConfirmToken({
      sessionId: targetSession!.id,
      sessionTokenHash: targetSession!.tokenHash,
      now: KST_MIDDAY,
    });
    await executeProfileDeletion(ctx.db, {
      profileId: to.id,
      sessionId: targetSession!.id,
      sessionTokenHash: targetSession!.tokenHash,
      confirmToken: confirm.confirmToken,
      now: KST_MIDDAY,
    });
    expect(
      await ctx.db
        .select()
        .from(competitionEntries)
        .where(eq(competitionEntries.ownerProfileId, to.id)),
    ).toHaveLength(0);
  });
});
