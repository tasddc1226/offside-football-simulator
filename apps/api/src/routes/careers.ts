import {
  CareerIdParamSchema,
  CareerUpsertResponseSchema,
  CareerYearParamSchema,
  PutCareerSeasonBodySchema,
  PutRetirementBodySchema,
  RetirementResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { getCareer, getCareerOwner, putCareerSeason, putRetirement } from '../db/repos/careers.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

function parseJsonBody(rawBody: string): unknown {
  try {
    return rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
  }
}

/** 소유권 확인: careerId가 이미 다른 프로필 소유면 409. 없으면(새 커리어) 통과. */
async function assertOwnable(db: ReturnType<typeof getDb>, careerId: string, profileId: string): Promise<void> {
  const owner = await getCareerOwner(db, careerId);
  if (owner !== undefined && owner !== profileId) {
    throw new AppError({
      code: 'CAREER_OWNER_MISMATCH',
      message: '이 커리어 ID는 다른 프로필 소유입니다.',
    });
  }
}

export function registerCareerRoutes(app: Hono<AppEnv>): void {
  // 두 라우트 모두 URL 키(career_id+year, career_id)로 이미 자연스럽게 멱등이라 Idempotency-Key
  // 미들웨어를 걷지 않는다(같은 키로 재전송해도 결과가 같다 — upsert이기 때문).
  app.put('/v1/careers/:careerId/seasons/:year', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const year = parseWithAppError(CareerYearParamSchema, c.req.param('year'));

    await assertOwnable(db, careerId, session.profileId);

    const rawBody = c.get('rawBody') ?? '';
    const json = parseJsonBody(rawBody);
    const body = parseWithAppError(PutCareerSeasonBodySchema, json);
    const now = new Date().toISOString();

    await putCareerSeason(db, {
      careerId,
      profileId: session.profileId,
      year,
      meta: body.career,
      season: body.season,
      eventsJson: JSON.stringify(body.events),
      now,
    });

    const career = await getCareer(db, careerId);
    const responseBody = successEnvelope(CareerUpsertResponseSchema).parse({
      data: { careerId, year, status: career?.status ?? 'active' },
      meta: { requestId: c.get('requestId') },
    });
    return c.json(responseBody, 200);
  });

  app.put('/v1/careers/:careerId/retirement', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));

    const owner = await getCareerOwner(db, careerId);
    if (owner === undefined) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '존재하지 않는 커리어입니다.',
        details: { reason: 'CAREER_NOT_FOUND' },
      });
    }
    if (owner !== session.profileId) {
      throw new AppError({
        code: 'CAREER_OWNER_MISMATCH',
        message: '이 커리어 ID는 다른 프로필 소유입니다.',
      });
    }

    const rawBody = c.get('rawBody') ?? '';
    const json = parseJsonBody(rawBody);
    const summary = parseWithAppError(PutRetirementBodySchema, json);
    const now = new Date().toISOString();

    await putRetirement(db, { careerId, summary, now });

    const responseBody = successEnvelope(RetirementResponseSchema).parse({
      data: { careerId, status: 'retired' },
      meta: { requestId: c.get('requestId') },
    });
    return c.json(responseBody, 200);
  });
}
