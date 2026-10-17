// T-11-321 서버 상태 화면의 실측값. 요청마다 D1에 쓰지 않으려고 isolate 메모리에 5분 칸별로 모았다가 FLUSH_MS에 한 번
// `api_status_buckets`에 더한다(isolate가 수십 개여도 분당 수십 번). isolate가 내려가면 아직 안 더한 몫은 사라지므로
// 요청 수는 Cloudflare 집계보다 조금 적게 나오는 근삿값이다. 응답 시간·느린 비율·오류 비율은 그대로 믿을 만하다.

export const BUCKET_MS = 5 * 60_000;
export const FLUSH_MS = 60_000;
/** 이보다 오래 걸린 요청을 '느린 요청'으로 센다. */
export const SLOW_MS = 1000;

type Tally = { requests: number; totalMs: number; slow: number; errors: number };

let pending = new Map<string, Tally>();
let lastFlushAt = 0;

export function bucketOf(at: number): string {
  return new Date(Math.floor(at / BUCKET_MS) * BUCKET_MS).toISOString();
}

/** 상태 화면에 넣을 요청인지. 사전 요청(OPTIONS)·실시간 소켓(연결 수명이 곧 시간)은 뺀다. */
export function countable(method: string, upgrade: string | undefined): boolean {
  return method !== 'OPTIONS' && upgrade?.toLowerCase() !== 'websocket';
}

/** 요청 하나를 센다. 더할 때가 됐으면 모은 칸을 넘겨준다(호출한 쪽이 waitUntil로 쓴다). */
export function recordRequest(
  at: number,
  durationMs: number,
  status: number,
): Map<string, Tally> | null {
  const key = bucketOf(at);
  let t = pending.get(key);
  if (!t) pending.set(key, (t = { requests: 0, totalMs: 0, slow: 0, errors: 0 }));
  t.requests += 1;
  t.totalMs += Math.max(0, Math.round(durationMs));
  if (durationMs >= SLOW_MS) t.slow += 1;
  if (status >= 500) t.errors += 1;
  if (at - lastFlushAt < FLUSH_MS) return null;
  lastFlushAt = at;
  const out = pending;
  pending = new Map();
  return out;
}

export async function flushTallies(db: D1Database, tallies: Map<string, Tally>): Promise<void> {
  if (!tallies.size) return;
  const stmt = db.prepare(
    `INSERT INTO api_status_buckets (bucket, requests, total_ms, slow, errors) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(bucket) DO UPDATE SET requests = requests + excluded.requests,
       total_ms = total_ms + excluded.total_ms, slow = slow + excluded.slow, errors = errors + excluded.errors`,
  );
  await db.batch(
    [...tallies].map(([bucket, t]) => stmt.bind(bucket, t.requests, t.totalMs, t.slow, t.errors)),
  );
}

/** 테스트 전용. */
export function resetMetricsForTest(): void {
  pending = new Map();
  lastFlushAt = 0;
}
