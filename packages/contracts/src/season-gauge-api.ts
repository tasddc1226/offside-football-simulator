import { z } from 'zod';

/** 시즌 진행 게이지(season-gauge.ts SeasonGaugeView). 진행 중인 시즌이 없거나 아직 한 번도 세지 않았으면 null. */
export const SeasonGaugeSchema = z.strictObject({
  season: z.number().int(),
  startsAt: z.string(),
  progress: z.number().min(0).max(1),
  contributed: z.number().int().nonnegative(),
  participants: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  endsAt: z.string().nullable(),
  minEndsAt: z.string(),
  maxEndsAt: z.string(),
  updatedAt: z.string(),
});

/** 시즌 일정 한 줄(service-seasons.ts SeasonScheduleEntry). */
export const SeasonScheduleEntrySchema = z.strictObject({
  id: z.number().int().positive(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  retireAt: z.number().int().positive(),
});

/**
 * `GET /v1/season/gauge` — 로그인 없이 누구나 읽는다(홈). seasons는 서버가 아는 시즌 일정 전체 — 웹·앱이 받아
 * applySeasonSchedule로 입혀 게이지가 확정한 마감·다음 시즌을 앱 업데이트 없이 따른다.
 */
export const SeasonGaugeResponseSchema = z.strictObject({
  gauge: SeasonGaugeSchema.nullable(),
  seasons: z.array(SeasonScheduleEntrySchema),
});
export type SeasonGaugeResponse = z.infer<typeof SeasonGaugeResponseSchema>;
