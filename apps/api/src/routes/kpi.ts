import { KpiIngestSchema, KpiQuerySchema, KpiReportSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import { externalMetricAllowed, kpiReport, writeKpiDay } from '../db/repos/kpi.js';
import type { AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { NO_STORE, nowIso, ok, readBody, sameSecret } from './shared.js';

// T-11-572 운영 지표 대시보드(admin.offside-lab.com). 읽기는 운영자만, kpi_daily 한 표만 읽는다(엣지 캐시 안 함).
// 외부 지표(GA4 · 광고 · 스토어)는 에이전트 Worker가 비밀 토큰으로 넣는다. 토큰이 없거나 틀리면 주소가 없는 것처럼 404.

export function registerKpiRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/admin/kpi', async (c) => {
    await requireAdmin(c);
    const days = parseWithAppError(KpiQuerySchema, c.req.query('days'));
    const data = await kpiReport(c.env.DB, new Date(), days);
    return ok(c, KpiReportSchema, data, 200, NO_STORE);
  });

  app.post('/v1/internal/kpi', async (c) => {
    const secret = c.env.KPI_INGEST_TOKEN;
    if (!secret || !sameSecret(c.req.header('authorization') ?? '', `Bearer ${secret}`))
      return c.body(null, 404);
    const input = readBody(c, KpiIngestSchema);
    const bad = input.rows.find((r) => !externalMetricAllowed(input.source, r.metric));
    if (bad)
      throw new AppError({
        code: 'VALIDATION_FAILED',
        // i18n-ignore: 에이전트 Worker만 받는 내부 응답
        message: `${input.source}에서 받을 수 없는 지표예요: ${bad.metric}`,
      });
    await writeKpiDay(c.env.DB, input.day, input.source, input.rows, nowIso());
    return c.json({ ok: true, rows: input.rows.length }, 200, { 'Cache-Control': NO_STORE });
  });
}
