import { SeasonGaugeResponseSchema } from '@offside/contracts';
import { seasonGaugeView } from '@offside/contracts/season-gauge';
import { activeSeason, seasonSchedule } from '@offside/contracts/service-seasons';
import type { Hono } from 'hono';
import { readSeasonGauge } from '../cron/seasonGauge.js';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import type { AppEnv } from '../env.js';
import { nowIso, ok } from './shared.js';

// 시즌 진행 게이지(홈). 로그인 없이 누구나 읽는다. 상태는 cron이 30분마다 굳히므로 엣지에 5분 담고, 진행률은
// 응답 시각으로 다시 계산한다(마감 확정 뒤에는 시간으로 차는 값이라 캐시와 상관없이 매끄럽다). 시즌 일정도 함께
// 내려 웹·앱이 확정된 마감·다음 시즌을 따르게 한다.
const TTL = 300;

export function registerSeasonGaugeRoutes(app: Hono<AppEnv>): void {
  app.get(EDGE.seasonGauge, async (c) => {
    const now = nowIso();
    const season = activeSeason(now);
    const state = season
      ? // 아직 한 번도 세지 않았으면(undefined) 담지 않는다 — 첫 cron 뒤 바로 보이게.
        await edgeCached(
          c,
          EDGE.seasonGauge,
          TTL,
          async () => (await readSeasonGauge(c.env.DB, season.id)) ?? undefined,
        )
      : undefined;
    const gauge =
      season && state && state.season === season.id
        ? seasonGaugeView(state, season.startsAt, now)
        : null;
    return ok(
      c,
      SeasonGaugeResponseSchema,
      { gauge, seasons: seasonSchedule() },
      200,
      `public, max-age=${TTL}`,
    );
  });
}
