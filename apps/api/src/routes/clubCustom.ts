import { ClubCustomResponseSchema, PutClubCustomBodySchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { ok, readBody } from './shared.js';
import { getClubCustom, putClubCustom } from '../db/repos/clubCustom.js';
import { getDb, type AppEnv } from '../env.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

/** T-10-010. 클럽 이름·엠블럼 커스텀 동기화. PUT은 전체 교체 + updatedAt 비교라 자연 멱등이다. */
export function registerClubCustomRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/club-custom', requireProfile, async (c) => {
    const saved = await getClubCustom(getDb(c), getSessionOrThrow(c).profileId);
    return ok(c, ClubCustomResponseSchema, saved ?? { clubs: {}, updatedAt: null });
  });

  app.put('/v1/club-custom', requireProfile, async (c) => {
    const input = readBody(c, PutClubCustomBodySchema);
    const saved = await putClubCustom(
      getDb(c),
      getSessionOrThrow(c).profileId,
      input.clubs,
      input.updatedAt,
    );
    return ok(c, ClubCustomResponseSchema, saved);
  });
}
