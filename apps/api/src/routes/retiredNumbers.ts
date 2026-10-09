import {
  CareerIdParamSchema,
  RetiredBeforeQuerySchema,
  RetiredClubQuerySchema,
  RetiredNumberCheckResponseSchema,
  RetiredNumbersResponseSchema,
  RetiredNumbersSummarySchema,
  SeasonPickQuerySchema,
  type RetiredNumberMiss,
  type RetiredNumberResult,
  type RetiredNumbersResponse,
} from '@offside/contracts';
import { displaySeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { careerOwnerMismatch, nowIso, ok } from './shared.js';
import { getCareerHead, verifiedRetiredTitle } from '../db/repos/careers.js';
import type { Db } from '../db/client.js';
import {
  ensureRetiredNumbersBackfilled,
  judgeRetiredNumber,
  listRetiredNumbers,
  pageRetiredNumbers,
  summarizeRetiredNumbers,
} from '../db/repos/retiredNumbers.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { publishRetiredNumber } from '../live/publish.js';
import { parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

// T-10-076 영구결번. 로그인 없이 누구나 읽는다 — 이름은 명예의 전당에 이름 공개를 고른 경우에만 있다.
const TTL = 60;

/** 은퇴 PUT 뒤에 부른다. 심사가 실패해도 은퇴 응답은 성공시키고 로그로만 남긴다(이름 공개 토글·다음 은퇴 PUT이 다시 심사한다). */
export async function judgeRetirement(
  c: Context<AppEnv>,
  careerId: string,
  now: string,
): Promise<{ retiredNumber: RetiredNumberResult | null; retiredNumberMiss?: RetiredNumberMiss }> {
  try {
    const { result, miss, season, claimed } = await judgeRetiredNumber(getDb(c), careerId, now);
    // 이미 가진 자리여도 이름 공개 토글이 목록의 이름을 바꾼다. 그 시즌의 목록만 낡는다(T-11-029).
    if (result?.kind === 'granted' && season !== undefined) {
      purgeEdge(c, STALE.retiredNumbersChanged(season, result.clubId));
    }
    // T-11-121 명예의 벽은 그 시즌 요약에도 실린다 — 막 받았거나 이름 공개를 바꿨을 수 있다.
    if (result?.kind === 'taken' && result.wallOfHonor && season !== undefined) {
      purgeEdge(c, STALE.wallOfHonorChanged(season, careerId));
    }
    if (claimed) publishRetiredNumber(c, claimed);
    return miss ? { retiredNumber: result, retiredNumberMiss: miss } : { retiredNumber: result };
  } catch (err) {
    c.set('storeFailure', {
      code: 'RETIRED_NUMBER_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
    return { retiredNumber: null };
  }
}

export function registerRetiredNumberRoutes(app: Hono<AppEnv>): void {
  // 내 선수의 심사 결과. 은퇴 PUT 응답을 받지 못한 기록(배포 전 은퇴를 소급으로 심사한 결번, 이미 찬 자리)을 이 기기가
  // 은퇴 상세를 열 때 한 번 묻는다. 은퇴 PUT과 같은 심사라 이름을 공개했고 자리가 비어 있으면 이때 자리를 잡는다.
  app.get('/v1/careers/:careerId/retired-number', requireProfile, async (c) => {
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const career = await getCareerHead(getDb(c), careerId);
    if (career?.profileId !== getSessionOrThrow(c).profileId) throw careerOwnerMismatch();
    const judged = await judgeRetirement(c, careerId, nowIso());
    return ok(
      c,
      RetiredNumberCheckResponseSchema,
      { ...judged, title: verifiedRetiredTitle(career) },
      200,
      'private, no-store',
    );
  });

  // T-11-029 ?season= 없으면 지금 시즌(개막 전이면 프리시즌, 휴식기면 마지막 시즌). 캐시 키는 시즌을 푼 경로다.
  const seasonOf = (c: Context<AppEnv>) =>
    parseWithAppError(SeasonPickQuerySchema, c.req.query('season')) ?? displaySeasonAt(nowIso());
  // 기존 은퇴를 훑는 중이면 캐시하지 않는다 — 조회마다 한 조각씩 나아간다.
  const cachedRead = async <T>(c: Context<AppEnv>, path: string, read: (db: Db) => Promise<T>) => {
    let rescanning = false;
    return edgeCached(
      c,
      path,
      TTL,
      async () => {
        const db = getDb(c);
        rescanning = await ensureRetiredNumbersBackfilled(db);
        return read(db);
      },
      () => !rescanning,
    );
  };

  // T-11-101 벽 첫 화면 — 구단별 결번 수와 최근 결번만(결번 타일 전체를 받지 않는다).
  app.get('/v1/retired-numbers/summary', async (c) => {
    const season = seasonOf(c);
    const data = await cachedRead(c, EDGE.retiredNumbersSummary(season), (db) =>
      summarizeRetiredNumbers(db, season),
    );
    return ok(c, RetiredNumbersSummarySchema, data, 200, `public, max-age=${TTL}`);
  });

  // 한 시즌의 결번. T-11-101 ?club= 그 구단만, ?before= 최신순 한 페이지(0 = 처음). 둘 다 없으면 전체(옛 앱·내 선수).
  app.get('/v1/retired-numbers', async (c) => {
    const season = seasonOf(c);
    const clubId = parseWithAppError(RetiredClubQuerySchema, c.req.query('club'));
    const before = parseWithAppError(RetiredBeforeQuerySchema, c.req.query('before'));
    const [path, read]: [string, (db: Db) => Promise<RetiredNumbersResponse>] =
      clubId !== undefined
        ? [EDGE.retiredNumbersClub(season, clubId), (db) => listRetiredNumbers(db, season, clubId)]
        : before !== undefined
          ? [
              EDGE.retiredNumbersPage(season, before),
              (db) => pageRetiredNumbers(db, season, before),
            ]
          : [EDGE.retiredNumbers(season), (db) => listRetiredNumbers(db, season)];
    const data = await cachedRead(c, path, read);
    return ok(c, RetiredNumbersResponseSchema, data, 200, `public, max-age=${TTL}`);
  });
}
