import {
  CareerIdParamSchema,
  DailyRankResponseSchema,
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
import { notFoundError, nowIso, ok } from './shared.js';
import { getPublicHof, listPublicHof } from '../db/repos/careers.js';
import { ensureHofBackfilled } from '../db/repos/hofBackfill.js';
import { edgeCached, waitUntil } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, getPublicReadDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { sharedCount } from '../hof/sharedCount.js';
import { readDailyRank } from '../team/dailyRank.js';
import { dailyRankDays } from '@offside/contracts/daily-rank';

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
    const started = Date.now();
    let loaded = false;
    let backfillMs = 0;
    let listMs = 0;
    let countMs = 0;
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
        loaded = true;
        const db = getDb(c);
        const readDb = getPublicReadDb(c);
        // 모두 한 번뿐인 소급 — 조회마다 한 조각씩 나아간다(몸값은 리그 이름으로도 매겨 순서에 기대지 않는다).
        // This first-primary metadata SELECT anchors the SAME session used by later reads.
        const beforeBackfill = Date.now();
        filling = await ensureHofBackfilled(db, readDb);
        backfillMs = Date.now() - beforeBackfill;
        const beforeList = Date.now();
        return listPublicHof(
          filling ? db : readDb,
          limit,
          page,
          sort,
          season,
          q,
          pos,
          dpos,
          async (load) => {
            const beforeCount = Date.now();
            try {
              return await (q
                ? load()
                : edgeCached(
                    c,
                    EDGE.hofCount(sort, season?.id, pos, dpos),
                    COUNT_TTL,
                    // T-11-688 엣지 캐시가 끝난 데이터센터마다 다시 세지 않고 D1에 한 벌만 둔 값을 읽는다.
                    () =>
                      filling
                        ? load()
                        : sharedCount(
                            readDb.$client,
                            EDGE.hofCount(sort, season?.id, pos, dpos),
                            load,
                            (p) => waitUntil(c, p),
                          ),
                    () => !filling,
                  ));
            } finally {
              countMs = Date.now() - beforeCount;
            }
          },
        ).finally(() => {
          listMs = Date.now() - beforeList;
        });
      },
      () => !filling,
    );
    const routeMs = Date.now() - started;
    const beforeRouteMs = Math.max(0, started - (c.get('startedAt') ?? started));
    const ms = routeMs + beforeRouteMs;
    if (ms >= 1000)
      console.info(
        JSON.stringify({
          job: 'hof-read',
          requestId: c.get('requestId'),
          ms,
          beforeRouteMs,
          routeMs,
          edgeHit: !loaded,
          backfillMs,
          listMs,
          countMs,
          edgeMs: Math.max(0, routeMs - backfillMs - listMs),
          sort,
          season: season?.id ?? null,
          pos: pos ?? null,
          dpos: dpos ?? null,
          page,
          limit,
          search: !!q,
          filling,
          readSessions: c.env.D1_READ_SESSIONS_DISABLED !== '1',
        }),
      );
    return ok(c, HofListResponseSchema, data, 200, CACHE);
  });

  // T-11-723 오늘의 랭킹 — 오늘(한국 시각) 은퇴한 선수의 레전드 점수 순위와 어제 1 · 2 · 3위. 모두에게 같아 날짜마다 한 벌을
  // 1분 엣지 캐시에 담는다(세션을 보지 않는다). '/v1/hof/:careerId'보다 먼저 등록한다.
  app.get('/v1/hof/daily', async (c) => {
    const now = nowIso();
    const data = await edgeCached(c, EDGE.dailyRank(dailyRankDays(now).today), LIST_TTL, () =>
      readDailyRank(getPublicReadDb(c), now),
    );
    return ok(c, DailyRankResponseSchema, data, 200, CACHE);
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
