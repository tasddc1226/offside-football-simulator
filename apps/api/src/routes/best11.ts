import { Best11ResponseSchema, SeasonPickQuerySchema } from '@offside/contracts';
import { displaySeasonAt } from '@offside/contracts/service-seasons';
import type { Hono } from 'hono';
import { nowIso, ok } from './shared.js';
import { readBest11 } from '../db/repos/best11.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getPublicReadDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';

// T-11-463 시즌 BEST 11 공개 조회. 로그인 없이 누구나 같은 응답이라 세션 · 프로필을 읽지 않고 엣지에 담는다.
// 자리 주인이 바뀌면 은퇴 PUT · 매일 단계가 키를 지우고, 다른 데이터센터는 TTL 안에 따라온다.
const CACHE = 'public, max-age=60';
const TTL = 120;

export function registerBest11Routes(app: Hono<AppEnv>): void {
  app.get('/v1/best11', async (c) => {
    // ?season= 없으면 지금 시즌(휴식기면 마지막 시즌). 프리시즌(0)은 BEST 11이 없어 시즌 1을 보여 준다.
    const season = Math.max(
      1,
      parseWithAppError(SeasonPickQuerySchema, c.req.query('season')) ?? displaySeasonAt(nowIso()),
    );
    const data = await edgeCached(c, EDGE.best11(season), TTL, () =>
      readBest11(getPublicReadDb(c), season),
    );
    return ok(c, Best11ResponseSchema, data, 200, CACHE);
  });
}
