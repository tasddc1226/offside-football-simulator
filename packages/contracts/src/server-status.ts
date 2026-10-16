import { z } from 'zod';

/** T-11-321 서버 상태 화면(GET /v1/status). 워커가 5분 칸마다 모은 실측값이다(apps/api/src/status/metrics.ts). */
export const ServerStatusBucketSchema = z.strictObject({
  /** 칸 시작(UTC ISO). */
  at: z.string(),
  requests: z.number().int().nonnegative(),
  /** 평균 응답 시간(ms). */
  avgMs: z.number().int().nonnegative(),
  /** 1초 이상 걸린 요청 수. */
  slow: z.number().int().nonnegative(),
  /** 5xx로 끝난 요청 수. */
  errors: z.number().int().nonnegative(),
});
export type ServerStatusBucket = z.infer<typeof ServerStatusBucketSchema>;

export const ServerStatusDaySchema = ServerStatusBucketSchema.omit({ at: true }).extend({
  /** KST 날짜(YYYY-MM-DD). */
  day: z.string(),
});
export type ServerStatusDay = z.infer<typeof ServerStatusDaySchema>;

export const ServerStatusSchema = z.strictObject({
  generatedAt: z.string(),
  /** 최근 24시간, 5분 칸, 오래된 순. 요청이 없던 칸은 빠진다. */
  buckets: z.array(ServerStatusBucketSchema),
  /** 최근 30일, KST 하루 단위, 오래된 순. */
  days: z.array(ServerStatusDaySchema),
});
export type ServerStatus = z.infer<typeof ServerStatusSchema>;
