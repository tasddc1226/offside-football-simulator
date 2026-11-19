import { EnhanceStatsResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { issueCookie } from '../test/http.js';
import { ENHANCE_STATS_MIN, loadEnhanceStats } from './cardEnhance.js';

const NOW = Date.parse('2026-11-19T03:00:00.000Z');

describe('강화 실제 결과 (T-11-758)', () => {
  let ctx: TestD1;
  let seq = 0;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  /** 같은 표시 확률로 n번 시도, 그중 ok번 성공. */
  async function seed(rateBp: number, n: number, ok: number, at = '2026-11-18T00:00:00.000Z') {
    const stmt = ctx.env.DB.prepare(
      `INSERT INTO card_enhance_log (id, profile_id, career_id, request_key, from_level, to_level, fails, success, rate_bp, down_bp, roll, cost, created_at)
       VALUES (?1, 'p1', 'c1', ?1, 0, ?2, 0, ?2, ?3, 0, 0, 100000, ?4)`,
    );
    const rows = Array.from({ length: n }, (_, i) =>
      stmt.bind(`e${seq++}`, i < ok ? 1 : 0, rateBp, at),
    );
    for (let i = 0; i < rows.length; i += 50) await ctx.env.DB.batch(rows.slice(i, i + 50));
  }

  it('표시 확률별로 시도 · 성공 수를 묶고, 적게 모인 확률은 표에서만 뺀다', async () => {
    await seed(9000, 10, 9, '2026-11-10T00:00:00.000Z');
    await seed(6000, 4, 1);
    await seed(3000, 2, 2);
    const data = await loadEnhanceStats(ctx.env.DB, NOW, 100, 4);
    expect(data.rows).toEqual([
      { rateBp: 9000, attempts: 10, success: 9 },
      { rateBp: 6000, attempts: 4, success: 1 },
    ]);
    expect(data.attempts).toBe(16);
    expect(data.since).toBe('2026-11-10T00:00:00.000Z');
    expect(data.generatedAt).toBe(new Date(NOW).toISOString());
  });

  it('가장 최근 시도만 읽는다', async () => {
    await seed(9000, 10, 10);
    await seed(6000, 5, 0);
    const data = await loadEnhanceStats(ctx.env.DB, NOW, 5, 1);
    expect(data.rows).toEqual([{ rateBp: 6000, attempts: 5, success: 0 }]);
    expect(data.attempts).toBe(5);
  });

  it('GET /v1/card-enhance/stats: 쿠키가 있어도 세션 · 프로필을 읽지 않고, 기록이 없으면 빈 표다', async () => {
    const { cookie } = await issueCookie(ctx);
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await createApp().request(
      '/v1/card-enhance/stats',
      { headers: { Cookie: cookie } },
      { ...ctx.env, DB },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(seen.filter((q) => /sessions|profiles/.test(q))).toEqual([]);
    const data = successEnvelope(EnhanceStatsResponseSchema).parse(await res.json()).data;
    expect(data).toMatchObject({ attempts: 0, since: null, rows: [] });
    expect(ENHANCE_STATS_MIN).toBeGreaterThan(0);
  });
});
