import type { Hono } from 'hono';
import { RETIRE_COHORT_PATH, RetireCohortResponseSchema } from '@offside/contracts/retire-cohort';
import { readRetireCohort } from '../db/repos/retireCohort.js';
import { edgeCached } from '../edgeCache.js';
import { ok } from './shared.js';
import type { AppEnv } from '../env.js';

/** 하루 한 번 바뀌는 값이라 엣지에 한 시간 둔다. */
const TTL_SEC = 3600;

// T-11-675 은퇴 동기 비교 분포. 모두에게 같은 공개 조회라 세션을 보지 않고 app_meta 한 행만 읽는다.
export function registerRetireCohortRoutes(app: Hono<AppEnv>): void {
  app.get(RETIRE_COHORT_PATH, async (c) => {
    // 아직 계산 전이면 null도 담는다(다음 cron 뒤 TTL 안에 바뀐다).
    const cohort = await edgeCached(
      c,
      RETIRE_COHORT_PATH,
      TTL_SEC,
      async () => (await readRetireCohort(c.env.DB)) ?? null,
    );
    return ok(c, RetireCohortResponseSchema, cohort, 200, `public, max-age=${TTL_SEC}`);
  });
}
