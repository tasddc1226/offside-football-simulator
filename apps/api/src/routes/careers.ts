import {
  CareerSummaryListSchema,
  GetCareerResponseSchema,
  IF_MATCH_HEADER,
  PutCareerBodySchema,
  PutCareerResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { applySync } from '../sync/apply-sync.js';
import { listCommandsSince } from '../db/repos/commandLog.js';
import { deleteCareerCascade, getCareer, listCareersByOwner } from '../db/repos/careers.js';
import { getLatestSnapshot } from '../db/repos/snapshots.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { eq } from 'drizzle-orm';
import { careerArchives } from '../db/schema.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw: string | undefined): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

function parseSince(raw: string | undefined): number {
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export function registerCareerRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/careers', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const limit = parseLimit(c.req.query('limit'));
    const cursor = c.req.query('cursor') ?? null;

    const { items, nextCursor } = await listCareersByOwner(db, session.profileId, { limit, cursor });

    const body = successEnvelope(CareerSummaryListSchema).parse({
      data: {
        items: items.map((item) => ({
          id: item.id,
          status: item.status,
          revision: item.revision,
          lastSyncedAt: item.lastSyncedAt,
          createdServiceSeasonId: item.createdServiceSeasonId,
          rulesetVersion: item.rulesetVersion,
          contentPackVersion: item.contentPackVersion,
        })),
        nextCursor,
      },
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });

  app.get('/v1/careers/:id', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = c.req.param('id');

    const career = await getCareer(db, careerId);
    if (!career) {
      throw new AppError({ code: 'CAREER_NOT_FOUND', message: '커리어를 찾을 수 없습니다.' });
    }
    if (career.ownerProfileId !== session.profileId) {
      throw new AppError({ code: 'CAREER_NOT_OWNED', message: '이 커리어의 소유자가 아닙니다.' });
    }

    const snapshot = await getLatestSnapshot(db, careerId);
    if (!snapshot) {
      throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: '커리어의 Snapshot을 찾을 수 없습니다.' });
    }

    const since = parseSince(c.req.query('since'));
    const commands = await listCommandsSince(db, careerId, since);
    const [archive] = await db.select().from(careerArchives).where(eq(careerArchives.careerId, careerId)).limit(1);

    const body = successEnvelope(GetCareerResponseSchema).parse({
      data: {
        createdServiceSeasonId: career.createdServiceSeasonId,
        ...(archive === undefined ? {} : { retirementArchive: { archive: archive.archiveJson, legacy: archive.legacyJson } }),
        snapshot: {
          id: snapshot.id,
          careerId: snapshot.careerId,
          revision: snapshot.revision,
          checkpoint: snapshot.checkpoint,
          state: snapshot.state,
          stateHash: snapshot.stateHash,
          rulesetVersion: snapshot.rulesetVersion,
          contentPackVersion: snapshot.contentPackVersion,
          rngState: snapshot.rngState,
          createdAt: snapshot.createdAt,
        },
        commands: commands.map((command) => ({
          careerId: command.careerId,
          revision: command.revision,
          commandId: command.commandId,
          commandType: command.commandType,
          payload: command.payload,
          resultHash: command.resultHash,
          createdAt: command.createdAt,
        })),
      },
      meta: { requestId: c.get('requestId'), careerRevision: career.revision },
    });
    return c.json(body, 200);
  });

  app.put('/v1/careers/:id', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = c.req.param('id');
    const rawBody = c.get('rawBody') ?? '';

    let json: unknown;
    try {
      json = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
    }

    const body = parseWithAppError(PutCareerBodySchema, json);

    // 설계 결정 1: If-Match와 baseRevision은 같아야 한다.
    const ifMatch = c.req.header(IF_MATCH_HEADER);
    if (ifMatch === undefined) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: 'If-Match 헤더가 필요합니다.',
        details: { reason: 'IF_MATCH_REQUIRED' },
      });
    }
    if (ifMatch !== String(body.baseRevision)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: 'If-Match가 baseRevision과 일치하지 않습니다.',
        details: { reason: 'IF_MATCH_MISMATCH' },
      });
    }

    const now = new Date().toISOString();
    const result = await applySync(db, { profileId: session.profileId, careerId, body, now });

    const responseBody = successEnvelope(PutCareerResponseSchema).parse({
      data: {
        revision: result.revision,
        syncedAt: result.syncedAt,
        verificationStatus: result.verificationStatus,
      },
      meta: { requestId: c.get('requestId'), careerRevision: result.revision },
    });
    return c.json(responseBody, 200);
  });

  // API-CAR-005. 다른 사람 소유도 존재를 드러내지 않기 위해 404로 응답한다(GET의 403 CAREER_NOT_OWNED와 다르다).
  app.delete('/v1/careers/:id', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = c.req.param('id');

    const career = await getCareer(db, careerId);
    if (!career || career.ownerProfileId !== session.profileId) {
      throw new AppError({ code: 'CAREER_NOT_FOUND', message: '커리어를 찾을 수 없습니다.' });
    }

    await deleteCareerCascade(db, careerId);
    return c.body(null, 204);
  });
}
