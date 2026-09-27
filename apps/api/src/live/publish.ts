import type { LiveEvent, LivePush } from '@offside/contracts';
import type { Context } from 'hono';
import { liveEventOf } from '../db/repos/live.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { HUB } from './hub.js';

/**
 * T-10-072 방금 저장한 시즌·은퇴를 홈 라이브 허브로 밀어 준다. 응답을 먼저 보내고 뒤에서 돈다(실패는 삼킨다 —
 * 홈은 다음 폴링에서 어차피 본다). 피드에 오르지 않는 기록·다시 보낸 기록은 보내지 않는다(liveEventOf).
 */
export function publishLive(
  c: Context<AppEnv>,
  kind: LiveEvent['kind'],
  careerId: string,
  now: string,
): void {
  const hub = c.env.LIVE;
  if (!hub) return;
  waitUntil(
    c,
    (async () => {
      const event = await liveEventOf(getDb(c), kind, careerId, now);
      if (!event) return;
      const push: LivePush = { type: 'event', event };
      await hub.get(hub.idFromName(HUB)).publish(JSON.stringify(push));
    })(),
  );
}
