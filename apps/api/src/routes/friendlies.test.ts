import {
  FriendlyHistorySchema,
  FriendlyReceiptSchema,
  ProfileSchema,
  PutCareerBodySchema,
  successEnvelope,
} from '@offside/contracts';
import { loadRuleset } from '@offside/content';
import {
  canonicalize,
  simulate,
  simulateFriendly,
  type Command,
  type DomainSnapshot,
  type JsonValue,
} from '@offside/domain';
import { career06SettledEngineCommands } from '@offside/fixtures';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  careerArchives,
  careers,
  friendlyMatches,
  lockerTeams,
  sessions,
  snapshots,
} from '../db/schema.js';
import { deleteCareerCascade } from '../db/repos/careers.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import { applySync } from '../sync/apply-sync.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { moveCareersAndRebind, moveCareersAndRotateWebSession } from '../profile/merge.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';

const app = createApp();
const now = '2026-09-21T00:00:00.000Z';
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
async function source(owner: string) {
  let snapshot: DomainSnapshot | null = null;
  const commands: Record<string, unknown>[] = [];
  const versions = { rulesetVersion: '1.1.0', contentPackVersion: '0.3.0' };
  function run(command: Command) {
    const commandId = `source-${commands.length + 1}`;
    const result = simulate({
      snapshot,
      command: { ...command, commandId, expectedRevision: snapshot?.revision ?? 0 },
      ruleset: loadRuleset('1.1.0'),
      ...versions,
    });
    if (!result.ok) throw new Error(result.error.message);
    snapshot = result.snapshot;
    commands.push({
      revision: snapshot.revision,
      commandId,
      commandType: command.type,
      payload: command.payload,
      resultHash: snapshot.stateHash,
    });
  }
  for (const command of career06SettledEngineCommands(() => 'unused'))
    run(
      command.type === 'CREATE_CAREER'
        ? { ...command, payload: { ...command.payload, ...versions } }
        : command,
    );
  if ((snapshot as DomainSnapshot | null)?.state.pending !== null)
    run({ type: 'REJECT_OFFER', payload: { offerId: null } });
  run({ type: 'RETIRE', payload: { choice: 'RETIRE' } });
  const final = snapshot as DomainSnapshot | null;
  if (!final) throw new Error('Missing retirement');
  await applySync(ctx.db, {
    profileId: owner,
    careerId: final.state.careerId,
    now,
    body: PutCareerBodySchema.parse({
      baseRevision: 0,
      snapshot: {
        ...final,
        rngState: final.state.rngState,
        state: canonicalize(final.state as unknown as JsonValue),
      },
      commands,
      createdServiceSeasonId: 'test-season',
      ...versions,
    }),
  });
  return final.state.careerId;
}
async function team(owner: string, id: string | null) {
  const teamId = crypto.randomUUID();
  await ctx.db
    .insert(lockerTeams)
    .values({
      id: teamId,
      ownerProfileId: owner,
      name: '은퇴팀',
      formation: '4-3-3',
      lineupJson: JSON.stringify(Array.from({ length: 18 }, (_, i) => (i === 9 ? id : null))),
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
  return teamId;
}
async function start(
  cookie: string,
  teamId: string,
  key = crypto.randomUUID(),
  input = { revision: 1, tactic: 'BALANCED' },
) {
  return request(cookie, 'POST', `/v1/locker-room/teams/${teamId}/friendlies`, input, key);
}
async function receipt(response: Response) {
  const json: unknown = await response.json();
  expect(response.status, JSON.stringify(json)).toBe(201);
  return successEnvelope(FriendlyReceiptSchema).parse(json).data;
}
beforeEach(async () => {
  ctx = await createTestD1();
  await upsertServiceSeason(ctx.db, {
    id: 'test-season',
    name: 'test',
    status: 'ACTIVE',
    startsAt: now,
    endsAt: null,
    rulesetVersion: '1.1.0',
    contentPackVersion: '0.3.0',
    challengeSetId: 'test',
  });
});
afterEach(async () => {
  await ctx.dispose();
});
describe('owned retired-player friendly matches', () => {
  it('runs natural retirement archive with basics, immutable source and frozen reload after team/career deletion', async () => {
    const owner = await account();
    const outsider = await account();
    const careerId = await source(owner.id);
    const teamId = await team(owner.id, careerId);
    const before = {
      snapshots: await ctx.db.select().from(snapshots),
      archives: await ctx.db.select().from(careerArchives),
      careers: await ctx.db.select().from(careers),
    };
    const key = crypto.randomUUID();
    const result = await receipt(await start(owner.cookie, teamId, key));
    expect(result.result).toEqual(simulateFriendly(result.input));
    expect(result.result.home.filter((p) => p.basic)).toHaveLength(10);
    expect(JSON.stringify(result)).not.toContain('source.state');
    expect(result.input.lineup[9]).toHaveProperty('archiveHash');
    expect(await receipt(await start(owner.cookie, teamId, key))).toEqual(result);
    expect({
      snapshots: await ctx.db.select().from(snapshots),
      archives: await ctx.db.select().from(careerArchives),
      careers: await ctx.db.select().from(careers),
    }).toEqual(before);
    expect(
      (await request(outsider.cookie, 'GET', `/v1/locker-room/friendlies/${result.id}`)).status,
    ).toBe(404);
    expect((await start(outsider.cookie, teamId)).status).toBe(404);
    const detail = await request(owner.cookie, 'GET', `/v1/locker-room/friendlies/${result.id}`);
    expect(detail.headers.get('Cache-Control')).toBe('no-store');
    expect(successEnvelope(FriendlyReceiptSchema).parse(await detail.json()).data).toEqual(result);
    await ctx.db
      .update(lockerTeams)
      .set({ revision: 2, formation: '3-5-2' })
      .where(eq(lockerTeams.id, teamId));
    expect((await start(owner.cookie, teamId)).status).toBe(409);
    await ctx.db.delete(lockerTeams).where(eq(lockerTeams.id, teamId));
    await deleteCareerCascade(ctx.db, careerId);
    const history = successEnvelope(FriendlyHistorySchema).parse(
      await (await request(owner.cookie, 'GET', '/v1/locker-room/friendlies')).json(),
    ).data;
    expect(history.matches).toEqual([result]);
    expect(simulateFriendly(history.matches[0]!.input)).toEqual(result.result);
    expect(await receipt(await start(owner.cookie, teamId, key))).toEqual(result);
  });
  it('parallel same-key starts produce one row; changed body is rejected', async () => {
    const owner = await account();
    const careerId = await source(owner.id);
    const teamId = await team(owner.id, careerId);
    const key = crypto.randomUUID();
    const responses = await Promise.all([
      start(owner.cookie, teamId, key),
      start(owner.cookie, teamId, key),
    ]);
    const results = await Promise.all(responses.map(receipt));
    expect(results[0]).toEqual(results[1]);
    expect(await ctx.db.select().from(friendlyMatches)).toHaveLength(1);
    expect((await start(owner.cookie, teamId, key, { revision: 1, tactic: 'PRESS' })).status).toBe(
      409,
    );
  });
  it('rejects empty, active, duplicate, foreign and corrupted retirement sources; archived retirement works', async () => {
    const owner = await account();
    const careerId = await source(owner.id);
    const teamId = await team(owner.id, careerId);
    expect((await start(owner.cookie, await team(owner.id, null))).status).toBe(422);
    await ctx.db.update(careers).set({ status: 'ACTIVE' }).where(eq(careers.id, careerId));
    expect((await start(owner.cookie, teamId)).status).toBe(422);
    await ctx.db.update(careers).set({ status: 'ARCHIVED' }).where(eq(careers.id, careerId));
    await receipt(await start(owner.cookie, teamId));
    const outsider = await account();
    expect((await start(outsider.cookie, await team(outsider.id, careerId))).status).toBe(422);
    await ctx.db
      .update(lockerTeams)
      .set({
        lineupJson: JSON.stringify(
          Array.from({ length: 18 }, (_, i) => (i === 8 || i === 9 ? careerId : null)),
        ),
      })
      .where(eq(lockerTeams.id, teamId));
    expect((await start(owner.cookie, teamId)).status).toBe(400);
    await ctx.db
      .update(careerArchives)
      .set({ archiveJson: '{}' })
      .where(eq(careerArchives.careerId, careerId));
    expect((await start(owner.cookie, await team(owner.id, careerId))).status).toBe(422);
  });
  it.each(['rebind', 'rotate'] as const)(
    'moves private history with %s merge and erases all rows on soft profile deletion',
    async (kind) => {
      const from = await account();
      const to = await account();
      const careerId = await source(from.id);
      const teamId = await team(from.id, careerId);
      const result = await receipt(await start(from.cookie, teamId));
      const [session] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, from.id));
      const merge = { fromProfileId: from.id, toProfileId: to.id, sessionId: session!.id, now };
      if (kind === 'rebind') await moveCareersAndRebind(ctx.db, merge);
      else await moveCareersAndRotateWebSession(ctx.db, merge);
      const response = await request(to.cookie, 'GET', `/v1/locker-room/friendlies/${result.id}`);
      expect(response.status).toBe(200);
      const [targetSession] = await ctx.db
        .select()
        .from(sessions)
        .where(eq(sessions.profileId, to.id));
      const context = {
        profileId: to.id,
        sessionId: targetSession!.id,
        sessionTokenHash: targetSession!.tokenHash,
        now,
      };
      const confirm = await issueDeleteConfirmToken(context);
      await executeProfileDeletion(ctx.db, { ...context, confirmToken: confirm.confirmToken });
      expect(await ctx.db.select().from(friendlyMatches)).toEqual([]);
    },
  );
  it('rejects unauthenticated, malformed, extra-field and missing-key requests before starting a match', async () => {
    expect((await request('', 'GET', '/v1/locker-room/friendlies')).status).toBe(401);
    expect((await start('', 'unknown')).status).toBe(401);
    const owner = await account();
    const path = '/v1/locker-room/teams/unknown/friendlies';
    expect(
      (await request(owner.cookie, 'POST', path, { revision: 1, tactic: 'BALANCED', score: 99 }))
        .status,
    ).toBe(400);
    expect(
      (await request(owner.cookie, 'POST', path, { revision: 1, tactic: 'BALANCED' }, '')).status,
    ).toBe(422);
    expect(
      (
        await app.request(
          path,
          {
            method: 'POST',
            headers: {
              Cookie: owner.cookie,
              Origin: 'http://localhost:5173',
              'Content-Type': 'application/json',
              'Idempotency-Key': 'valid-key-123',
            },
            body: '{',
          },
          ctx.env,
        )
      ).status,
    ).toBe(422);
    expect(await ctx.db.select().from(friendlyMatches)).toEqual([]);
  });
});
