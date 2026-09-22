import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AnnualRunResponseSchema,
  GetCareerResponseSchema,
  ProfileSchema,
  successEnvelope,
} from '@offside/contracts';
import { loadRuleset } from '@offside/content';
import { eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import {
  annualRuns,
  annualRequests,
  careers,
  commandLog,
  sessions,
  snapshots,
  careerArchives,
} from '../db/schema.js';
import { moveCareersAndRebind } from '../profile/merge.js';
import { deleteCareerCascade } from '../db/repos/careers.js';

let ctx: TestD1;
const app = createApp();
const now = '2026-09-22T00:00:00.000Z';
function interceptBatch(hook: (statements: D1PreparedStatement[]) => Promise<D1Result<unknown>[]>) {
  const old = ctx.env;
  const d1 = old.DB;
  ctx.env = {
    ...old,
    DB: new Proxy(d1, {
      get(target, property) {
        if (property === 'batch') return hook;
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
  };
  return () => {
    ctx.env = old;
  };
}
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
const rules = loadRuleset('3.5.0'),
  archetype = rules.archetypes.find((x) => x.position === 'ST')!;
const createInput = {
  draft: {
    name: '연간선수',
    gender: 'MALE',
    nationalityCode: 'KR',
    preferredFoot: 'RIGHT',
    position: 'ST',
    archetypeId: archetype.id,
    backgroundId: rules.backgrounds[0]!.id,
  },
};
async function create(cookie: string) {
  const profile = await app.request('/v1/profile', { headers: { Cookie: cookie } }, ctx.env);
  const expectedProfileId = ((await profile.json()) as { data: { id: string } }).data.id;
  const res = await request(cookie, 'POST', '/v1/careers/server', {
    ...createInput,
    expectedProfileId,
  });
  expect(res.status, await res.clone().text()).toBe(201);
  return GetCareerResponseSchema.parse(((await res.json()) as { data: unknown }).data);
}
async function start(cookie: string, id: string, revision: number) {
  const res = await request(cookie, 'POST', `/v1/careers/${id}/annual-runs`, {
    expectedCareerRevision: revision,
  });
  expect(res.status, await res.clone().text()).toBe(201);
  return AnnualRunResponseSchema.parse(((await res.json()) as { data: unknown }).data);
}
describe('authoritative annual careers (real D1)', () => {
  beforeAll(async () => {
    ctx = await createTestD1();
    await upsertServiceSeason(ctx.db, {
      id: 'annual-test',
      name: 'Annual test',
      status: 'ACTIVE',
      startsAt: now,
      endsAt: '2027-09-22T00:00:00.000Z',
      rulesetVersion: '3.5.0',
      contentPackVersion: '0.14.0',
      challengeSetId: 'annual',
      isTest: true,
    });
    ctx.env.ACTIVE_SERVICE_SEASON_ID = 'annual-test';
  }, 30_000);
  afterAll(async () => ctx.dispose());
  it('creates server state once, rejects forged inputs, pauses important decisions and settles one fixed year', async () => {
    const owner = await account(),
      other = await account();
    const key = crypto.randomUUID();
    const creates = await Promise.all([
      request(
        owner.cookie,
        'POST',
        '/v1/careers/server',
        { ...createInput, expectedProfileId: owner.id },
        key,
      ),
      request(
        owner.cookie,
        'POST',
        '/v1/careers/server',
        { ...createInput, expectedProfileId: owner.id },
        key,
      ),
    ]);
    expect(creates.map((r) => r.status)).toEqual([201, 201]);
    const first = GetCareerResponseSchema.parse(
      ((await creates[0]!.json()) as { data: unknown }).data,
    );
    const second = GetCareerResponseSchema.parse(
      ((await creates[1]!.json()) as { data: unknown }).data,
    );
    expect(second).toEqual(first);
    expect(first.authority).toBe('SERVER_ANNUAL');
    expect(
      (
        await request(owner.cookie, 'POST', '/v1/careers/server', {
          ...createInput,
          expectedProfileId: owner.id,
          seed: 'forged',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          owner.cookie,
          'POST',
          '/v1/careers/server',
          {
            ...createInput,
            expectedProfileId: owner.id,
            draft: { ...createInput.draft, name: '다른이름' },
          },
          key,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          other.cookie,
          'POST',
          '/v1/careers/server',
          { ...createInput, expectedProfileId: other.id },
          key,
        )
      ).status,
    ).toBe(201);
    const id = first.snapshot.careerId;
    expect(
      (await request(other.cookie, 'GET', `/v1/careers/${id}/annual-runs/current`)).status,
    ).toBe(404);
    let current = await start(owner.cookie, id, first.snapshot.revision);
    const runId = current.run.id;
    let paused = 0;
    for (let count = 0; count < 120 && current.run.status !== 'COMPLETED'; count++) {
      const decision = current.run.decision;
      const body = decision
        ? {
            expectedJobRevision: current.run.revision,
            decisionKey: decision.key,
            choiceId: decision.choices[0]!.id,
          }
        : { expectedJobRevision: current.run.revision };
      if (decision) {
        paused++;
        expect(JSON.stringify(decision)).not.toContain('"command"');
        expect(JSON.stringify(decision)).not.toContain('"outcomes"');
      }
      const endpoint = `/v1/careers/${id}/annual-runs/${runId}/${decision ? 'decisions' : 'advance'}`;
      if (decision && paused === 1) {
        for (const [invalid, status] of [
          [{ ...body, choiceId: 'not-offered' }, 422],
          [{ ...body, expectedJobRevision: current.run.revision - 1 }, 409],
        ] as const) {
          expect((await request(owner.cookie, 'POST', endpoint, invalid)).status).toBe(status);
        }
        await ctx.db.update(annualRuns).set({ commandCount: 240 }).where(eq(annualRuns.id, runId));
        expect((await request(owner.cookie, 'POST', endpoint, body)).status).toBe(422);
        const [unchanged] = await ctx.db.select().from(careers).where(eq(careers.id, id));
        expect(unchanged!.revision).toBe(current.run.careerRevision);
        await ctx.db
          .update(annualRuns)
          .set({ commandCount: current.run.completedCommands })
          .where(eq(annualRuns.id, runId));
      }
      const actionKey = crypto.randomUUID();
      const response = await request(owner.cookie, 'POST', endpoint, body, actionKey);
      expect(response.status, await response.clone().text()).toBe(200);
      const next = AnnualRunResponseSchema.parse(
        ((await response.json()) as { data: unknown }).data,
      );
      const replay = await request(owner.cookie, 'POST', endpoint, body, actionKey);
      expect(((await replay.json()) as { data: unknown }).data).toEqual(next);
      expect(
        (
          await request(
            owner.cookie,
            'POST',
            endpoint,
            { ...body, expectedJobRevision: next.run.revision },
            actionKey,
          )
        ).status,
      ).toBe(409);
      expect(next.run.targetSeasonIndex).toBe(1);
      expect(next.run.careerRevision - current.run.careerRevision).toBeLessThanOrEqual(4);
      current = next;
    }
    expect(current.run.status).toBe('COMPLETED');
    expect(paused).toBeGreaterThan(0);
    expect(current.run.report!.endAge - current.run.report!.startAge).toBe(1);
    const logs = await ctx.db.select().from(commandLog).where(eq(commandLog.careerId, id));
    expect(logs.filter((x) => x.commandType === 'SETTLE_SEASON')).toHaveLength(1);
    await ctx.db.update(annualRuns).set({ commandCount: 240 }).where(eq(annualRuns.id, runId));
    const complete = await request(
      owner.cookie,
      'POST',
      `/v1/careers/${id}/annual-runs/${runId}/advance`,
      { expectedJobRevision: current.run.revision },
    );
    expect(complete.status).toBe(200);
    expect(await ctx.db.select().from(annualRuns).where(eq(annualRuns.careerId, id))).toHaveLength(
      1,
    );
    const late = await request(owner.cookie, 'POST', `/v1/careers/${id}/annual-runs`, {
      expectedCareerRevision: first.snapshot.revision,
    });
    expect(late.status).toBe(409);
  }, 60_000);
  it('different-key races advance once; invalid decisions and ownership changes cannot write', async () => {
    const owner = await account(),
      target = await account();
    const created = await create(owner.cookie),
      id = created.snapshot.careerId;
    const begin = await start(owner.cookie, id, created.snapshot.revision);
    const endpoint = `/v1/careers/${id}/annual-runs/${begin.run.id}/advance`;
    const raced = await Promise.all([
      request(owner.cookie, 'POST', endpoint, { expectedJobRevision: 0 }),
      request(owner.cookie, 'POST', endpoint, { expectedJobRevision: 0 }),
    ]);
    expect(raced.map((r) => r.status).sort()).toEqual([200, 409]);
    const current = AnnualRunResponseSchema.parse(
      ((await raced.find((r) => r.status === 200)!.json()) as { data: unknown }).data,
    );
    const rows = await ctx.db
      .select()
      .from(annualRequests)
      .where(eq(annualRequests.runId, begin.run.id));
    expect(rows.filter((r) => r.fromRevision === 0)).toHaveLength(1);
    expect(
      (
        await request(owner.cookie, 'POST', endpoint, {
          expectedJobRevision: current.run.revision,
          eligibleEvents: [],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          owner.cookie,
          'POST',
          `/v1/careers/${id}/annual-runs/${begin.run.id}/decisions`,
          { expectedJobRevision: current.run.revision, decisionKey: 'wrong', choiceId: 'A' },
        )
      ).status,
    ).toBe(409);
    const [session] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, owner.id));
    await moveCareersAndRebind(ctx.db, {
      fromProfileId: owner.id,
      toProfileId: target.id,
      sessionId: session!.id,
      now: new Date().toISOString(),
    });
    expect(
      (await request(target.cookie, 'GET', `/v1/careers/${id}/annual-runs/current`)).status,
    ).toBe(200);
    await deleteCareerCascade(ctx.db, id);
    expect(await ctx.db.select().from(annualRuns).where(eq(annualRuns.careerId, id))).toHaveLength(
      0,
    );
    expect(
      await ctx.db.select().from(annualRequests).where(eq(annualRequests.careerId, id)),
    ).toHaveLength(0);
  }, 30_000);
  it('rejects unsupported active versions without creating careers', async () => {
    const owner = await account();
    ctx.env.ACTIVE_SERVICE_SEASON_ID = 'missing';
    const response = await request(owner.cookie, 'POST', '/v1/careers/server', {
      ...createInput,
      expectedProfileId: owner.id,
    });
    expect(response.status).toBe(422);
    expect(
      await ctx.db.select().from(careers).where(eq(careers.ownerProfileId, owner.id)),
    ).toHaveLength(0);
    ctx.env.ACTIVE_SERVICE_SEASON_ID = 'annual-test';
  });
  it('rejects client snapshot imports including already-applied annual snapshots', async () => {
    const owner = await account(),
      created = await create(owner.cookie),
      id = created.snapshot.careerId;
    const snapshot = {
      revision: created.snapshot.revision,
      checkpoint: created.snapshot.checkpoint,
      state: created.snapshot.state,
      stateHash: created.snapshot.stateHash,
      rulesetVersion: created.snapshot.rulesetVersion,
      contentPackVersion: created.snapshot.contentPackVersion,
      rngState: created.snapshot.rngState,
    };
    const body = {
      baseRevision: 0,
      createdServiceSeasonId: created.createdServiceSeasonId,
      rulesetVersion: '3.5.0',
      contentPackVersion: '0.14.0',
      snapshot,
      commands: created.commands.map(({ careerId: _id, createdAt: _time, ...command }) => command),
    };
    for (const careerId of [id, crypto.randomUUID()]) {
      const response = await app.request(
        `/v1/careers/${careerId}`,
        {
          method: 'PUT',
          headers: {
            Cookie: owner.cookie,
            Origin: 'http://localhost:5173',
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
            'If-Match': '0',
          },
          body: JSON.stringify(body),
        },
        ctx.env,
      );
      expect(response.status, await response.clone().text()).toBe(409);
      expect(await response.text()).toContain('SERVER_AUTHORITY_REQUIRED');
    }
    expect((await ctx.db.select().from(careers).where(eq(careers.id, id)))[0]!.revision).toBe(3);
  });
  it('rolls back every write on failure after receipt claim; rejects revoked/merged sessions at commit', async () => {
    const owner = await account(),
      target = await account(),
      created = await create(owner.cookie),
      id = created.snapshot.careerId;
    const begin = await start(owner.cookie, id, 3),
      url = `/v1/careers/${id}/annual-runs/${begin.run.id}/advance`;
    const original = ctx.env.DB.batch.bind(ctx.env.DB);
    const restoreFault = interceptBatch(async (statements) =>
      original([
        ...statements,
        ctx.env.DB.prepare('INSERT INTO annual_requests(id) VALUES (?)').bind('injected-fault'),
      ]),
    );
    const failed = await request(owner.cookie, 'POST', url, { expectedJobRevision: 0 });
    restoreFault();
    expect(failed.status).toBe(503);
    expect((await ctx.db.select().from(careers).where(eq(careers.id, id)))[0]!.revision).toBe(3);
    expect(await ctx.db.select().from(snapshots).where(eq(snapshots.careerId, id))).toHaveLength(1);
    expect(
      (
        await ctx.db.select().from(annualRequests).where(eq(annualRequests.runId, begin.run.id))
      ).filter((r) => r.fromRevision !== null),
    ).toHaveLength(0);
    const [session] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, owner.id));
    const restoreRace = interceptBatch(async (statements) => {
      await ctx.db
        .update(sessions)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(sessions.id, session!.id));
      return original(statements);
    });
    const revoked = await request(owner.cookie, 'POST', url, { expectedJobRevision: 0 });
    restoreRace();
    expect(revoked.status).toBe(409);
    expect((await ctx.db.select().from(careers).where(eq(careers.id, id)))[0]!.revision).toBe(3);
    await ctx.db.update(sessions).set({ revokedAt: null }).where(eq(sessions.id, session!.id));
    const restoreMerge = interceptBatch(async (statements) => {
      await original([
        ctx.env.DB.prepare('UPDATE careers SET owner_profile_id=? WHERE id=?').bind(target.id, id),
        ctx.env.DB.prepare('UPDATE sessions SET profile_id=? WHERE id=?').bind(
          target.id,
          session!.id,
        ),
      ]);
      return original(statements);
    });
    const mergeResponse = await request(owner.cookie, 'POST', url, { expectedJobRevision: 0 });
    restoreMerge();
    expect(mergeResponse.status).toBe(409);
    expect((await ctx.db.select().from(careers).where(eq(careers.id, id)))[0]!.revision).toBe(3);
    expect(
      (
        await request(owner.cookie, 'POST', '/v1/careers/server', {
          ...createInput,
          expectedProfileId: owner.id,
        })
      ).status,
    ).toBe(409);
    expect((await request(target.cookie, 'POST', url, { expectedJobRevision: 0 })).status).toBe(
      200,
    );
  }, 30_000);
  it('naturally retires, publishes and admits an independently playable annual challenge', async () => {
    const owner = await account(),
      created = await create(owner.cookie),
      id = created.snapshot.careerId;
    let careerRevision = 3,
      retired = false,
      firstYear: ReturnType<typeof AnnualRunResponseSchema.parse> | undefined;
    for (let year = 0; year < 14 && !retired; year++) {
      let current = await start(owner.cookie, id, careerRevision);
      for (let step = 0; step < 150 && current.run.status !== 'COMPLETED'; step++) {
        const decision = current.run.decision;
        const choice = decision?.choices.find((c) => c.id === 'RETIRE') ?? decision?.choices[0];
        const body = decision
          ? {
              expectedJobRevision: current.run.revision,
              decisionKey: decision.key,
              choiceId: choice!.id,
            }
          : { expectedJobRevision: current.run.revision };
        const response = await request(
          owner.cookie,
          'POST',
          `/v1/careers/${id}/annual-runs/${current.run.id}/${decision ? 'decisions' : 'advance'}`,
          body,
        );
        expect(response.status, await response.clone().text()).toBe(200);
        current = AnnualRunResponseSchema.parse(
          ((await response.json()) as { data: unknown }).data,
        );
      }
      expect(current.run.status).toBe('COMPLETED');
      careerRevision = current.run.careerRevision;
      retired = current.run.report!.retired;
      firstYear ??= current;
    }
    expect(retired).toBe(true);
    expect(
      await ctx.db.select().from(careerArchives).where(eq(careerArchives.careerId, id)),
    ).toHaveLength(1);
    const old = await request(
      owner.cookie,
      'GET',
      `/v1/careers/${id}/annual-runs/${firstYear!.run.id}`,
    );
    const oldView = (
      (await old.json()) as { data: { run: { currentStep: number; report: unknown } } }
    ).data;
    expect(oldView.run.currentStep).toBe(firstYear!.run.currentStep);
    expect(oldView.run.report).toEqual(firstYear!.run.report);
    const publication = await request(owner.cookie, 'POST', `/v1/careers/${id}/publication`, {
      consent: true,
    });
    expect(publication.status, await publication.clone().text()).toBe(200);
    const article = ((await publication.json()) as { data: { id: string } }).data;
    const other = await account();
    const challenge = await request(other.cookie, 'POST', `/v1/articles/${article.id}/challenge`, {
      name: '연간도전자',
      expectedProfileId: other.id,
    });
    expect(challenge.status, await challenge.clone().text()).toBe(201);
    const child = GetCareerResponseSchema.parse(
      ((await challenge.json()) as { data: unknown }).data,
    );
    expect(child.authority).toBe('SERVER_ANNUAL');
    expect(child.snapshot.careerId).not.toBe(id);
    const job = await start(other.cookie, child.snapshot.careerId, child.snapshot.revision);
    const played = await request(
      other.cookie,
      'POST',
      `/v1/careers/${child.snapshot.careerId}/annual-runs/${job.run.id}/advance`,
      { expectedJobRevision: 0 },
    );
    expect(played.status, await played.clone().text()).toBe(200);
    const get = await request(other.cookie, 'GET', `/v1/careers/${child.snapshot.careerId}`);
    expect(((await get.json()) as { data: { authority: string } }).data.authority).toBe(
      'SERVER_ANNUAL',
    );
  }, 120_000);
});
