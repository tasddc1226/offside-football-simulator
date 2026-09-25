import { ClubCustomResponseSchema, PutClubCustomBodySchema, successEnvelope } from '@offside/contracts';
import type { Hono } from 'hono';
import { getClubCustom, putClubCustom } from '../db/repos/clubCustom.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

/** T-10-010. 클럽 이름·엠블럼 커스텀 동기화. PUT은 전체 교체 + updatedAt 비교라 자연 멱등이다. */
export function registerClubCustomRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/club-custom', requireProfile, async (c) => {
    const saved = await getClubCustom(getDb(c), getSessionOrThrow(c).profileId);
    const body = successEnvelope(ClubCustomResponseSchema).parse({
      data: saved ?? { clubs: {}, updatedAt: null },
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });

  app.put('/v1/club-custom', requireProfile, async (c) => {
    let json: unknown;
    try {
      json = JSON.parse(c.get('rawBody') ?? '');
    } catch {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
    }
    const input = parseWithAppError(PutClubCustomBodySchema, json);
    const saved = await putClubCustom(getDb(c), getSessionOrThrow(c).profileId, input.clubs, input.updatedAt);
    const body = successEnvelope(ClubCustomResponseSchema).parse({ data: saved, meta: { requestId: c.get('requestId') } });
    return c.json(body, 200);
  });
}
