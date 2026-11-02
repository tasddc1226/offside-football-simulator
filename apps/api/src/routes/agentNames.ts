import type { Hono } from 'hono';
import { listChangedNames } from '../db/repos/nameWatch.js';
import { getDb, type AppEnv } from '../env.js';
import { NO_STORE, sameSecret } from './shared.js';

/** 막 쓴 행이 아직 커밋되기 전의 틈을 피한다(요청은 시각을 먼저 잡고 나중에 쓴다). */
const SETTLE_MS = 30_000;
/** 처음 · 오래 멈췄다 돌 때 되짚는 범위. */
const DEFAULT_LOOKBACK_MS = 24 * 3600_000;
const MAX_LOOKBACK_MS = 3 * 24 * 3600_000;
const MAX_LIMIT = 200;

/**
 * T-11-616 에이전트 Worker(새 이름 점검)가 마지막 점검 뒤에 생기거나 바뀐 닉네임 · 구단명 · 감독명을 읽는 내부 주소.
 * 세션을 건드리지 않고 비밀 토큰만 본다(토큰이 없거나 틀리면 주소가 없는 것처럼 404). 운영자가 직접 보는 디스코드로만 나가며
 * 가리거나 바꾸지 않는다. 한 번에 limit(최대 200)개 프로필 · 구단 행까지, 인덱스 범위 조회만 한다.
 */
export function registerAgentNameRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/internal/agents/names', async (c) => {
    const secret = c.env.AGENTS_READ_TOKEN;
    if (!secret || !sameSecret(c.req.header('authorization') ?? '', `Bearer ${secret}`))
      return c.body(null, 404);
    const now = Date.now();
    const asked = Date.parse(c.req.query('since') ?? '');
    const since = new Date(
      Math.max(Number.isFinite(asked) ? asked : now - DEFAULT_LOOKBACK_MS, now - MAX_LOOKBACK_MS),
    ).toISOString();
    const until = new Date(now - SETTLE_MS).toISOString();
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(c.req.query('limit'))) || 100));
    const headers = { 'Cache-Control': NO_STORE };
    if (since >= until) return c.json({ items: [], next: since, truncated: false }, 200, headers);
    return c.json(await listChangedNames(getDb(c), since, until, limit), 200, headers);
  });
}
