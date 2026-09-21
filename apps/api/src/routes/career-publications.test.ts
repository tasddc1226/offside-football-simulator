import {
  CareerArticleSchema,
  GetCareerResponseSchema,
  ProfileSchema,
  PutCareerBodySchema,
  successEnvelope,
} from '@offside/contracts';
import {
  loadRuleset,
  loadContentPack,
  selectEligibleEvents,
  selectChapterCandidates,
} from '@offside/content';
import {
  canonicalize,
  type JsonValue,
  simulate,
  type DomainSnapshot,
  type Command,
} from '@offside/domain';
import { career06SettledEngineCommands } from '@offside/fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import {
  careerArchives,
  careers,
  careerChallengeAdmissions,
  commandLog,
  sessions,
} from '../db/schema.js';
import { applySync } from '../sync/apply-sync.js';
import { moveCareersAndRebind } from '../profile/merge.js';
import { deleteCareerCascade } from '../db/repos/careers.js';
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
  let initial: DomainSnapshot | null = null;
  const records: Record<string, unknown>[] = [];
  const ruleset = loadRuleset('1.1.0');
  const versions = { rulesetVersion: '1.1.0', contentPackVersion: '0.3.0' };
  function run(command: Command) {
    const commandId = `source-${records.length + 1}`;
    const result = simulate({
      snapshot,
      command: { ...command, commandId, expectedRevision: snapshot?.revision ?? 0 },
      ruleset,
      ...versions,
    });
    if (!result.ok) throw new Error(`${command.type}: ${result.error.message}`);
    snapshot = result.snapshot;
    if (command.type === 'CONFIRM_PLAYER') initial = snapshot;
    records.push({
      revision: snapshot.revision,
      commandId,
      commandType: command.type,
      payload: command.payload,
      resultHash: snapshot.stateHash,
    });
  }
  for (const command of career06SettledEngineCommands(() => 'unused')) {
    run(
      command.type === 'CREATE_CAREER'
        ? { ...command, payload: { ...command.payload, ...versions, simulationMode: 'CHAPTER' } }
        : command,
    );
  }
  if ((snapshot as DomainSnapshot | null)?.state.pending !== null)
    run({ type: 'REJECT_OFFER', payload: { offerId: null } });
  run({ type: 'RETIRE', payload: { choice: 'RETIRE' } });
  const final = snapshot as DomainSnapshot | null;
  if (!final) throw new Error('No source snapshot');
  const body = PutCareerBodySchema.parse({
    baseRevision: 0,
    snapshot: {
      ...final,
      rngState: final.state.rngState,
      state: canonicalize(final.state as unknown as JsonValue),
    },
    commands: records,
    createdServiceSeasonId: 'source-season',
    ...versions,
  });
  await applySync(ctx.db, { profileId: owner, careerId: final.state.careerId, body, now });
  return { id: final.state.careerId, snapshot: final, initial: initial as DomainSnapshot | null };
}
async function publish(cookie: string, id: string) {
  const response = await request(cookie, 'POST', `/v1/careers/${id}/publication`, {
    consent: true,
  });
  const json: unknown = await response.json();
  expect(response.status, JSON.stringify(json)).toBe(200);
  return successEnvelope(CareerArticleSchema).parse(json).data;
}
beforeEach(async () => {
  ctx = await createTestD1();
  ctx.env.ACTIVE_SERVICE_SEASON_ID = 'current-season';
  for (const [id, rulesetVersion, contentPackVersion] of [
    ['source-season', '1.1.0', '0.3.0'],
    ['current-season', '3.2.0', '0.11.0'],
  ])
    await upsertServiceSeason(ctx.db, {
      id: id!,
      name: id!,
      status: 'ACTIVE',
      startsAt: now,
      endsAt: null,
      rulesetVersion: rulesetVersion!,
      contentPackVersion: contentPackVersion!,
      challengeSetId: 'test',
    });
});
afterEach(async () => {
  await ctx.dispose();
});
describe('explicit public retirement articles and bound challenge admission', () => {
  it('publishes only owned archived facts with explicit consent and no private fields', async () => {
    const a = await account();
    const b = await account();
    const retired = await source(a.id);
    expect(
      (await request(b.cookie, 'POST', `/v1/careers/${retired.id}/publication`, { consent: true }))
        .status,
    ).toBe(404);
    expect(
      (await request(a.cookie, 'POST', `/v1/careers/${retired.id}/publication`, { consent: false }))
        .status,
    ).toBe(400);
    expect(
      (
        await request(a.cookie, 'POST', `/v1/careers/${retired.id}/publication`, {
          consent: true,
          goals: 999,
        })
      ).status,
    ).toBe(400);
    const article = await publish(a.cookie, retired.id);
    expect(article.seasons).toBe(retired.snapshot.state.seasonHistory.length);
    expect(article.initialPosition).toBe(retired.snapshot.state.player.profile!.preferredPosition);
    const publicResponse = await app.request(`/v1/articles/${article.id}`, {}, ctx.env);
    expect(publicResponse.headers.get('Cache-Control')).toBe('no-store');
    const text = await publicResponse.text();
    for (const forbidden of [
      'truePotential',
      'ownerProfileId',
      'source',
      'stateHash',
      'archiveHash',
      'commands',
      'recovery',
      retired.id,
      a.id,
    ])
      expect(text).not.toContain(forbidden);
  });
  it('fails closed on missing CREATE log and corrupt archive', async () => {
    const a = await account();
    const retired = await source(a.id);
    await ctx.db
      .update(careerArchives)
      .set({ archiveJson: '{}' })
      .where(eq(careerArchives.careerId, retired.id));
    expect(
      (await request(a.cookie, 'POST', `/v1/careers/${retired.id}/publication`, { consent: true }))
        .status,
    ).toBe(400);
    await ctx.db.delete(commandLog).where(eq(commandLog.careerId, retired.id));
    const missing = await request(a.cookie, 'POST', `/v1/careers/${retired.id}/publication`, { consent: true });
    expect(missing.status).toBe(400);
    expect(await missing.text()).toContain('최초 생성 기록');
  });
  it('atomically admits one independent career on parallel retries, preserves initial build and permits later sync after revoke', async () => {
    const a = await account();
    const b = await account();
    const retired = await source(a.id);
    const article = await publish(a.cookie, retired.id);
    const path = `/v1/articles/${article.id}/challenge`;
    expect((await request(b.cookie, 'POST', path, { name: '도전자', rulesetVersion: '99.0.0' })).status).toBe(400);
    const key = crypto.randomUUID();
    const results = await Promise.all([
      request(b.cookie, 'POST', path, { name: '새 도전자' }, key),
      request(b.cookie, 'POST', path, { name: '새 도전자' }, key),
    ]);
    for (const result of results) expect(result.status).toBe(201);
    const responses = await Promise.all(
      results.map(
        async (result) => successEnvelope(GetCareerResponseSchema).parse(await result.json()).data,
      ),
    );
    const start = responses[0]!;
    expect(start).toEqual(responses[1]);
    expect(await ctx.db.select().from(careerChallengeAdmissions)).toHaveLength(1);
    expect(await ctx.db.select().from(careers)).toHaveLength(2);
    expect(start.snapshot.careerId).not.toBe(retired.id);
    const initial = JSON.parse(start.snapshot.state) as DomainSnapshot['state'];
    expect(initial.player.draft).toEqual({
      ...retired.snapshot.state.player.draft,
      name: '새 도전자',
    });
    expect(initial.simulationMode).toBe('CHAPTER');
    expect(retired.snapshot.state.simulationMode).toBe('FAST');
    expect(initial.player.profile).toEqual({
      ...retired.initial!.state.player.profile,
      name: '새 도전자',
    });
    expect(initial.attributes).toEqual(retired.initial!.state.attributes);
    expect(initial.rngState).toEqual(retired.initial!.state.rngState);
    expect(initial.age).toBe(retired.initial!.state.age);
    expect(start.snapshot.rulesetVersion).toBe('1.1.0'); // current season is 3.2/0.11
    expect((await request(b.cookie, 'POST', path, { name: '다른 이름' }, key)).status).toBe(400);
    expect((await request(b.cookie, 'POST', path, { name: '가짜', seed: 'forged' })).status).toBe(
      400,
    );
    expect(
      (await request(a.cookie, 'DELETE', `/v1/careers/${retired.id}/publication`)).status,
    ).toBe(204);
    expect((await app.request(`/v1/articles/${article.id}`, {}, ctx.env)).status).toBe(404);
    expect((await request(b.cookie, 'POST', path, { name: '새 방문자' })).status).toBe(404);
    // Durable retry survives source revocation; it never creates another career.
    expect((await request(b.cookie, 'POST', path, { name: '새 도전자' }, key)).status).toBe(201);
    await deleteCareerCascade(ctx.db, retired.id);
    const pack = loadContentPack('0.3.0');
    const command: Command = {
      type: 'ADVANCE',
      payload: {
        eligibleEvents: selectEligibleEvents(pack, initial),
        chapterCandidates: selectChapterCandidates(pack, initial),
      },
    };
    const next = simulate({
      snapshot: { ...start.snapshot, state: initial },
      command: { ...command, commandId: 'challenge-advance', expectedRevision: 3 },
      ruleset: loadRuleset('1.1.0'),
      rulesetVersion: '1.1.0',
      contentPackVersion: '0.3.0',
    });
    if (!next.ok) throw new Error(next.error.message);
    const body = PutCareerBodySchema.parse({
      baseRevision: 3,
      createdServiceSeasonId: 'current-season',
      rulesetVersion: '1.1.0',
      contentPackVersion: '0.3.0',
      snapshot: {
        ...next.snapshot,
        rngState: next.snapshot.state.rngState,
        state: canonicalize(next.snapshot.state as unknown as JsonValue),
      },
      commands: [
        {
          revision: 4,
          commandId: 'challenge-advance',
          commandType: 'ADVANCE',
          payload: command.payload,
          resultHash: next.snapshot.stateHash,
        },
      ],
    });
    expect(
      (await applySync(ctx.db, { profileId: b.id, careerId: start.snapshot.careerId, body, now }))
        .revision,
    ).toBe(4);
    expect((await ctx.db.select().from(careers))[0]!.ownerProfileId).toBe(b.id);
  });
  it('follows source ownership on profile merge and removes the public link on profile deletion', async () => {
    const a = await account();
    const b = await account();
    const retired = await source(a.id);
    const article = await publish(a.cookie, retired.id);
    const [session] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, a.id));
    await moveCareersAndRebind(ctx.db, {
      fromProfileId: a.id,
      toProfileId: b.id,
      sessionId: session!.id,
      now,
    });
    expect((await request(b.cookie, 'GET', `/v1/careers/${retired.id}/publication`)).status).toBe(
      200,
    );
    const token = await issueDeleteConfirmToken({
      sessionId: session!.id,
      sessionTokenHash: session!.tokenHash,
      now,
    });
    await executeProfileDeletion(ctx.db, {
      profileId: b.id,
      sessionId: session!.id,
      sessionTokenHash: session!.tokenHash,
      confirmToken: token.confirmToken,
      now,
    });
    expect((await app.request(`/v1/articles/${article.id}`, {}, ctx.env)).status).toBe(404);
  });
});
