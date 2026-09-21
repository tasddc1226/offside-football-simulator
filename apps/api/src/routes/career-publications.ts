import {
  CareerArticleSchema,
  CreateCareerPayloadSchema,
  GetCareerResponseSchema,
  PublishCareerSchema,
  StartCareerChallengeSchema,
} from '@offside/contracts';
import { sha256Hex } from '@offside/domain';
import { and, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import type { Db } from '../db/client.js';
import {
  careerArchives,
  careerChallengeAdmissions,
  careerPublications,
  careers,
  commandLog,
  snapshots,
} from '../db/schema.js';
import { getCareer } from '../db/repos/careers.js';
import { getServiceSeasonById } from '../db/repos/serviceSeasons.js';
import { getAttemptCount, recordAttempt } from '../db/repos/authAttempts.js';
import { runBatch } from '../db/repos/batch.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { articleFromArchive, buildChallengeStart } from '../publications.js';

function unavailable(): never {
  throw new AppError({
    code: 'CAREER_NOT_FOUND',
    message: '공개된 커리어 기사를 찾을 수 없습니다.',
  });
}
function body(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? '{}');
  } catch {
    throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바르지 않습니다.' });
  }
}
async function limit(db: Db, owner: string, now: string) {
  await recordAttempt(db, 'CAREER_PUBLICATION', owner, now, 60_000);
  if ((await getAttemptCount(db, 'CAREER_PUBLICATION', owner, now, 60_000)) > 10)
    throw new AppError({ code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요.' });
}
async function owned(db: Db, id: string, owner: string) {
  const career = await getCareer(db, id);
  if (!career || career.ownerProfileId !== owner) unavailable();
  return career;
}
export function registerCareerPublicationRoutes(app: Hono<AppEnv>) {
  app.use('/v1/articles/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.get('/v1/careers/:id/publication', requireProfile, async (c) => {
    const db = getDb(c);
    const career = await owned(db, c.req.param('id'), getSessionOrThrow(c).profileId);
    const [row] = await db
      .select()
      .from(careerPublications)
      .where(eq(careerPublications.careerId, career.id));
    c.header('Cache-Control', 'no-store');
    return c.json({
      data: { article: row ? CareerArticleSchema.parse(JSON.parse(row.articleJson)) : null },
      meta: { requestId: c.get('requestId') },
    });
  });
  app.post('/v1/careers/:id/publication', requireProfile, idempotency, async (c) => {
    parseWithAppError(PublishCareerSchema, body(c.get('rawBody')));
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    const now = new Date().toISOString();
    await limit(db, owner, now);
    const career = await owned(db, c.req.param('id'), owner);
    if (career.status !== 'RETIRED' && career.status !== 'ARCHIVED')
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '은퇴 후 동기화한 커리어만 공개할 수 있습니다.',
      });
    const [archive] = await db
      .select()
      .from(careerArchives)
      .where(eq(careerArchives.careerId, career.id));
    if (!archive)
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '은퇴 기록을 먼저 동기화해 주세요.',
      });
    const [initial] = await db
      .select()
      .from(commandLog)
      .where(and(eq(commandLog.careerId, career.id), eq(commandLog.revision, 1)));
    if (!initial || initial.commandType !== 'CREATE_CAREER')
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '최초 생성 기록이 없어 동일 조건 도전을 만들 수 없습니다.',
      });
    const creation = parseWithAppError(CreateCareerPayloadSchema, body(initial.payloadJson));
    if (
      creation.careerId !== career.id ||
      creation.rulesetVersion !== career.rulesetVersion ||
      creation.contentPackVersion !== career.contentPackVersion
    )
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '최초 생성 기록이 일치하지 않습니다.',
      });
    const article = articleFromArchive(
      career,
      archive.archiveJson,
      creation.seed,
      creation.simulationMode,
      crypto.randomUUID(),
      now,
    );
    await db
      .insert(careerPublications)
      .values({
        id: article.id,
        careerId: career.id,
        articleJson: JSON.stringify(article),
        createdAt: now,
      })
      .onConflictDoNothing();
    const [saved] = await db
      .select()
      .from(careerPublications)
      .where(eq(careerPublications.careerId, career.id));
    if (!saved) unavailable();
    return c.json({
      data: CareerArticleSchema.parse(JSON.parse(saved.articleJson)),
      meta: { requestId: c.get('requestId') },
    });
  });
  app.delete('/v1/careers/:id/publication', requireProfile, async (c) => {
    const db = getDb(c);
    const career = await owned(db, c.req.param('id'), getSessionOrThrow(c).profileId);
    await db.delete(careerPublications).where(eq(careerPublications.careerId, career.id));
    return c.body(null, 204);
  });
  app.get('/v1/articles/:id', async (c) => {
    const [row] = await getDb(c)
      .select()
      .from(careerPublications)
      .where(eq(careerPublications.id, c.req.param('id')));
    if (!row) unavailable();
    return c.json({
      data: CareerArticleSchema.parse(JSON.parse(row.articleJson)),
      meta: { requestId: c.get('requestId') },
    });
  });
  app.post('/v1/articles/:id/challenge', requireProfile, async (c) => {
    const requestKey = c.req.header('Idempotency-Key');
    if (!requestKey || !/^[A-Za-z0-9_-]{8,128}$/.test(requestKey))
      throw new AppError({ code: 'VALIDATION_FAILED', message: 'Idempotency-Key가 필요합니다.' });
    const input = parseWithAppError(StartCareerChallengeSchema, body(c.get('rawBody')));
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    const now = new Date().toISOString();
    const keyHash = sha256Hex(JSON.stringify([owner, requestKey]));
    const requestHash = sha256Hex(JSON.stringify([c.req.param('id'), input.name]));
    const replay = async () => {
      const [saved] = await db
        .select()
        .from(careerChallengeAdmissions)
        .where(eq(careerChallengeAdmissions.keyHash, keyHash));
      if (!saved) return null;
      await owned(db, saved.careerId, owner);
      if (saved.requestHash !== requestHash)
        throw new AppError({
          code: 'VALIDATION_FAILED',
          message: '같은 요청 키에 다른 도전을 보낼 수 없습니다.',
        });
      return GetCareerResponseSchema.parse(JSON.parse(saved.responseJson));
    };
    const previous = await replay();
    if (previous) return c.json({ data: previous, meta: { requestId: c.get('requestId') } }, 201);
    await limit(db, owner, now);
    const [row] = await db
      .select()
      .from(careerPublications)
      .where(eq(careerPublications.id, c.req.param('id')));
    if (!row) unavailable();
    const season = await getServiceSeasonById(db, c.env.ACTIVE_SERVICE_SEASON_ID ?? '');
    if (!season || (season.status !== 'ACTIVE' && season.status !== 'PRESEASON'))
      throw new AppError({
        code: 'SERVICE_SEASON_CLOSED',
        message: '새 커리어를 시작할 수 있는 시즌이 아닙니다.',
      });
    const id = crypto.randomUUID();
    const started = buildChallengeStart(
      CareerArticleSchema.parse(JSON.parse(row.articleJson)),
      id,
      input.name,
      season.id,
      now,
    );
    const snapshot = started.snapshot;
    try {
      await runBatch(db, [
        db
          .insert(careers)
          .values({
            id,
            ownerProfileId: owner,
            status: 'ACTIVE',
            revision: snapshot.revision,
            createdServiceSeasonId: season.id,
            rulesetVersion: snapshot.rulesetVersion,
            contentPackVersion: snapshot.contentPackVersion,
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        db
          .insert(snapshots)
          .values({ ...snapshot, rngStateJson: JSON.stringify(snapshot.rngState) }),
        ...started.commands.map((command) =>
          db
            .insert(commandLog)
            .values({
              careerId: id,
              revision: command.revision,
              commandId: command.commandId,
              commandType: command.commandType,
              payloadJson: JSON.stringify(command.payload),
              resultHash: command.resultHash,
              createdAt: now,
            }),
        ),
        db
          .insert(careerChallengeAdmissions)
          .values({ keyHash, careerId: id, requestHash, responseJson: JSON.stringify(started) }),
      ]);
    } catch (error) {
      const winner = await replay();
      if (winner) return c.json({ data: winner, meta: { requestId: c.get('requestId') } }, 201);
      throw error;
    }
    // No foreign key to the source: publication revocation never erases independent play.
    return c.json({ data: started, meta: { requestId: c.get('requestId') } }, 201);
  });
}
