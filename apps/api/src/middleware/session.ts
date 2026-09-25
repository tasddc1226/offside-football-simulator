import type { Context } from 'hono';
import { readSessionToken } from '../auth/session.js';
import { sha256Hex } from '../db/hash.js';
import { findLiveSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv, type SessionContext } from '../env.js';

/**
 * 결정 1·3. 세션이 없거나 무효해도 여기서는 401을 내지 않는다(라우트가 결정).
 * T-1-004 브리프 항목 8: `deleted_at`이 있는 프로필의 세션은 무효로 취급한다.
 * T-10-015: 모든 요청에서 미리 읽지 않고 처음 필요할 때 한 번만(요청당 메모) 읽는다 — 명예의 전당·게시판
 * 목록 같은 공개 조회는 쿠키가 실려 와도 세션·프로필을 D1에서 읽지 않는다. 찾으면 `c.get('session')`에도 둔다.
 */
export function resolveSession(c: Context<AppEnv>): Promise<SessionContext | undefined> {
  let lookup = c.get('sessionLookup');
  if (!lookup) {
    lookup = lookupSession(c);
    c.set('sessionLookup', lookup);
  }
  return lookup;
}

async function lookupSession(c: Context<AppEnv>): Promise<SessionContext | undefined> {
  const token = readSessionToken(c);
  if (!token) return undefined;
  const record = await findLiveSession(getDb(c), await sha256Hex(token), new Date().toISOString());
  if (!record) return undefined;
  const session = { id: record.id, profileId: record.profileId, channel: record.channel };
  c.set('session', session);
  return session;
}
