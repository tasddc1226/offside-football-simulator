import {
  CareerIdParamSchema,
  RetiredNumberCheckResponseSchema,
  RetiredNumbersResponseSchema,
  SeasonPickQuerySchema,
  type RetiredNumberResult,
} from '@offside/contracts';
import { displaySeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { careerOwnerMismatch, nowIso, ok } from './shared.js';
import { getCareerOwner } from '../db/repos/careers.js';
import {
  ensureRetiredNumbersBackfilled,
  judgeRetiredNumber,
  listRetiredNumbers,
} from '../db/repos/retiredNumbers.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { publishRetiredNumber } from '../live/publish.js';
import { parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

// T-10-076 영구결번. 로그인 없이 누구나 읽는다 — 이름은 명예의 전당에 이름 공개를 고른 경우에만 있다.
const TTL = 60;

/** 오픈까지 남은 초(열렸으면 0). 오픈 전엔 심사·소급·알림을 하지 않는다 — 그 사이 은퇴는 오픈 뒤 첫 목록 조회의 소급이 심사한다. */
function secondsUntilOpen(c: Context<AppEnv>, now: string): number {
  const openAt = c.env.RETIRED_NUMBERS_OPEN_AT;
  return openAt ? Math.max(0, Math.ceil((Date.parse(openAt) - Date.parse(now)) / 1000)) : 0;
}

/** 은퇴 PUT 뒤에 부른다. 심사가 실패해도 은퇴 응답은 성공시키고 로그로만 남긴다(이름 공개 토글·다음 은퇴 PUT이 다시 심사한다). */
export async function judgeRetirement(
  c: Context<AppEnv>,
  careerId: string,
  now: string,
): Promise<RetiredNumberResult | null> {
  // 오픈 전엔 null(자격 없음)이 아니라 pending — 기기가 결과를 저장해 두고 오픈 뒤 다시 묻는다.
  if (secondsUntilOpen(c, now) > 0) return { kind: 'pending' };
  try {
    const { result, season, claimed } = await judgeRetiredNumber(getDb(c), careerId, now);
    // 이미 가진 자리여도 이름 공개 토글이 목록의 이름을 바꾼다. 그 시즌의 목록만 낡는다(T-11-029).
    if (result?.kind === 'granted' && season !== undefined) {
      purgeEdge(c, STALE.retiredNumbersChanged(season));
    }
    if (claimed) publishRetiredNumber(c, claimed);
    return result;
  } catch (err) {
    c.set('storeFailure', {
      code: 'RETIRED_NUMBER_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function registerRetiredNumberRoutes(app: Hono<AppEnv>): void {
  // 내 선수의 심사 결과. 은퇴 PUT 응답을 받지 못한 기록(배포 전 은퇴를 소급으로 심사한 결번, 이미 찬 자리)을 이 기기가
  // 은퇴 상세를 열 때 한 번 묻는다. 은퇴 PUT과 같은 심사라 이름을 공개했고 자리가 비어 있으면 이때 자리를 잡는다.
  app.get('/v1/careers/:careerId/retired-number', requireProfile, async (c) => {
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const owner = await getCareerOwner(getDb(c), careerId);
    if (owner !== getSessionOrThrow(c).profileId) throw careerOwnerMismatch();
    const retiredNumber = await judgeRetirement(c, careerId, nowIso());
    return ok(c, RetiredNumberCheckResponseSchema, { retiredNumber }, 200, 'private, no-store');
  });

  app.get('/v1/retired-numbers', async (c) => {
    // T-11-029 시즌별 목록 — ?season= 없으면 지금 시즌(개막 전이면 프리시즌, 휴식기면 마지막 시즌). 캐시 키는 시즌을 푼 경로다.
    const now = nowIso();
    const season =
      parseWithAppError(SeasonPickQuerySchema, c.req.query('season')) ?? displaySeasonAt(now);
    // 오픈 전엔 빈 목록. 캐시가 오픈 시각을 넘기지 않게 남은 시간만큼만 둔다.
    const wait = secondsUntilOpen(c, now);
    if (wait > 0) {
      return ok(
        c,
        RetiredNumbersResponseSchema,
        { season, items: [] },
        200,
        `public, max-age=${Math.min(TTL, wait)}`,
      );
    }
    // 기존 은퇴를 훑는 중이면 캐시하지 않는다(서버 최초 기록과 같다 — 조회마다 한 조각씩 나아간다).
    let rescanning = false;
    const data = await edgeCached(
      c,
      EDGE.retiredNumbers(season),
      TTL,
      async () => {
        const db = getDb(c);
        rescanning = await ensureRetiredNumbersBackfilled(db);
        return listRetiredNumbers(db, season);
      },
      () => !rescanning,
    );
    return ok(c, RetiredNumbersResponseSchema, data, 200, `public, max-age=${TTL}`);
  });
}
