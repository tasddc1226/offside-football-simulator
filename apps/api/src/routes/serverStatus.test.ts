import { ServerStatusSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  FLUSH_MS,
  bucketOf,
  countable,
  flushTallies,
  recordRequest,
  resetMetricsForTest,
} from '../status/metrics.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { issueCookie } from '../test/http.js';

const T0 = Date.parse('2026-10-16T03:02:10.000Z');

describe('서버 상태 집계 (T-11-321)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    resetMetricsForTest();
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('5분 칸으로 묶고, 처음과 1분이 지난 뒤에만 넘겨준다', async () => {
    expect(bucketOf(T0)).toBe('2026-10-16T03:00:00.000Z');
    const first = recordRequest(T0, 120, 200); // isolate 첫 요청은 바로 넘긴다
    expect(first?.get('2026-10-16T03:00:00.000Z')).toEqual({
      requests: 1,
      totalMs: 120,
      slow: 0,
      errors: 0,
    });
    expect(recordRequest(T0 + 1000, 1500, 200)).toBeNull();
    expect(recordRequest(T0 + 2000, 300, 503)).toBeNull();
    const due = recordRequest(T0 + FLUSH_MS, 80, 200);
    expect(due?.get('2026-10-16T03:00:00.000Z')).toEqual({
      requests: 3,
      totalMs: 1880,
      slow: 1,
      errors: 1,
    });
    await flushTallies(ctx.env.DB, first!);
    await flushTallies(ctx.env.DB, due!);
    const row = await ctx.env.DB.prepare('SELECT * FROM api_status_buckets').first();
    expect(row).toMatchObject({ requests: 4, total_ms: 2000, slow: 1, errors: 1 });
  });

  it('사전 요청과 실시간 소켓은 세지 않는다', () => {
    expect(countable('GET', undefined)).toBe(true);
    expect(countable('OPTIONS', undefined)).toBe(false);
    expect(countable('GET', 'websocket')).toBe(false);
  });

  it('GET /v1/status: 24시간 칸과 KST 하루 묶음, 쿠키가 있어도 세션·프로필을 읽지 않는다', async () => {
    const now = Date.now();
    const recent = bucketOf(now - 10 * 60_000);
    const old = bucketOf(now - 3 * 86_400_000);
    await ctx.env.DB.batch(
      [
        [recent, 10, 2000, 1, 0],
        [old, 4, 400, 0, 2],
      ].map((r) =>
        ctx.env.DB.prepare(
          'INSERT INTO api_status_buckets (bucket, requests, total_ms, slow, errors) VALUES (?1, ?2, ?3, ?4, ?5)',
        ).bind(...r),
      ),
    );
    const { cookie } = await issueCookie(ctx);
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await createApp().request(
      '/v1/status',
      { headers: { Cookie: cookie } },
      { ...ctx.env, DB },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(seen.filter((q) => /sessions|profiles/.test(q))).toEqual([]);
    const data = successEnvelope(ServerStatusSchema).parse(await res.json()).data;
    expect(data.buckets).toEqual([{ at: recent, requests: 10, avgMs: 200, slow: 1, errors: 0 }]);
    expect(data.days.reduce((n, d) => n + d.requests, 0)).toBe(14);
    expect(data.days[0]).toMatchObject({ requests: 4, avgMs: 100, errors: 2 });
    expect(data.days[0]!.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('기록이 없으면 빈 목록이다', async () => {
    const res = await createApp().request('/v1/status', {}, ctx.env);
    const data = successEnvelope(ServerStatusSchema).parse(await res.json()).data;
    expect(data).toMatchObject({ buckets: [], days: [] });
  });
});
