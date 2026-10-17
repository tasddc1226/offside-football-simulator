import { ServerStatusSchema, type ServerStatus } from '@offside/contracts';
import type { Hono } from 'hono';
import { edgeCached } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import type { AppEnv } from '../env.js';
import { DAY_MS } from '../time.js';
import { ok } from './shared.js';

// T-11-321 서버 상태 화면. 로그인 없이 누구나 같은 응답이라 엣지에 1분 담는다(칸이 5분이고 집계도 1분에 한 번 더해진다).
// 세션·프로필은 읽지 않는다. 표는 5분 칸 35일치(최대 약 1만 행)라 하루 묶음도 그대로 계산한다.
const TTL = 60;
const DAYS = 30;

type Row = { requests: number; total_ms: number; slow: number; errors: number };
const avg = (r: Row) => (r.requests ? Math.round(r.total_ms / r.requests) : 0);

export async function loadServerStatus(db: D1Database, now: number): Promise<ServerStatus> {
  const since24h = new Date(now - DAY_MS).toISOString();
  const sinceDays = new Date(now - DAYS * DAY_MS).toISOString();
  const [buckets, days] = await db.batch<Row & { bucket?: string; day?: string }>([
    db
      .prepare(
        'SELECT bucket, requests, total_ms, slow, errors FROM api_status_buckets WHERE bucket >= ?1 ORDER BY bucket',
      )
      .bind(since24h),
    db
      .prepare(
        `SELECT substr(datetime(bucket, '+9 hours'), 1, 10) AS day, SUM(requests) AS requests,
           SUM(total_ms) AS total_ms, SUM(slow) AS slow, SUM(errors) AS errors
         FROM api_status_buckets WHERE bucket >= ?1 GROUP BY day ORDER BY day`,
      )
      .bind(sinceDays),
  ]);
  return {
    generatedAt: new Date(now).toISOString(),
    buckets: (buckets?.results ?? []).map((r) => ({
      at: r.bucket!,
      requests: r.requests,
      avgMs: avg(r),
      slow: r.slow,
      errors: r.errors,
    })),
    days: (days?.results ?? []).map((r) => ({
      day: r.day!,
      requests: r.requests,
      avgMs: avg(r),
      slow: r.slow,
      errors: r.errors,
    })),
  };
}

export function registerServerStatusRoutes(app: Hono<AppEnv>): void {
  app.get(EDGE.serverStatus, async (c) => {
    const data = await edgeCached(c, EDGE.serverStatus, TTL, () =>
      loadServerStatus(c.env.DB, Date.now()),
    );
    return ok(c, ServerStatusSchema, data, 200, `public, max-age=${TTL}`);
  });
}
