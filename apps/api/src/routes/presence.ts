import { successEnvelope, LivePresenceSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { countDistinctProfilesActiveSince, getSessionById, touchSessionLastSeen } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';

const PRESENCE_WINDOW_MINUTES = 5;
const PRESENCE_WINDOW_MS = PRESENCE_WINDOW_MINUTES * 60 * 1000;
/** profile.ts의 `LAST_SEEN_REFRESH_MS` 패턴을 따르는 하트비트 갱신 스로틀. */
const PRESENCE_TOUCH_MIN_MS = 30_000;

/**
 * D-78 API-PRES-001·002. 새 바인딩 없이 D1의 `sessions.last_seen_at`만 쓴다.
 * `GET /v1/presence`는 프로필 세션이 필요 없는 공개 GET, `POST /v1/presence/heartbeat`는
 * 세션이 없으면 조용히 204로 끝난다(새 프로필을 만들지 않는다).
 */
export function registerPresenceRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/presence', async (c) => {
    const db = getDb(c);
    const now = new Date();
    const nowIso = now.toISOString();
    const sinceIso = new Date(now.getTime() - PRESENCE_WINDOW_MS).toISOString();

    const playingNow = await countDistinctProfilesActiveSince(db, sinceIso, nowIso);

    c.header('Cache-Control', 'public, max-age=30');
    const body = successEnvelope(LivePresenceSchema).parse({
      data: { playingNow, windowMinutes: PRESENCE_WINDOW_MINUTES, sampledAt: nowIso },
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });

  app.post('/v1/presence/heartbeat', async (c) => {
    const session = c.get('session');
    if (!session) {
      return c.body(null, 204);
    }

    const db = getDb(c);
    const record = await getSessionById(db, session.id);
    const now = new Date();
    if (record && now.getTime() - Date.parse(record.lastSeenAt) >= PRESENCE_TOUCH_MIN_MS) {
      await touchSessionLastSeen(db, session.id, now.toISOString());
    }
    return c.body(null, 204);
  });
}
