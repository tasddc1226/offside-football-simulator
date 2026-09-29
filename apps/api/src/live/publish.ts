import type { LiveEvent, LivePush, LiveRetiredNumber } from '@offside/contracts';
import type { Context } from 'hono';
import { liveEventOf } from '../db/repos/live.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { HUB } from './hub.js';

/** 응답을 먼저 보내고 뒤에서 허브로 민다(실패는 삼킨다 — 홈은 다음 폴링에서 어차피 본다). */
function push(c: Context<AppEnv>, build: () => Promise<LivePush | null>): void {
  const hub = c.env.LIVE;
  if (!hub) return;
  waitUntil(
    c,
    (async () => {
      const message = await build();
      if (message) await hub.get(hub.idFromName(HUB)).publish(JSON.stringify(message));
    })(),
  );
}

/**
 * T-10-072 방금 저장한 시즌·은퇴를 홈 라이브 허브로 밀어 준다. 피드에 오르지 않는 기록·다시 보낸 기록은 보내지
 * 않는다(liveEventOf).
 */
export function publishLive(
  c: Context<AppEnv>,
  kind: LiveEvent['kind'],
  careerId: string,
  now: string,
): void {
  push(c, async (): Promise<LivePush | null> => {
    const event = await liveEventOf(getDb(c), kind, careerId, now);
    return event ? { type: 'event', event } : null;
  });
}

/** T-10-076 방금 확정된 영구결번을 앱을 열어 둔 모든 브라우저에 알린다. */
export function publishRetiredNumber(c: Context<AppEnv>, item: LiveRetiredNumber): void {
  push(c, async () => ({ type: 'retiredNumber', item }) as const);
}
