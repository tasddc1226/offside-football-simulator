import {
  CareerIdParamSchema,
  RetiredNumberCheckResponseSchema,
  RetiredNumbersResponseSchema,
  type RetiredNumberResult,
} from '@offside/contracts';
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

/** 은퇴 PUT 뒤에 부른다. 심사가 실패해도 은퇴 응답은 성공시키고 로그로만 남긴다(이름 공개 토글·다음 은퇴 PUT이 다시 심사한다). */
export async function judgeRetirement(
  c: Context<AppEnv>,
  careerId: string,
  now: string,
): Promise<RetiredNumberResult | null> {
  try {
    const { result, claimed } = await judgeRetiredNumber(getDb(c), careerId, now);
    // 이미 가진 자리여도 이름 공개 토글이 목록의 이름을 바꾼다.
    if (result?.kind === 'granted') purgeEdge(c, STALE.retiredNumbersChanged());
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

  app.get(EDGE.retiredNumbers, async (c) => {
    // 기존 은퇴를 훑는 중이면 캐시하지 않는다(서버 최초 기록과 같다 — 조회마다 한 조각씩 나아간다).
    let rescanning = false;
    const data = await edgeCached(
      c,
      EDGE.retiredNumbers,
      TTL,
      async () => {
        const db = getDb(c);
        rescanning = await ensureRetiredNumbersBackfilled(db);
        return listRetiredNumbers(db);
      },
      () => !rescanning,
    );
    return ok(c, RetiredNumbersResponseSchema, data, 200, `public, max-age=${TTL}`);
  });
}
