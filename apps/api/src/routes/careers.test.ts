import {
  CareerSummaryListSchema,
  ErrorEnvelopeSchema,
  GetCareerResponseSchema,
  IF_MATCH_HEADER,
  ProfileSchema,
  PutCareerResponseSchema,
  successEnvelope,
  type CheckpointType,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { sha256Hex } from '../db/hash.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import { careers, commandLog, serviceSeasons, snapshots } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';
const SERVICE_SEASON_ID = 'svc_test';

function extractSessionToken(setCookie: string): string {
  const token = /offside_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) throw new Error('Set-Cookie에 offside_session이 없습니다.');
  return token;
}

async function issueCookie(ctx: TestD1): Promise<{ token: string; profileId: string; cookie: string }> {
  const app = createApp();
  const res = await app.request('/v1/profile', {}, ctx.env);
  const token = extractSessionToken(res.headers.get('Set-Cookie') ?? '');
  const body = successEnvelope(ProfileSchema).parse(await res.json());
  return { token, profileId: body.data.id, cookie: `offside_session=${token}` };
}

async function ensureServiceSeason(ctx: TestD1, id = SERVICE_SEASON_ID): Promise<string> {
  const season = await upsertServiceSeason(ctx.db, {
    id,
    name: 'Test season',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    challengeSetId: 'cs_test',
  });
  return season.id;
}

/** 05 "Snapshot 계약": 키 정렬, 공백 없는 canonical JSON. */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildState(input: {
  careerId: string;
  status?: string;
  draws?: number | undefined;
  rulesetVersion?: string;
  contentPackVersion?: string;
  stateOverrides?: Record<string, unknown>;
}): string {
  const {
    careerId,
    status = 'ACTIVE',
    draws = 0,
    rulesetVersion = '1.0.0',
    contentPackVersion = '0.1.0',
    stateOverrides = {},
  } = input;
  return canonicalize({
    schemaVersion: 1,
    careerId,
    status,
    rngState: { s: [1, 2, 3, 4], draws },
    rulesetVersion,
    contentPackVersion,
    ...stateOverrides,
  });
}

async function makeSnapshot(input: {
  careerId: string;
  revision: number;
  checkpoint?: CheckpointType;
  status?: string;
  draws?: number | undefined;
  rulesetVersion?: string;
  contentPackVersion?: string;
  stateOverrides?: Record<string, unknown>;
}) {
  const {
    careerId,
    revision,
    checkpoint = 'STEP_BOUNDARY',
    status = 'ACTIVE',
    draws = revision,
    rulesetVersion = '1.0.0',
    contentPackVersion = '0.1.0',
    stateOverrides,
  } = input;
  const state = buildState({
    careerId,
    status,
    draws,
    rulesetVersion,
    contentPackVersion,
    ...(stateOverrides === undefined ? {} : { stateOverrides }),
  });
  const stateHash = await sha256Hex(state);
  return {
    revision,
    checkpoint,
    state,
    stateHash,
    rulesetVersion,
    contentPackVersion,
    rngState: { s: [1, 2, 3, 4] as [number, number, number, number], draws },
  };
}

function makeCommand(input: { revision: number; commandId: string; resultHash: string; commandType?: string }) {
  const { revision, commandId, resultHash, commandType = 'ADVANCE' } = input;
  // T-1-006: CommandLogEntrySchema가 commandType·payload 정합을 검사하므로, 기본 ADVANCE에 맞는
  // 유효한 payload를 쓴다(eligibleEvents는 빈 배열도 유효하다).
  return { revision, commandId, commandType, payload: { eligibleEvents: [] }, resultHash };
}

/** 마지막이 아닌 command의 resultHash는 검증 대상이 아니므로 임의의 유효한 hex64를 쓴다. */
const FILLER_HASH = 'f'.repeat(64);

/** hex 문자 하나를 바꿔 여전히 유효한 64자리 hex이지만 다른 값을 만든다. */
function flipHexChar(hex: string): string {
  const last = hex[hex.length - 1];
  const flipped = last === '0' ? '1' : '0';
  return hex.slice(0, -1) + flipped;
}

