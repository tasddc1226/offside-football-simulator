// T-11-572 운영 지표 대시보드(admin.offside-lab.com) 응답 · 외부 지표 적재 모양. 설계: docs/tracking/admin-kpi-dashboard-design.md
import { z } from 'zod';
import { IsoUtcSchema } from './primitives.js';

import { KPI_DAYS, KPI_SOURCES } from './kpi-rules.js';

export * from './kpi-rules.js';

const KST_DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const NAME = z.string().regex(/^[a-z0-9_:.-]{1,64}$/);

export const KpiRowSchema = z.object({ metric: NAME, dim: NAME, value: z.number().finite() });
export type KpiRow = z.infer<typeof KpiRowSchema>;

export const KpiReportSchema = z.object({
  generatedAt: IsoUtcSchema,
  /** 어제까지 KST 날짜(오래된 날부터). */
  days: z.array(KST_DAY),
  rows: z.array(KpiRowSchema.extend({ day: KST_DAY })),
  /** 원천마다 마지막으로 들어온 날과 시각. 원천이 아직 없으면 빠진다. */
  sources: z.array(
    z.object({ source: z.enum(KPI_SOURCES), lastDay: KST_DAY, updatedAt: IsoUtcSchema }),
  ),
});
export type KpiReport = z.infer<typeof KpiReportSchema>;

export const KpiQuerySchema = z.coerce
  .number()
  .int()
  .refine((d) => (KPI_DAYS as readonly number[]).includes(d))
  .default(30);

/** POST /v1/internal/kpi — 에이전트 Worker가 외부 지표 하루치를 넣는다. */
export const KpiIngestSchema = z.object({
  day: KST_DAY,
  source: z.enum(KPI_SOURCES).exclude(['d1']),
  rows: z.array(KpiRowSchema).max(500),
});
export type KpiIngest = z.infer<typeof KpiIngestSchema>;
