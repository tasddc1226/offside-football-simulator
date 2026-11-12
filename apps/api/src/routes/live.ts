import { LiveResponseSchema } from '@offside/contracts';
import { LIVE_POLL_SEC } from '@offside/contracts/polling';
import type { Hono } from 'hono';
import { ok } from './shared.js';
import { liveFeed, liveStats } from '../db/repos/live.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { HUB } from '../live/hub.js';

// T-10-030 홈 라이브 현황. 로그인 없이 누구나 읽는다. 홈이 1분마다 다시 묻으므로 엣지에 1분 담아
// 데이터센터마다 D1을 1분에 한 번만 읽는다(T-10-045).
const TTL = LIVE_POLL_SEC;

export function registerLiveRoutes(app: Hono<AppEnv>): void {
  app.get(EDGE.live, async (c) => {
    const data = await edgeCached(c, EDGE.live, TTL, async () => {
      const db = getDb(c);
      const now = Date.now();
      const [daily, feed, presence] = await Promise.all([
        liveStats(db, now),
        liveFeed(db, now),
        c.env.LIVE?.get(c.env.LIVE.idFromName(HUB))
          .presence()
          .catch(() => null),
      ]);
      const online = presence?.online ?? null;
      // 구버전은 playing(숫자)만 읽는다. 새 화면은 online만 읽어 조회 불가를 0명으로 오해하지 않는다.
      return {
        now: new Date(now).toISOString(),
        stats: { ...daily, playing: online ?? 0, online },
        feed,
      };
    });
    return ok(c, LiveResponseSchema, data, 200, `public, max-age=${TTL}`);
  });
}
