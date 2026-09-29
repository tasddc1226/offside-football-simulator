import { TickerResponseSchema } from '@offside/contracts';
import { TICKER_POLL_SEC } from '@offside/contracts/polling';
import type { Hono } from 'hono';
import { ok } from './shared.js';
import { tickerFirsts, tickerTransfers } from '../db/repos/ticker.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';

// T-10-122 홈 전광판. 로그인 없이 누구나 읽는다. 웹이 TICKER_POLL_SEC마다 묻으므로 엣지에 같은 시간 담아
// 데이터센터마다 D1을 그 간격에 한 번만 읽는다. 새 최초 기록도 TTL이 지나면 보인다(지우지 않는다).
export function registerTickerRoutes(app: Hono<AppEnv>): void {
  app.get(EDGE.ticker, async (c) => {
    const data = await edgeCached(c, EDGE.ticker, TICKER_POLL_SEC, async () => {
      const db = getDb(c);
      const now = Date.now();
      const [transfers, firsts] = await Promise.all([tickerTransfers(db, now), tickerFirsts(db)]);
      return { now: new Date(now).toISOString(), transfers, firsts };
    });
    return ok(c, TickerResponseSchema, data, 200, `public, max-age=${TICKER_POLL_SEC}`);
  });
}
