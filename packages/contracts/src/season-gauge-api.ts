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

/** `GET /v1/season/gauge` — 로그인 없이 누구나 읽는다(홈). */
export const SeasonGaugeResponseSchema = z.strictObject({
  gauge: SeasonGaugeSchema.nullable(),
});
export type SeasonGaugeResponse = z.infer<typeof SeasonGaugeResponseSchema>;
