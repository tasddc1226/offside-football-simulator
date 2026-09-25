import { LiveResponseSchema, successEnvelope } from '@offside/contracts';
import type { Hono } from 'hono';
import { liveFeed, liveStats } from '../db/repos/live.js';
import { edgeCached } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';

// T-10-030 홈 라이브 현황. 로그인 없이 누구나 읽는다. 홈이 30초마다 다시 묻으므로 엣지에 30초 담아
// 데이터센터마다 D1을 30초에 한 번만 읽는다.
export const LIVE_PATH = '/v1/live';
const TTL = 30;

export function registerLiveRoutes(app: Hono<AppEnv>): void {
  app.get(LIVE_PATH, async (c) => {
    const data = await edgeCached(c, LIVE_PATH, TTL, async () => {
      const db = getDb(c);
      const now = Date.now();
      const [stats, feed] = await Promise.all([liveStats(db, now), liveFeed(db, now)]);
      return { now: new Date(now).toISOString(), stats, feed };
    });
    const body = successEnvelope(LiveResponseSchema).parse({ data, meta: { requestId: c.get('requestId') } });
    c.header('Cache-Control', `public, max-age=${TTL}`);
    return c.json(body, 200);
  });
}
