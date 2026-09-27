import { RetiredNumbersResponseSchema, type RetiredNumberResult } from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { ok } from './shared.js';
import {
  ensureRetiredNumbersBackfilled,
  judgeRetiredNumber,
  listRetiredNumbers,
} from '../db/repos/retiredNumbers.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';

// T-10-076 영구결번. 로그인 없이 누구나 읽는다 — 이름은 명예의 전당에 이름 공개를 고른 경우에만 있다.
const TTL = 60;

/** 은퇴 PUT 뒤에 부른다. 심사가 실패해도 은퇴 응답은 성공시키고 로그로만 남긴다(이름 공개 토글·다음 은퇴 PUT이 다시 심사한다). */
export async function judgeRetirement(
  c: Context<AppEnv>,
  careerId: string,
  now: string,
): Promise<RetiredNumberResult | null> {
  try {
    const r = await judgeRetiredNumber(getDb(c), careerId, now);
    if (r?.kind === 'granted') purgeEdge(c, STALE.retiredNumbersChanged());
    return r;
  } catch (err) {
    c.set('storeFailure', {
      code: 'RETIRED_NUMBER_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function registerRetiredNumberRoutes(app: Hono<AppEnv>): void {
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
