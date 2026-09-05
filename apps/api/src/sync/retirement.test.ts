import { GetCareerResponseSchema, ProfileSchema, successEnvelope } from '@offside/contracts';
import { canonicalize, simulate, type DomainSnapshot, type JsonValue } from '@offside/domain';
import { career06SettledEngineCommands } from '@offside/fixtures';
import { rulesetProto } from '../../../../packages/domain/src/__fixtures__/career-01.js';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { careerArchives, careers } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const ORIGIN = 'http://localhost:5173';
const SERVICE_SEASON_ID = 'svc_retirement_sync';

function tokenFromCookie(value: string): string {
  const token = /offside_session=([^;]+)/.exec(value)?.[1];
  if (!token) throw new Error('missing session cookie');
  return `offside_session=${token}`;
}

async function issueCookie(ctx: TestD1): Promise<string> {
  const response = await createApp().request('/v1/profile', {}, ctx.env);
  successEnvelope(ProfileSchema).parse(await response.json());
  return tokenFromCookie(response.headers.get('Set-Cookie') ?? '');
}

function bodyFor(
  snapshot: DomainSnapshot,
  commands: readonly Record<string, unknown>[],
  baseRevision = 0,
) {
  return {
    baseRevision,
    snapshot: {
      revision: snapshot.revision,
      checkpoint: snapshot.checkpoint,
      state: canonicalize(snapshot.state as unknown as JsonValue),
      stateHash: snapshot.stateHash,
      rulesetVersion: snapshot.rulesetVersion,
      contentPackVersion: snapshot.contentPackVersion,
      rngState: { s: [...snapshot.state.rngState.s], draws: snapshot.state.rngState.draws },
    },
    // The API contract requires a contiguous command log starting at revision 1;
    // this focused archive test supplies the already-settled snapshot without replay claims.
    commands,
    createdServiceSeasonId: SERVICE_SEASON_ID,
    rulesetVersion: snapshot.rulesetVersion,
    contentPackVersion: snapshot.contentPackVersion,
  };
}

async function put(ctx: TestD1, cookie: string, careerId: string, body: unknown, key: string) {
  const baseRevision = (body as { baseRevision: number }).baseRevision;
  return createApp().request(
    `/v1/careers/${careerId}`,
    {
      method: 'PUT',
      headers: {
        Origin: ORIGIN,
        Cookie: cookie,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
        'If-Match': String(baseRevision),
      },
      body: JSON.stringify(body),
    },
    ctx.env,
  );
}

