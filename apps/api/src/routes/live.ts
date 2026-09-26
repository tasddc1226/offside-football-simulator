import { LiveResponseSchema } from '@offside/contracts';
import { LIVE_POLL_SEC } from '@offside/contracts/polling';
import type { Hono } from 'hono';
import { ok } from './shared.js';
import { liveFeed, liveStats } from '../db/repos/live.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';

// T-10-030 홈 라이브 현황. 로그인 없이 누구나 읽는다. 홈이 1분마다 다시 묻으므로 엣지에 1분 담아
// 데이터센터마다 D1을 1분에 한 번만 읽는다(T-10-045).
const TTL = LIVE_POLL_SEC;

export function registerLiveRoutes(app: Hono<AppEnv>): void {
  app.get(EDGE.live, async (c) => {
    const data = await edgeCached(c, EDGE.live, TTL, async () => {
      const db = getDb(c);
      const now = Date.now();
      const [stats, feed] = await Promise.all([liveStats(db, now), liveFeed(db, now)]);
      return { now: new Date(now).toISOString(), stats, feed };
    });
    return ok(c, LiveResponseSchema, data, 200, `public, max-age=${TTL}`);
  });
}
