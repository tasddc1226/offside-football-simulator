import {
  CareerIdParamSchema,
  HofDetailResponseSchema,
  HofListQuerySchema,
  HofListResponseSchema,
  HofPageQuerySchema,
  HofSortSchema,
  successEnvelope,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { getPublicHof, listPublicHof } from '../db/repos/careers.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';

// T-10-005 공개 명예의 전당. 로그인 없이 누구나 읽는다 — 응답에는 유저가 공개를 고른 이름과 커리어
// 기록만 있고 프로필·계정 정보는 없다. D1 읽기를 줄이려고 짧게 캐시한다.
const CACHE = 'public, max-age=60';
/** 엣지 캐시 TTL(초). 목록은 새 은퇴가 1분 안에 보이게, 상세는 은퇴 PUT(이름 공개 토글) 때 지운다. */
const LIST_TTL = 60;
const DETAIL_TTL = 300;

export function registerHofRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/hof', async (c) => {
    const limit = parseWithAppError(HofListQuerySchema, c.req.query('limit'));
    const page = parseWithAppError(HofPageQuerySchema, c.req.query('page'));
    const sort = parseWithAppError(HofSortSchema, c.req.query('sort'));
    const data = await edgeCached(c, EDGE.hofList(limit, page, sort), LIST_TTL, () => listPublicHof(getDb(c), limit, page, sort));
    const body = successEnvelope(HofListResponseSchema).parse({ data, meta: { requestId: c.get('requestId') } });
    c.header('Cache-Control', CACHE);
    return c.json(body, 200);
  });

  app.get('/v1/hof/:careerId', async (c) => {
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const found = await edgeCached(c, EDGE.hofDetail(careerId), DETAIL_TTL, () => getPublicHof(getDb(c), careerId));
    if (!found) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        status: 404,
        message: '명예의 전당에 없는 선수입니다.',
        details: { reason: 'HOF_NOT_FOUND' },
      });
    }
    const body = successEnvelope(HofDetailResponseSchema).parse({ data: found, meta: { requestId: c.get('requestId') } });
    c.header('Cache-Control', CACHE);
    return c.json(body, 200);
  });
}