async function setup(ctx: TestD1) {
  await upsertServiceSeason(ctx.db, {
    id: SERVICE_SEASON_ID,
    name: 'Retirement sync',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    challengeSetId: 'test',
  });
  const cookie = await issueCookie(ctx);
  let snapshot: DomainSnapshot | null = null;
  let commandCounter = 0;
  const all = career06SettledEngineCommands(() => `retirement-engine-${commandCounter++}`);
  const records: Record<string, unknown>[] = [];
  let initial: { snapshot: DomainSnapshot; records: Record<string, unknown>[] } | null = null;
  for (const command of all) {
    if (command.type === 'START_SEASON' && snapshot !== null)
      initial = { snapshot, records: records.slice() };
    const result = simulate({
      snapshot,
      command,
      ruleset: rulesetProto,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });
    if (!result.ok) throw new Error(`${command.type} failed: ${result.error.message}`);
    snapshot = result.snapshot;
    records.push({
      revision: snapshot.revision,
      commandId: command.commandId,
      commandType: command.type,
      payload: command.payload,
      resultHash: snapshot.stateHash,
    });
  }
  if (!snapshot || !initial) throw new Error('fixture replay incomplete');
  const active = initial.snapshot;
  const closed =
    snapshot.state.pending?.kind === 'OFFERS' || snapshot.state.pending?.kind === 'CONTRACT'
      ? simulate({
          snapshot,
          command: {
            type: 'REJECT_OFFER',
            payload: { offerId: null },
            commandId: 'retirement-market-close',
            expectedRevision: snapshot.revision,
          },
          ruleset: rulesetProto,
          rulesetVersion: '1.0.0',
          contentPackVersion: '0.1.0',
        })
      : { ok: true as const, snapshot };
  if (!closed.ok) throw new Error('market close failed');
  const retired = simulate({
    snapshot: closed.snapshot,
    command: {
      type: 'RETIRE',
      payload: { choice: 'RETIRE' },
      commandId: 'retirement-sync-retire',
      expectedRevision: closed.snapshot.revision,
    },
    ruleset: rulesetProto,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  if (!retired.ok) throw new Error(`RETIRE failed: ${retired.error.message}`);
  const finalRecords = records.slice(initial.records.length);
  finalRecords.push({
    revision: closed.snapshot.revision,
    commandId: 'retirement-market-close',
    commandType: 'REJECT_OFFER',
    payload: { offerId: null },
    resultHash: closed.snapshot.stateHash,
  });
  finalRecords.push({
    revision: retired.snapshot.revision,
    commandId: 'retirement-sync-retire',
    commandType: 'RETIRE',
    payload: { choice: 'RETIRE' },
    resultHash: retired.snapshot.stateHash,
  });
  const initialBody = bodyFor(active, initial.records, 0);
  const initialResponse = await put(
    ctx,
    cookie,
    active.state.careerId,
    initialBody,
    'retirement-initial',
  );
  if (initialResponse.status !== 200)
    throw new Error(`initial sync failed: ${await initialResponse.text()}`);
  return {
    cookie,
    snapshot: retired.snapshot,
    body: bodyFor(retired.snapshot, finalRecords, active.revision),
    careerId: retired.snapshot.state.careerId,
  };
}

describe('retirement Archive sync', () => {
  it('rejects a changed evaluation pin on an already-retired snapshot without rewriting it', async () => {
    const ctx = await createTestD1();
    try {
      const state = await setup(ctx);
      expect(
        (await put(ctx, state.cookie, state.careerId, state.body, 'retirement-pin-first')).status,
      ).toBe(200);
      const before = await ctx.db
        .select()
        .from(careerArchives)
        .where(eq(careerArchives.careerId, state.careerId));
      const response = await put(
        ctx,
        state.cookie,
        state.careerId,
        { ...state.body, retirementReferencePopulationId: 'different-reference' },
        'retirement-pin-conflict',
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { details: { reason: 'RETIREMENT_REFERENCE_CONFLICT' } },
      });
      const after = await ctx.db
        .select()
        .from(careerArchives)
        .where(eq(careerArchives.careerId, state.careerId));
      expect(after).toEqual(before);
      expect(
        (
          await put(
            ctx,
            state.cookie,
            state.careerId,
            { ...state.body, retirementReferencePopulationId: null },
            'retirement-pin-same',
          )
        ).status,
      ).toBe(200);
    } finally {
      await ctx.dispose();
    }
  });

  it('stores verified Archive+Legacy and returns it only to the owner', async () => {
    const ctx = await createTestD1();
    try {
      const setupState = await setup(ctx);
      const response = await put(
        ctx,
        setupState.cookie,
        setupState.careerId,
        setupState.body,
        'retirement-sync-1',
      );
      expect(response.status, await response.clone().text()).toBe(200);
      const owner = await createApp().request(
        `/v1/careers/${setupState.careerId}`,
        { headers: { Cookie: setupState.cookie } },
        ctx.env,
      );
      expect(owner.status).toBe(200);
      const parsed = successEnvelope(GetCareerResponseSchema).parse(await owner.json());
      expect(parsed.data.retirementArchive?.archive).toContain(setupState.careerId);
      expect(parsed.data.retirementArchive?.legacy).toContain('legacyVersion');
      expect(JSON.parse(parsed.data.retirementArchive!.legacy)).toMatchObject({
        referencePopulationId: null,
        percentileHidden: true,
      });
      const other = await issueCookie(ctx);
      const unauthorized = await createApp().request(
        `/v1/careers/${setupState.careerId}`,
        { headers: { Cookie: other } },
        ctx.env,
      );
      expect(unauthorized.status).toBe(403);
    } finally {
      await ctx.dispose();
    }
  });

  it('rejects forged state hash and preserves the database', async () => {
    const ctx = await createTestD1();
    try {
      const state = await setup(ctx);
      const forged = {
        ...state.body,
        snapshot: { ...state.body.snapshot, stateHash: 'f'.repeat(64) },
      };
      const response = await put(ctx, state.cookie, state.careerId, forged, 'retirement-forged');
      expect(response.status).toBe(400);
      const preserved = await createApp().request(
        `/v1/careers/${state.careerId}`,
        { headers: { Cookie: state.cookie } },
        ctx.env,
      );
      expect(preserved.status).toBe(200);
      const parsed = successEnvelope(GetCareerResponseSchema).parse(await preserved.json());
      expect(parsed.data.retirementArchive).toBeUndefined();
    } finally {
      await ctx.dispose();
    }
  });

  it('rejects an unknown reference pin before writing any retirement record', async () => {
    const ctx = await createTestD1();
    try {
      const state = await setup(ctx);
      const response = await put(
        ctx,
        state.cookie,
        state.careerId,
        { ...state.body, retirementReferencePopulationId: 'unknown-population' },
        'retirement-unknown-population',
      );
      expect(response.status).toBe(400);
      const rows = await ctx.db
        .select()
        .from(careerArchives)
        .where(eq(careerArchives.careerId, state.careerId));
      expect(rows).toHaveLength(0);
      const preserved = await ctx.db.select().from(careers).where(eq(careers.id, state.careerId));
      expect(preserved[0]?.status).toBe('ACTIVE');
      expect(preserved[0]?.revision).toBe(state.body.baseRevision);
    } finally {
      await ctx.dispose();
    }
  });

  it('100 identical concurrent submissions create one career/archive and remain idempotent', async () => {
    const ctx = await createTestD1();
    try {
      const state = await setup(ctx);
      const responses = await Promise.all(
        Array.from({ length: 100 }, () =>
          put(ctx, state.cookie, state.careerId, state.body, 'retirement-concurrent'),
        ),
      );
      expect(responses.every((response) => response.status === 200)).toBe(true);
      const owner = await createApp().request(
        `/v1/careers/${state.careerId}`,
        { headers: { Cookie: state.cookie } },
        ctx.env,
      );
      expect(owner.status).toBe(200);
      const parsed = successEnvelope(GetCareerResponseSchema).parse(await owner.json());
      expect(parsed.data.retirementArchive).toBeDefined();
    } finally {
      await ctx.dispose();
    }
  }, 60_000);

  it('deleting an owned retired career cascades its archive and subsequent reads are gone', async () => {
    const ctx = await createTestD1();
    try {
      const state = await setup(ctx);
      const retired = await put(ctx, state.cookie, state.careerId, state.body, 'retirement-delete');
      expect(retired.status).toBe(200);
      const deleted = await createApp().request(
        `/v1/careers/${state.careerId}`,
        {
          method: 'DELETE',
          headers: {
            Origin: ORIGIN,
            Cookie: state.cookie,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'retirement-delete-career',
          },
          body: '{}',
        },
        ctx.env,
      );
      expect(deleted.status).toBe(204);
      const archiveRows = await ctx.db
        .select()
        .from(careerArchives)
        .where(eq(careerArchives.careerId, state.careerId));
      expect(archiveRows).toHaveLength(0);
      const missing = await createApp().request(
        `/v1/careers/${state.careerId}`,
        { headers: { Cookie: state.cookie } },
        ctx.env,
      );
      expect(missing.status).toBe(404);
    } finally {
      await ctx.dispose();
    }
  });

  it('rolls back career/snapshot/command/archive together when archive insert aborts', async () => {
    const ctx = await createTestD1();
    const trigger = 'retirement_archive_abort_test';
    try {
      const state = await setup(ctx);
      await ctx.env.DB.prepare(
        `CREATE TRIGGER ${trigger} BEFORE INSERT ON career_archives BEGIN SELECT RAISE(ABORT, 'test archive failure'); END`,
      ).run();
      const response = await put(
        ctx,
        state.cookie,
        state.careerId,
        state.body,
        'retirement-trigger-failure',
      );
      expect(response.status).toBe(409);
      const career = await ctx.db.select().from(careers).where(eq(careers.id, state.careerId));
      const archives = await ctx.db
        .select()
        .from(careerArchives)
        .where(eq(careerArchives.careerId, state.careerId));
      expect(career[0]?.status).toBe('ACTIVE');
      expect(career[0]?.revision).toBe(state.body.baseRevision);
      expect(archives).toHaveLength(0);
    } finally {
      await ctx.env.DB.prepare(`DROP TRIGGER IF EXISTS ${trigger}`)
        .run()
        .catch(() => undefined);
      await ctx.dispose();
    }
  });

  it('rejects changed progress after retirement without changing the original retired record', async () => {
    const ctx = await createTestD1();
    try {
      const state = await setup(ctx);
      const retired = await put(
        ctx,
        state.cookie,
        state.careerId,
        state.body,
        'retirement-progress-original',
      );
      expect(retired.status).toBe(200);
      const changedRevision = state.body.snapshot.revision + 1;
      const changed = {
        ...state.body,
        baseRevision: state.body.snapshot.revision,
        snapshot: {
          ...state.body.snapshot,
          id: `${state.careerId}:${changedRevision}`,
          revision: changedRevision,
        },
      };
      const response = await put(
        ctx,
        state.cookie,
        state.careerId,
        changed,
        'retirement-progress-changed',
      );
      expect(response.status).toBe(400);
      const owner = await createApp().request(
        `/v1/careers/${state.careerId}`,
        { headers: { Cookie: state.cookie } },
        ctx.env,
      );
      const parsed = successEnvelope(GetCareerResponseSchema).parse(await owner.json());
      expect(parsed.meta.careerRevision).toBe(state.body.snapshot.revision);
      expect(parsed.data.snapshot.revision).toBe(state.body.snapshot.revision);
      expect(parsed.data.retirementArchive).toBeDefined();
    } finally {
      await ctx.dispose();
    }
  });
});