async function putCareerBody(input: {
  careerId: string;
  baseRevision: number;
  commandRevisions: number[];
  snapshotRevision: number;
  status?: string;
  draws?: number | undefined;
  rulesetVersion?: string;
  contentPackVersion?: string;
  createdServiceSeasonId?: string;
  stateOverrides?: Record<string, unknown>;
}) {
  const {
    careerId,
    baseRevision,
    commandRevisions,
    snapshotRevision,
    status = 'ACTIVE',
    draws,
    rulesetVersion = '1.0.0',
    contentPackVersion = '0.1.0',
    createdServiceSeasonId = SERVICE_SEASON_ID,
    stateOverrides,
  } = input;
  const snapshot = await makeSnapshot({
    careerId,
    revision: snapshotRevision,
    status,
    draws,
    rulesetVersion,
    contentPackVersion,
    ...(stateOverrides === undefined ? {} : { stateOverrides }),
  });
  const commands = commandRevisions.map((revision, index) =>
    makeCommand({
      revision,
      commandId: `cmd_${careerId}_${revision}`,
      resultHash: index === commandRevisions.length - 1 ? snapshot.stateHash : FILLER_HASH,
    }),
  );
  return { baseRevision, snapshot, commands, createdServiceSeasonId, rulesetVersion, contentPackVersion };
}

function putInit(input: {
  body: unknown;
  idempotencyKey?: string | null;
  ifMatch?: string | null;
  cookie?: string;
  origin?: string | null;
}): RequestInit {
  const { body, idempotencyKey = 'idem-key-0001', ifMatch, cookie, origin = ALLOWED_ORIGIN } = input;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  if (idempotencyKey !== null) headers['Idempotency-Key'] = idempotencyKey;
  if (ifMatch !== null && ifMatch !== undefined) headers[IF_MATCH_HEADER] = ifMatch;
  if (cookie) headers.Cookie = cookie;
  return { method: 'PUT', headers, body: JSON.stringify(body) };
}

function getInit(cookie?: string): RequestInit {
  return cookie ? { headers: { Cookie: cookie } } : {};
}

