import {
  COMP_CUSTOM_PATH,
  CompCustomResponseSchema,
  PutCompCustomBodySchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { ok, readBody } from './shared.js';
import { clubLogoStoreOf } from '../db/repos/clubCustom.js';
import { getCompCustom, putCompCustom } from '../db/repos/compCustom.js';
import { getDb, type AppEnv } from '../env.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

/** T-11-684. 대회 · 수상 이름과 리그 · 대회 로고 동기화. 구단 꾸미기와 같이 PUT은 전체 교체 + updatedAt 비교라 자연 멱등이다. */
export function registerCompCustomRoutes(app: Hono<AppEnv>): void {
  app.get(COMP_CUSTOM_PATH, requireProfile, async (c) => {
    // ?since=마지막으로 맞춘 updatedAt — 같으면 비워 보낸다(클라이언트는 updatedAt이 같으면 받은 값을 쓰지 않는다).
    const saved = await getCompCustom(
      getDb(c),
      getSessionOrThrow(c).profileId,
      c.req.query('since'),
      clubLogoStoreOf(c.env),
    );
    return ok(c, CompCustomResponseSchema, saved ?? { names: {}, icons: {}, updatedAt: null });
  });

  app.put(COMP_CUSTOM_PATH, requireProfile, async (c) => {
    const input = readBody(c, PutCompCustomBodySchema);
    const saved = await putCompCustom(
      getDb(c),
      getSessionOrThrow(c).profileId,
      input,
      clubLogoStoreOf(c.env),
    );
    return ok(c, CompCustomResponseSchema, saved);
  });
}
