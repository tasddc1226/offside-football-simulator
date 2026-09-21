import {
  CompetitionActionResponseSchema,
  CompetitionDailyResponseSchema,
  CompetitionHistoryResponseSchema,
  CompetitionWeeklyResponseSchema,
  ProfileSchema,
  successEnvelope,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { competitionActions, competitionEntries, sessions } from '../db/schema.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';
import { moveCareersAndRebind } from '../profile/merge.js';
import { issueSession, sessionCookie } from '../auth/session.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const app = createApp();
const KST_MIDDAY = '2026-09-21T03:00:00.000Z';
const actions = ['PRESS_HIGH', 'SHARPEN', 'PLAY_THROUGH'] as const;
let ctx: TestD1;

async function account() {
  const response = await app.request('/v1/profile', {}, ctx.env);
  return { id: successEnvelope(ProfileSchema).parse(await response.json()).data.id, cookie: response.headers.get('set-cookie')!.split(';')[0]! };
}
function request(cookie: string, method: string, path: string, body?: unknown, key = crypto.randomUUID()) {
  return app.request(path, { method, headers: { Cookie: cookie, Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'Idempotency-Key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, ctx.env);
}
async function submitAll(cookie: string, selected: readonly string[] = actions, startRevision = 0) {
  let revision = startRevision;
  let response: Response | undefined;
  for (const [index, actionId] of selected.entries()) {
    response = await request(cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId, expectedRevision: revision }, `action-${index}-${crypto.randomUUID()}`);
    if (response.status >= 400) return response;
    revision += 1;
  }
  return response!;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(KST_MIDDAY));
  ctx = await createTestD1();
});
afterEach(async () => { vi.useRealTimers(); await ctx.dispose(); });

describe('daily match competition and weekly public projection', () => {
  it('provisions each KST day atomically, rotates positions, and preserves old definitions', async () => {
    const a = await account();
    const first = successEnvelope(CompetitionDailyResponseSchema).parse(await (await request(a.cookie, 'GET', '/v1/competition/daily')).json()).data;
    expect(first.challenge.rulesetVersion).toBe('3.3.0');
    expect(first.challenge.contentPackVersion).toBe('0.12.0');
    expect(first.challenge.scenario.steps[0]!.choices[0]).not.toHaveProperty('points');
    expect(first.challenge.scenario.steps[0]!.choices[0]).not.toHaveProperty('outcome');
    expect((await request(a.cookie, 'GET', '/v1/competition/daily?dayKey=2026-09-22')).status).toBe(409);
    vi.setSystemTime(new Date('2026-09-22T03:00:00.000Z'));
    const second = successEnvelope(CompetitionDailyResponseSchema).parse(await (await request(a.cookie, 'GET', '/v1/competition/daily')).json()).data;
    expect(second.challenge.dayKey).toBe('2026-09-22');
    expect(second.challenge.scenario.position).not.toBe(first.challenge.scenario.position);
    const { kstWeekKey } = await import('./competition.js');
    expect(kstWeekKey('2026-09-21')).toBe('2026-09-21');
    expect(kstWeekKey('2026-09-22')).toBe('2026-09-21');
    expect((await request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[0], expectedRevision: 0 }, 'stale-day-action')).status).toBe(409);
    vi.setSystemTime(new Date('2026-09-23T03:00:00.000Z'));
    const past = successEnvelope(CompetitionDailyResponseSchema).parse(await (await request(a.cookie, 'GET', '/v1/competition/daily?dayKey=2026-09-21')).json()).data;
    expect(past.challenge.id).toBe(first.challenge.id);
  });

  it('accepts only actionId plus expectedRevision and derives final evidence from actual match', async () => {
    const a = await account();
    const forged = await request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[0], expectedRevision: 0, score: 999 }, 'forged-action');
    expect(forged.status).toBe(400);
    const first = await request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[0], expectedRevision: 0 }, 'first-action');
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { data: unknown };
    expect(CompetitionActionResponseSchema.parse(firstBody.data).entry.revision).toBe(1);
    const stale = await request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[1], expectedRevision: 0 }, 'stale-action');
    expect(stale.status).toBe(409);
    const final = await submitAll(a.cookie, [actions[1], actions[2]], 1);
    const finalBody = (await final.json()) as { data: unknown };
    const result = CompetitionActionResponseSchema.parse(finalBody.data);
    expect(final.status).toBe(201);
    expect(result.entry.verificationStatus).toBe('VERIFIED');
    expect(result.entry.proof.method).toBe('SERVER_MATCH');
    expect(result.entry.resultHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await ctx.db.select().from(competitionActions)).toHaveLength(3);
  });

  it('allows one body-bound action replay but only one concurrent revision advances', async () => {
    const a = await account();
    const responses = await Promise.all([
      request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[0], expectedRevision: 0 }, 'same-action-key'),
      request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[0], expectedRevision: 0 }, 'same-action-key'),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 200]);
    expect(await ctx.db.select().from(competitionActions)).toHaveLength(1);
    const daily = successEnvelope(CompetitionDailyResponseSchema).parse(await (await request(a.cookie, 'GET', '/v1/competition/daily')).json()).data;
    expect(daily.entry?.revision).toBe(1);
  });

  it('allows only one of different actions with different keys at one revision', async () => {
    const a = await account();
    const responses = await Promise.all([
      request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[0], expectedRevision: 0 }, 'different-key-a'),
      request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: 'HOLD_SHAPE', expectedRevision: 0 }, 'different-key-b'),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const rows = await ctx.db.select().from(competitionActions);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.responseJson)).toHaveProperty('entry.revision', 1);
  });

  it('rejects a reused idempotency key with a different body', async () => {
    const a = await account();
    const first = await request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[0], expectedRevision: 0 }, 'same-key-body');
    const second = await request(a.cookie, 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[1], expectedRevision: 0 }, 'same-key-body');
    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(await ctx.db.select().from(competitionActions)).toHaveLength(1);
  });

  it('keeps private history isolated, supports safe alias opt-in/withdrawal, and merge/delete', async () => {
    const from = await account();
    const to = await account();
    await submitAll(from.cookie);
    const foreign = successEnvelope(CompetitionDailyResponseSchema).parse(await (await request(to.cookie, 'GET', '/v1/competition/daily')).json()).data;
    expect(foreign.entry).toBeNull();
    expect(successEnvelope(CompetitionWeeklyResponseSchema).parse(await (await app.request('/v1/competition/weekly', {}, ctx.env)).json()).data.rows).toHaveLength(0);
    await request(from.cookie, 'PUT', '/v1/competition/leaderboard/visibility', { publicOptIn: true }, 'visibility-on');
    const weekly = successEnvelope(CompetitionWeeklyResponseSchema).parse(await (await app.request('/v1/competition/weekly', {}, ctx.env)).json()).data;
    expect(weekly.rows).toHaveLength(1);
    expect(JSON.stringify(weekly)).not.toContain(from.id);
    expect(weekly.rows[0]!.proof.method).toBe('SERVER_MATCH');
    await request(from.cookie, 'PUT', '/v1/competition/leaderboard/visibility', { publicOptIn: false }, 'visibility-off');
    expect(successEnvelope(CompetitionWeeklyResponseSchema).parse(await (await app.request('/v1/competition/weekly', {}, ctx.env)).json()).data.rows).toHaveLength(0);
    const history = successEnvelope(CompetitionHistoryResponseSchema).parse(await (await request(from.cookie, 'GET', '/v1/competition/history')).json()).data;
    expect(history.entries).toHaveLength(1);
    const [fromSession] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, from.id));
    await moveCareersAndRebind(ctx.db, { fromProfileId: from.id, toProfileId: to.id, sessionId: fromSession!.id, now: KST_MIDDAY });
    expect(await ctx.db.select().from(competitionEntries).where(eq(competitionEntries.ownerProfileId, to.id))).toHaveLength(1);
    const [toSession] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, to.id));
    const confirm = await issueDeleteConfirmToken({ sessionId: toSession!.id, sessionTokenHash: toSession!.tokenHash, now: KST_MIDDAY });
    await executeProfileDeletion(ctx.db, { profileId: to.id, sessionId: toSession!.id, sessionTokenHash: toSession!.tokenHash, confirmToken: confirm.confirmToken, now: KST_MIDDAY });
    expect(await ctx.db.select().from(competitionEntries).where(eq(competitionEntries.ownerProfileId, to.id))).toHaveLength(0);
    expect(await ctx.db.select().from(competitionActions)).toHaveLength(0);
  });

  it('keeps the target entry when both profiles entered the same day and revokes stale source sessions', async () => {
    const from = await account();
    const to = await account();
    await submitAll(from.cookie, [actions[0]]);
    await submitAll(to.cookie, ['HOLD_SHAPE']);
    const oldSession = await issueSession(ctx.db, { profileId: from.id, channel: 'web', now: KST_MIDDAY });
    const [fromSession] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, from.id));
    await moveCareersAndRebind(ctx.db, { fromProfileId: from.id, toProfileId: to.id, sessionId: fromSession!.id, now: KST_MIDDAY });
    const owned = await ctx.db.select().from(competitionEntries).where(eq(competitionEntries.ownerProfileId, to.id));
    expect(owned).toHaveLength(1);
    expect(JSON.parse(owned[0]!.actionIdsJson)).toEqual(['HOLD_SHAPE']);
    expect(await ctx.db.select().from(competitionEntries).where(eq(competitionEntries.ownerProfileId, from.id))).toHaveLength(0);
    const stale = await request(sessionCookie(oldSession.token), 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: actions[2], expectedRevision: 1 }, 'stale-source-after-merge');
    expect(stale.status).toBe(401);
    expect(await ctx.db.select().from(competitionEntries)).toHaveLength(1);
  });

  it('does not resurrect a deleted entry when an old action request arrives', async () => {
    const a = await account();
    await submitAll(a.cookie, [actions[0]]);
    const stale = await issueSession(ctx.db, { profileId: a.id, channel: 'web', now: KST_MIDDAY });
    const [active] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, a.id));
    const confirm = await issueDeleteConfirmToken({ sessionId: active!.id, sessionTokenHash: active!.tokenHash, now: KST_MIDDAY });
    await executeProfileDeletion(ctx.db, { profileId: a.id, sessionId: active!.id, sessionTokenHash: active!.tokenHash, confirmToken: confirm.confirmToken, now: KST_MIDDAY });
    const response = await request(sessionCookie(stale.token), 'POST', '/v1/competition/challenges/daily-2026-09-21/actions', { actionId: 'HOLD_SHAPE', expectedRevision: 1 }, 'deleted-profile-action');
    expect(response.status).toBe(401);
    expect(await ctx.db.select().from(competitionEntries)).toHaveLength(0);
    expect(await ctx.db.select().from(competitionActions)).toHaveLength(0);
  });

  it('keeps a shared rank for three equal verified scores', async () => {
    const accounts = await Promise.all([account(), account(), account()]);
    for (const [index, user] of accounts.entries()) {
      await submitAll(user.cookie);
      await request(user.cookie, 'PUT', '/v1/competition/leaderboard/visibility', { publicOptIn: true }, `tie-visibility-${index}`);
    }
    const weekly = successEnvelope(CompetitionWeeklyResponseSchema).parse(await (await app.request('/v1/competition/weekly', {}, ctx.env)).json()).data;
    expect(weekly.rows).toHaveLength(3);
    expect(weekly.rows.map((row) => row.rank)).toEqual([1, 1, 1]);
  });
});
