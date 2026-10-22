import {
  CareerIdParamSchema,
  HofDetailResponseSchema,
  HofListQuerySchema,
  HofListResponseSchema,
  HofPageQuerySchema,
  HofPosQuerySchema,
  HofDetailPosQuerySchema,
  HofSearchQuerySchema,
  HofSeasonQuerySchema,
  HofSortSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { notFoundError, ok } from './shared.js';
import { getPublicHof, listPublicHof } from '../db/repos/careers.js';
import { ensureHofBackfilled } from '../db/repos/hofBackfill.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, getPublicReadDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';

// T-10-005 공개 명예의 전당. 로그인 없이 누구나 읽는다 — 응답에는 유저가 공개를 고른 이름과 커리어
// 기록만 있고 프로필·계정 정보는 없다. D1 읽기를 줄이려고 짧게 캐시한다.
const CACHE = 'public, max-age=60';
/** 엣지 캐시 TTL(초). 목록은 새 은퇴가 1분 안에 보이게, 상세는 은퇴 PUT(이름 공개 토글) 때 지운다. */
const LIST_TTL = 60;
const DETAIL_TTL = 300;
/** T-11-257 전체 인원 TTL(초). 페이지를 넘길 때마다 6만 행 넘게 다시 세지 않게 목록보다 길게 둔다 — 새 은퇴는 5분 안에 반영된다. */
const COUNT_TTL = 300;

export function registerHofRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/hof', async (c) => {
    const limit = parseWithAppError(HofListQuerySchema, c.req.query('limit'));
    const page = parseWithAppError(HofPageQuerySchema, c.req.query('page'));
    const sort = parseWithAppError(HofSortSchema, c.req.query('sort'));
    // T-10-090 시즌 순위. 없으면 전체 명예의 전당.
    const season = parseWithAppError(HofSeasonQuerySchema, c.req.query('season'));
    // T-10-101 공개 이름 검색.
    const q = parseWithAppError(HofSearchQuerySchema, c.req.query('q'));
    // T-11-018 포지션별 순위.
    const pos = parseWithAppError(HofPosQuerySchema, c.req.query('pos'));
    const dpos = parseWithAppError(HofDetailPosQuerySchema, c.req.query('dpos'));
    // T-10-081 옛 기록 구단 id 채우기가 끝날 때까지는 캐시하지 않는다(데이터센터마다 1분에 한 조각씩만 나아가지 않게).
    let filling = false;
    const data = await edgeCached(
      c,
      EDGE.hofList(limit, page, sort, season?.id, q, pos, dpos),
      LIST_TTL,
      async () => {
        const db = getDb(c);
        // 모두 한 번뿐인 소급 — 조회마다 한 조각씩 나아간다(몸값은 리그 이름으로도 매겨 순서에 기대지 않는다).
        filling = await ensureHofBackfilled(db);
        return listPublicHof(
          filling ? db : getPublicReadDb(c),
          limit,
          page,
          sort,
          season,
          q,
          pos,
          dpos,
          (load) =>
            q
              ? load()
              : edgeCached(
                  c,
                  EDGE.hofCount(sort, season?.id, pos, dpos),
                  COUNT_TTL,
                  load,
                  () => !filling,
                ),
        );
      },
      () => !filling,
    );
    return ok(c, HofListResponseSchema, data, 200, CACHE);
  });

  app.get('/v1/hof/:careerId', async (c) => {
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const found = await edgeCached(c, EDGE.hofDetail(careerId), DETAIL_TTL, () =>
      getPublicHof(getDb(c), careerId, c.env),
    );
    if (!found) throw notFoundError('명예의 전당에서 선수를 찾지 못했어요.', 'HOF_NOT_FOUND');
    return ok(c, HofDetailResponseSchema, found, 200, CACHE);
  });
}
