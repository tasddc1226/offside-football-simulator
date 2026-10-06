import { TickerResponseSchema } from '@offside/contracts';
import { TICKER_POLL_SEC } from '@offside/contracts/polling';
import { displaySeasonAt } from '@offside/contracts/service-seasons';
import type { Hono } from 'hono';
import { ok } from './shared.js';
import { tickerFirsts, tickerTransfers } from '../db/repos/ticker.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { localizeTickerFirsts } from '../firstsText.js';
import { reqLang } from '../lang.js';

// T-10-122 홈 전광판. 로그인 없이 누구나 읽는다. 웹이 TICKER_POLL_SEC마다 묻으므로 엣지에 같은 시간 담아
// 데이터센터마다 D1을 그 간격에 한 번만 읽는다. 새 최초 기록도 TTL이 지나면 보인다(지우지 않는다).
export function registerTickerRoutes(app: Hono<AppEnv>): void {
  app.get(EDGE.ticker, async (c) => {
    // 캐시에는 한국어 원본을 담고 읽은 뒤에 요청 언어로 최초 기록 문구만 바꾼다(키가 언어마다 늘지 않는다).
    const cached = await edgeCached(c, EDGE.ticker, TICKER_POLL_SEC, async () => {
      const db = getDb(c);
      const now = Date.now();
      // T-11-029 최초 기록·신기록 줄은 지금 시즌 것만(개막 전이면 프리시즌).
      const season = displaySeasonAt(new Date(now).toISOString());
      const [transfers, firsts] = await Promise.all([
        tickerTransfers(db, now),
        tickerFirsts(db, season),
      ]);
      return { now: new Date(now).toISOString(), transfers, firsts };
    });
    const lang = reqLang(c);
    const data =
      lang === 'en'
        ? {
            ...cached,
            firsts: localizeTickerFirsts(cached.firsts, displaySeasonAt(cached.now), lang),
          }
        : cached;
    return ok(c, TickerResponseSchema, data, 200, `public, max-age=${TICKER_POLL_SEC}`);
  });
}