describe('careers routes', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
    await ensureServiceSeason(ctx);
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('첫 동기화 → 이어지는 동기화 → GET 단건/목록', async () => {
    const { cookie, profileId } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_flow_1';

    const firstBody = await putCareerBody({
      careerId,
      baseRevision: 0,
      commandRevisions: [1],
      snapshotRevision: 1,
    });
    const firstRes = await app.request(
      `/v1/careers/${careerId}`,
      putInit({ body: firstBody, ifMatch: '0', cookie, idempotencyKey: 'idem-flow-1' }),
      ctx.env,
    );
    expect(firstRes.status).toBe(200);
    const firstParsed = successEnvelope(PutCareerResponseSchema).parse(await firstRes.json());
    expect(firstParsed.data.revision).toBe(1);
    expect(firstParsed.meta.careerRevision).toBe(1);

    const [careerRow] = await ctx.db.select().from(careers).where(eq(careers.id, careerId));
    expect(careerRow?.ownerProfileId).toBe(profileId);
    expect(careerRow?.revision).toBe(1);
    expect(await ctx.db.select().from(snapshots).where(eq(snapshots.careerId, careerId))).toHaveLength(1);
    expect(await ctx.db.select().from(commandLog).where(eq(commandLog.careerId, careerId))).toHaveLength(1);

    const secondBody = await putCareerBody({
      careerId,
      baseRevision: 1,
      commandRevisions: [2, 3],
      snapshotRevision: 3,
    });
    const secondRes = await app.request(
      `/v1/careers/${careerId}`,
      putInit({ body: secondBody, ifMatch: '1', cookie, idempotencyKey: 'idem-flow-2' }),
      ctx.env,
    );
    expect(secondRes.status).toBe(200);
    const secondParsed = successEnvelope(PutCareerResponseSchema).parse(await secondRes.json());
    expect(secondParsed.data.revision).toBe(3);

    const getRes = await app.request(`/v1/careers/${careerId}?since=1`, getInit(cookie), ctx.env);
    expect(getRes.status).toBe(200);
    const getParsed = successEnvelope(GetCareerResponseSchema).parse(await getRes.json());
    expect(getParsed.data.createdServiceSeasonId).toBe(SERVICE_SEASON_ID);
    expect(getParsed.data.snapshot.revision).toBe(3);
    expect(getParsed.data.commands.map((command) => command.revision)).toEqual([2, 3]);
    expect(getParsed.meta.careerRevision).toBe(3);

    const listRes = await app.request('/v1/careers', getInit(cookie), ctx.env);
    expect(listRes.status).toBe(200);
    const listParsed = successEnvelope(CareerSummaryListSchema).parse(await listRes.json());
    expect(listParsed.data.items).toHaveLength(1);
    expect(listParsed.data.items[0]?.id).toBe(careerId);
    expect(listParsed.data.items[0]?.revision).toBe(3);
    expect(listParsed.data.items[0]?.lastSyncedAt).toBeTruthy();
  });

  it('잘못된 revision은 409 CAREER_REVISION_CONFLICT이고 아무것도 쓰이지 않는다', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_conflict_1';

    await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
        ifMatch: '0',
        cookie,
      }),
      ctx.env,
    );
    await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 1, commandRevisions: [2, 3], snapshotRevision: 3 }),
        ifMatch: '1',
        cookie,
        idempotencyKey: 'idem-conflict-setup-2',
      }),
      ctx.env,
    );

    const staleRes = await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 1, commandRevisions: [2], snapshotRevision: 2 }),
        ifMatch: '1',
        cookie,
        idempotencyKey: 'idem-conflict-stale',
      }),
      ctx.env,
    );
    expect(staleRes.status).toBe(409);
    const errorBody = ErrorEnvelopeSchema.parse(await staleRes.json());
    expect(errorBody.error.code).toBe('CAREER_REVISION_CONFLICT');
    expect(errorBody.error.details).toEqual({ serverRevision: 3, serverSnapshotUrl: `/v1/careers/${careerId}` });

    expect(await ctx.db.select().from(commandLog).where(eq(commandLog.careerId, careerId))).toHaveLength(3);
    const [careerRow] = await ctx.db.select().from(careers).where(eq(careers.id, careerId));
    expect(careerRow?.revision).toBe(3);
  });

  it('If-Match가 없으면 400 IF_MATCH_REQUIRED, baseRevision과 다르면 400 IF_MATCH_MISMATCH', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_ifmatch_1';
    const body = await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 });

    const missing = await app.request(`/v1/careers/${careerId}`, putInit({ body, cookie }), ctx.env);
    expect(missing.status).toBe(400);
    expect((ErrorEnvelopeSchema.parse(await missing.json()).error.details as { reason?: string }).reason).toBe(
      'IF_MATCH_REQUIRED',
    );

    const mismatched = await app.request(
      `/v1/careers/${careerId}`,
      putInit({ body, ifMatch: '5', cookie, idempotencyKey: 'idem-ifmatch-mismatch' }),
      ctx.env,
    );
    expect(mismatched.status).toBe(400);
    expect((ErrorEnvelopeSchema.parse(await mismatched.json()).error.details as { reason?: string }).reason).toBe(
      'IF_MATCH_MISMATCH',
    );
  });

  it('버전 필드가 서버 저장값과 다르면 422 VERSION_MISMATCH', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_version_1';

    await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
        ifMatch: '0',
        cookie,
      }),
      ctx.env,
    );

    const driftedBody = await putCareerBody({
      careerId,
      baseRevision: 1,
      commandRevisions: [2],
      snapshotRevision: 2,
      rulesetVersion: '2.0.0',
    });
    const res = await app.request(
      `/v1/careers/${careerId}`,
      putInit({ body: driftedBody, ifMatch: '1', cookie, idempotencyKey: 'idem-version-drift' }),
      ctx.env,
    );
    expect(res.status).toBe(422);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('VERSION_MISMATCH');
  });

  it('소유권: 다른 프로필은 403 CAREER_NOT_OWNED, 없는 id는 404 CAREER_NOT_FOUND', async () => {
    const owner = await issueCookie(ctx);
    const stranger = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_owner_1';

    await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
        ifMatch: '0',
        cookie: owner.cookie,
      }),
      ctx.env,
    );

    const getForbidden = await app.request(`/v1/careers/${careerId}`, getInit(stranger.cookie), ctx.env);
    expect(getForbidden.status).toBe(403);
    expect(ErrorEnvelopeSchema.parse(await getForbidden.json()).error.code).toBe('CAREER_NOT_OWNED');

    const putForbidden = await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 1, commandRevisions: [2], snapshotRevision: 2 }),
        ifMatch: '1',
        cookie: stranger.cookie,
        idempotencyKey: 'idem-owner-stranger',
      }),
      ctx.env,
    );
    expect(putForbidden.status).toBe(403);
    expect(ErrorEnvelopeSchema.parse(await putForbidden.json()).error.code).toBe('CAREER_NOT_OWNED');

    const missing = await app.request('/v1/careers/car_does_not_exist', getInit(owner.cookie), ctx.env);
    expect(missing.status).toBe(404);
    expect(ErrorEnvelopeSchema.parse(await missing.json()).error.code).toBe('CAREER_NOT_FOUND');
  });

  describe('무결성 검사(설계 결정 5)', () => {
    it('stateHash 변조 → 400 STATE_HASH_MISMATCH', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_hash';
      const body = await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 });
      body.snapshot.stateHash = flipHexChar(body.snapshot.stateHash);

      const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, ifMatch: '0', cookie }), ctx.env);
      expect(res.status).toBe(400);
      const errorBody = ErrorEnvelopeSchema.parse(await res.json());
      expect(errorBody.error.code).toBe('VALIDATION_FAILED');
      expect((errorBody.error.details as { reason?: string }).reason).toBe('STATE_HASH_MISMATCH');
    });

    it('rngState.draws 변조 → 400 RNG_STATE_MISMATCH', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_rng';
      const body = await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 });
      body.snapshot.rngState = { s: [1, 2, 3, 4], draws: body.snapshot.rngState.draws + 1 };

      const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, ifMatch: '0', cookie }), ctx.env);
      expect(res.status).toBe(400);
      expect((ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string }).reason).toBe(
        'RNG_STATE_MISMATCH',
      );
    });

    it('마지막 command의 resultHash 불일치 → 400 RESULT_HASH_MISMATCH', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_result';
      const body = await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 });
      body.commands[0]!.resultHash = flipHexChar(body.commands[0]!.resultHash);

      const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, ifMatch: '0', cookie }), ctx.env);
      expect(res.status).toBe(400);
      expect((ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string }).reason).toBe(
        'RESULT_HASH_MISMATCH',
      );
    });

    it('state의 careerId가 URL과 다름 → 400 CAREER_ID_MISMATCH', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_id';
      const wrongState = buildState({ careerId: 'car_other_id' });
      const wrongStateHash = await sha256Hex(wrongState);
      const body = {
        baseRevision: 0,
        snapshot: {
          revision: 1,
          checkpoint: 'STEP_BOUNDARY' as const,
          state: wrongState,
          stateHash: wrongStateHash,
          rulesetVersion: '1.0.0',
          contentPackVersion: '0.1.0',
          rngState: { s: [1, 2, 3, 4] as [number, number, number, number], draws: 0 },
        },
        commands: [makeCommand({ revision: 1, commandId: 'cmd_1', resultHash: wrongStateHash })],
        createdServiceSeasonId: SERVICE_SEASON_ID,
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
      };

      const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, ifMatch: '0', cookie }), ctx.env);
      expect(res.status).toBe(400);
      expect((ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string }).reason).toBe(
        'CAREER_ID_MISMATCH',
      );
    });

    it.each([
      {
        label: 'LOAN인데 parentContract가 null',
        stateOverrides: {
          contract: { id: 'CTR-loan', teamId: 'loan-team', kind: 'LOAN', loan: { parentTeamId: 'source-team' } },
          parentContract: null,
          clubHistory: [{ contractId: 'CTR-loan', teamId: 'loan-team', kind: 'LOAN', toSeasonIndex: null }],
        },
      },
      {
        label: 'parentContract가 loan 원소속과 다름',
        stateOverrides: {
          contract: { id: 'CTR-loan', teamId: 'loan-team', kind: 'LOAN', loan: { parentTeamId: 'source-team' } },
          parentContract: { id: 'CTR-parent', teamId: 'wrong-source-team', kind: 'PERMANENT', suspended: true },
          clubHistory: [{ contractId: 'CTR-loan', teamId: 'loan-team', kind: 'LOAN', toSeasonIndex: null }],
        },
      },
      {
        label: '열린 stint가 둘',
        stateOverrides: {
          contract: { id: 'CTR-current', teamId: 'current-team', kind: 'PERMANENT' },
          parentContract: null,
          clubHistory: [
            { contractId: 'CTR-current', teamId: 'current-team', kind: 'PERMANENT', toSeasonIndex: null },
            { contractId: 'CTR-other', teamId: 'other-team', kind: 'PERMANENT', toSeasonIndex: null },
          ],
        },
      },
    ])('$label 조작 Snapshot은 저장 전에 STATE_INVARIANT_VIOLATION으로 거부한다', async ({ stateOverrides }) => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_contract';
      const body = await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1, stateOverrides });

      const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, ifMatch: '0', cookie }), ctx.env);
      expect(res.status).toBe(400);
      expect((ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string }).reason).toBe(
        'STATE_INVARIANT_VIOLATION',
      );
    });

    it('T-2-012 D-54: LOCKED 시즌으로 신규 생성하면 409 SERVICE_SEASON_CLOSED', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_locked_season';
      const lockedSeasonId = await ensureServiceSeason(ctx, 'svc_locked');
      await ctx.db.update(serviceSeasons).set({ status: 'LOCKED' }).where(eq(serviceSeasons.id, lockedSeasonId));

      const body = await putCareerBody({
        careerId,
        baseRevision: 0,
        commandRevisions: [1],
        snapshotRevision: 1,
        createdServiceSeasonId: lockedSeasonId,
      });

      const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, ifMatch: '0', cookie }), ctx.env);
      expect(res.status).toBe(409);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('SERVICE_SEASON_CLOSED');
    });

    it('T-2-012 D-54: PRESEASON 시즌은 신규 생성을 허용한다', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_preseason';
      const preseasonId = await ensureServiceSeason(ctx, 'svc_preseason');
      await ctx.db.update(serviceSeasons).set({ status: 'PRESEASON' }).where(eq(serviceSeasons.id, preseasonId));

      const body = await putCareerBody({
        careerId,
        baseRevision: 0,
        commandRevisions: [1],
        snapshotRevision: 1,
        createdServiceSeasonId: preseasonId,
      });

      const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, ifMatch: '0', cookie }), ctx.env);
      expect(res.status).toBe(200);
    });

    it('신규 커리어 버전이 서비스 시즌 manifest와 다르면 422 VERSION_MISMATCH', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_season_version_mismatch';
      const expandedSeason = await upsertServiceSeason(ctx.db, {
        id: 'svc_phase34_qa',
        name: 'PHASE 3+4 QA',
        status: 'PRESEASON',
        startsAt: '2026-09-05T00:00:00Z',
        endsAt: '2026-10-31T23:59:59Z',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.3.0',
        challengeSetId: 'cs_phase34_qa',
        isTest: true,
      });
      const body = await putCareerBody({
        careerId,
        baseRevision: 0,
        commandRevisions: [1],
        snapshotRevision: 1,
        createdServiceSeasonId: expandedSeason.id,
        contentPackVersion: '0.1.0',
      });

      const res = await app.request(
        `/v1/careers/${careerId}`,
        putInit({ body, ifMatch: '0', cookie, idempotencyKey: 'idem-season-version-mismatch' }),
        ctx.env,
      );
      expect(res.status).toBe(422);
      const error = ErrorEnvelopeSchema.parse(await res.json()).error;
      expect(error.code).toBe('VERSION_MISMATCH');
      expect(error.details).toEqual({
        reason: 'SERVICE_SEASON_VERSION_MISMATCH',
        expectedRulesetVersion: '1.0.0',
        expectedContentPackVersion: '0.3.0',
      });
    });

    it('서비스 시즌 manifest와 일치하는 0.3.0 신규 커리어는 허용한다', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_expanded_season';
      const expandedSeason = await upsertServiceSeason(ctx.db, {
        id: 'svc_phase34_qa',
        name: 'PHASE 3+4 QA',
        status: 'PRESEASON',
        startsAt: '2026-09-05T00:00:00Z',
        endsAt: '2026-10-31T23:59:59Z',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.3.0',
        challengeSetId: 'cs_phase34_qa',
        isTest: true,
      });
      const body = await putCareerBody({
        careerId,
        baseRevision: 0,
        commandRevisions: [1],
        snapshotRevision: 1,
        createdServiceSeasonId: expandedSeason.id,
        contentPackVersion: '0.3.0',
      });

      const res = await app.request(
        `/v1/careers/${careerId}`,
        putInit({ body, ifMatch: '0', cookie, idempotencyKey: 'idem-expanded-season' }),
        ctx.env,
      );
      expect(res.status).toBe(200);
      const [saved] = await ctx.db.select().from(careers).where(eq(careers.id, careerId));
      expect(saved).toMatchObject({
        createdServiceSeasonId: 'svc_phase34_qa',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.3.0',
      });
    });

    it('기존 커리어는 서비스 시즌 manifest 변경 뒤에도 생성 버전으로 후속 PUT을 허용한다', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_pinned_manifest';
      const firstBody = await putCareerBody({
        careerId,
        baseRevision: 0,
        commandRevisions: [1],
        snapshotRevision: 1,
      });
      const firstRes = await app.request(
        `/v1/careers/${careerId}`,
        putInit({ body: firstBody, ifMatch: '0', cookie, idempotencyKey: 'idem-pinned-first' }),
        ctx.env,
      );
      expect(firstRes.status).toBe(200);

      await ctx.db
        .update(serviceSeasons)
        .set({ contentPackVersion: '0.3.0' })
        .where(eq(serviceSeasons.id, SERVICE_SEASON_ID));
      const nextBody = await putCareerBody({
        careerId,
        baseRevision: 1,
        commandRevisions: [2],
        snapshotRevision: 2,
        contentPackVersion: '0.1.0',
      });
      const nextRes = await app.request(
        `/v1/careers/${careerId}`,
        putInit({ body: nextBody, ifMatch: '1', cookie, idempotencyKey: 'idem-pinned-next' }),
        ctx.env,
      );

      expect(nextRes.status).toBe(200);
      const [saved] = await ctx.db.select().from(careers).where(eq(careers.id, careerId));
      expect(saved).toMatchObject({ revision: 2, contentPackVersion: '0.1.0' });
    });

    it('createdServiceSeasonId가 없으면 400 SERVICE_SEASON_UNKNOWN', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_integrity_season';
      const body = await putCareerBody({
        careerId,
        baseRevision: 0,
        commandRevisions: [1],
        snapshotRevision: 1,
        createdServiceSeasonId: 'svc_missing',
      });

      const res = await app.request(`/v1/careers/${careerId}`, putInit({ body, ifMatch: '0', cookie }), ctx.env);
      expect(res.status).toBe(400);
      expect((ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string }).reason).toBe(
        'SERVICE_SEASON_UNKNOWN',
      );
    });
  });

  it('100회 병렬 멱등: 같은 Idempotency-Key·같은 본문 → 전부 200, revision은 한 번만 증가', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_parallel_idem';

    // 첫 동기화(INSERT 경로)는 별도로 먼저 끝낸다. 100개 동시 요청은 이미 존재하는 커리어에 대한
    // UPDATE 기반 동기화 경로를 검증한다: FK 검증이 딸린 최초 INSERT 100개를 동시에 경합시키면 로컬
    // D1(Miniflare) 테스트 하네스가 SQLITE_BUSY로 10초 예산을 넘겨 무관한 타임아웃을 만든다.
    await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
        ifMatch: '0',
        cookie,
      }),
      ctx.env,
    );

    const body = await putCareerBody({ careerId, baseRevision: 1, commandRevisions: [2], snapshotRevision: 2 });

    const responses = await Promise.all(
      Array.from({ length: 100 }, () =>
        app.request(
          `/v1/careers/${careerId}`,
          putInit({ body, ifMatch: '1', cookie, idempotencyKey: 'idem-parallel-1' }),
          ctx.env,
        ),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
    }
    // 응답 본문은 읽지 않는다: idempotency 미들웨어의 `c.res.clone()`과 hono/cors의 finalized-후
    // 헤더 재작성(`c.header()`)이 겹치는 100-way 동시 실행에서 Node fetch의 Response body tee가 드물게
    // "Body is unusable"을 던진다(T-0-006 미들웨어·Node 런타임 쪽 이슈, 본 브리프 범위 밖). status는
    // 스트림을 건드리지 않으므로 안전하고, revision 수렴은 DB로 직접 확인한다.
    const [careerRow] = await ctx.db.select().from(careers).where(eq(careers.id, careerId));
    expect(careerRow?.revision).toBe(2);
    expect(await ctx.db.select().from(snapshots).where(eq(snapshots.careerId, careerId))).toHaveLength(2);
    expect(await ctx.db.select().from(commandLog).where(eq(commandLog.careerId, careerId))).toHaveLength(2);
  }, 60_000);

  it('100회 병렬 경쟁: 같은 baseRevision, 다른 내용 → 정확히 1개 200, 나머지 409', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_parallel_race';

    await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
        ifMatch: '0',
        cookie,
      }),
      ctx.env,
    );

    const bodies = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        putCareerBody({
          careerId,
          baseRevision: 1,
          commandRevisions: [2],
          snapshotRevision: 2,
          draws: 1000 + index,
        }),
      ),
    );

    const responses = await Promise.all(
      bodies.map((body, index) =>
        app.request(
          `/v1/careers/${careerId}`,
          putInit({ body, ifMatch: '1', cookie, idempotencyKey: `idem-race-${index}` }),
          ctx.env,
        ),
      ),
    );

    const okCount = responses.filter((res) => res.status === 200).length;
    const conflictCount = responses.filter((res) => res.status === 409).length;
    expect(okCount).toBe(1);
    expect(conflictCount).toBe(99);

    const [careerRow] = await ctx.db.select().from(careers).where(eq(careers.id, careerId));
    expect(careerRow?.revision).toBe(2);
    expect(await ctx.db.select().from(snapshots).where(eq(snapshots.careerId, careerId))).toHaveLength(2);
    expect(await ctx.db.select().from(commandLog).where(eq(commandLog.careerId, careerId))).toHaveLength(2);
  }, 60_000);

  it('ARCHIVED 커리어에 PUT하면 409 CAREER_ARCHIVED', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_archived_1';

    await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
        ifMatch: '0',
        cookie,
      }),
      ctx.env,
    );
    await ctx.db.update(careers).set({ status: 'ARCHIVED' }).where(eq(careers.id, careerId));

    const res = await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 1, commandRevisions: [2], snapshotRevision: 2 }),
        ifMatch: '1',
        cookie,
        idempotencyKey: 'idem-archived-1',
      }),
      ctx.env,
    );
    expect(res.status).toBe(409);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('CAREER_ARCHIVED');
  });

  it('보존: revision 1~8을 순서대로 동기화하면 snapshots는 4~8만, command_log는 8개 전부 남는다', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_prune_1';

    for (let revision = 1; revision <= 8; revision++) {
      const res = await app.request(
        `/v1/careers/${careerId}`,
        putInit({
          body: await putCareerBody({
            careerId,
            baseRevision: revision - 1,
            commandRevisions: [revision],
            snapshotRevision: revision,
          }),
          ifMatch: String(revision - 1),
          cookie,
          idempotencyKey: `idem-prune-${revision}`,
        }),
        ctx.env,
      );
      expect(res.status).toBe(200);
    }

    const remainingSnapshots = await ctx.db
      .select({ revision: snapshots.revision })
      .from(snapshots)
      .where(eq(snapshots.careerId, careerId));
    expect(remainingSnapshots.map((row) => row.revision).sort((a, b) => a - b)).toEqual([4, 5, 6, 7, 8]);

    const remainingCommands = await ctx.db
      .select({ revision: commandLog.revision })
      .from(commandLog)
      .where(eq(commandLog.careerId, careerId));
    expect(remainingCommands.map((row) => row.revision).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('재업로드: 같은 revision·같은 hash는 200(쓰기 없음), 같은 revision·다른 hash는 409', async () => {
    const { cookie } = await issueCookie(ctx);
    const app = createApp();
    const careerId = 'car_reupload_1';

    let lastBody: Awaited<ReturnType<typeof putCareerBody>> | undefined;
    for (let revision = 1; revision <= 3; revision++) {
      lastBody = await putCareerBody({
        careerId,
        baseRevision: revision - 1,
        commandRevisions: [revision],
        snapshotRevision: revision,
      });
      await app.request(
        `/v1/careers/${careerId}`,
        putInit({ body: lastBody, ifMatch: String(revision - 1), cookie, idempotencyKey: `idem-reupload-${revision}` }),
        ctx.env,
      );
    }

    const sameHashRes = await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: { ...lastBody!, baseRevision: 3, commands: [] },
        ifMatch: '3',
        cookie,
        idempotencyKey: 'idem-reupload-same',
      }),
      ctx.env,
    );
    expect(sameHashRes.status).toBe(200);
    expect(await ctx.db.select().from(snapshots).where(eq(snapshots.careerId, careerId))).toHaveLength(3);

    const differentHashBody = await putCareerBody({
      careerId,
      baseRevision: 3,
      commandRevisions: [],
      snapshotRevision: 3,
      draws: 9999,
    });
    const differentHashRes = await app.request(
      `/v1/careers/${careerId}`,
      putInit({ body: differentHashBody, ifMatch: '3', cookie, idempotencyKey: 'idem-reupload-diff' }),
      ctx.env,
    );
    expect(differentHashRes.status).toBe(409);
    expect(ErrorEnvelopeSchema.parse(await differentHashRes.json()).error.code).toBe('CAREER_REVISION_CONFLICT');
  });

  it('세션 없이 커리어 라우트를 호출하면 401 PROFILE_REQUIRED', async () => {
    const app = createApp();
    const careerId = 'car_no_session';

    const list = await app.request('/v1/careers', {}, ctx.env);
    expect(list.status).toBe(401);
    expect(ErrorEnvelopeSchema.parse(await list.json()).error.code).toBe('PROFILE_REQUIRED');

    const getOne = await app.request(`/v1/careers/${careerId}`, {}, ctx.env);
    expect(getOne.status).toBe(401);

    const put = await app.request(
      `/v1/careers/${careerId}`,
      putInit({
        body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
        ifMatch: '0',
      }),
      ctx.env,
    );
    expect(put.status).toBe(401);
  });

  describe('DELETE /v1/careers/:id (API-CAR-005)', () => {
    function deleteInit(input: { idempotencyKey?: string | null; cookie?: string; origin?: string | null }): RequestInit {
      const { idempotencyKey = 'idem-key-0001', cookie, origin = ALLOWED_ORIGIN } = input;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (origin !== null) headers.Origin = origin;
      if (idempotencyKey !== null) headers['Idempotency-Key'] = idempotencyKey;
      if (cookie) headers.Cookie = cookie;
      return { method: 'DELETE', headers, body: '{}' };
    }

    it('204로 삭제되고, 두 번째 호출은 404, 목록에서 빠진다', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_delete_1';

      await app.request(
        `/v1/careers/${careerId}`,
        putInit({
          body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
          ifMatch: '0',
          cookie,
        }),
        ctx.env,
      );

      const firstDelete = await app.request(
        `/v1/careers/${careerId}`,
        deleteInit({ cookie, idempotencyKey: 'idem-delete-1' }),
        ctx.env,
      );
      expect(firstDelete.status).toBe(204);

      const secondDelete = await app.request(
        `/v1/careers/${careerId}`,
        deleteInit({ cookie, idempotencyKey: 'idem-delete-2' }),
        ctx.env,
      );
      expect(secondDelete.status).toBe(404);
      expect(ErrorEnvelopeSchema.parse(await secondDelete.json()).error.code).toBe('CAREER_NOT_FOUND');

      const listRes = await app.request('/v1/careers', getInit(cookie), ctx.env);
      const listBody = successEnvelope(CareerSummaryListSchema).parse(await listRes.json());
      expect(listBody.data.items).toHaveLength(0);

      expect(await ctx.db.select().from(snapshots).where(eq(snapshots.careerId, careerId))).toHaveLength(0);
      expect(await ctx.db.select().from(commandLog).where(eq(commandLog.careerId, careerId))).toHaveLength(0);
    });

    it('다른 사람 소유는 404 CAREER_NOT_FOUND(존재를 드러내지 않는다)', async () => {
      const owner = await issueCookie(ctx);
      const stranger = await issueCookie(ctx);
      const app = createApp();
      const careerId = 'car_delete_stranger';

      await app.request(
        `/v1/careers/${careerId}`,
        putInit({
          body: await putCareerBody({ careerId, baseRevision: 0, commandRevisions: [1], snapshotRevision: 1 }),
          ifMatch: '0',
          cookie: owner.cookie,
        }),
        ctx.env,
      );

      const res = await app.request(
        `/v1/careers/${careerId}`,
        deleteInit({ cookie: stranger.cookie, idempotencyKey: 'idem-delete-stranger' }),
        ctx.env,
      );
      expect(res.status).toBe(404);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('CAREER_NOT_FOUND');

      const [careerRow] = await ctx.db.select().from(careers).where(eq(careers.id, careerId));
      expect(careerRow).toBeDefined();
    });

    it('없는 id는 404', async () => {
      const { cookie } = await issueCookie(ctx);
      const app = createApp();

      const res = await app.request('/v1/careers/car_never_existed', deleteInit({ cookie }), ctx.env);
      expect(res.status).toBe(404);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('CAREER_NOT_FOUND');
    });

    it('세션이 없으면 401', async () => {
      const app = createApp();
      const res = await app.request('/v1/careers/car_no_session_delete', deleteInit({}), ctx.env);
      expect(res.status).toBe(401);
    });
  });
});
