import { z } from 'zod';
import { CupMatchSchema } from './cup-api.js';

const count = z.number().int().nonnegative();
export const AdminCupPredictionMatchSchema = z.object({
  match: CupMatchSchema,
  homeName: z.string(),
  awayName: z.string(),
  home: count,
  draw: count,
  away: count,
  total: count,
  hits: count,
  granted: count,
  pending: count,
  unpaid: count,
});
export const AdminCupPredictionsSchema = z.object({
  cupId: z.string(),
  participants: count,
  items: z.array(AdminCupPredictionMatchSchema),
});
export const AdminCupPredictionRowsSchema = z.object({
  items: z.array(
    z.object({
      profileId: z.string(),
      nickname: z.string(),
      pick: z.enum(['home', 'draw', 'away']),
      correct: z.boolean().nullable(),
      settledAt: z.string().nullable(),
      rewardedAt: z.string().nullable(),
      updatedAt: z.string(),
    }),
  ),
  next: z.string().nullable(),
});
export const AdminCupPredictionRecoverySchema = z.strictObject({
  reason: z.string().trim().min(5).max(200),
});
export type AdminCupPredictions = z.infer<typeof AdminCupPredictionsSchema>;
export type AdminCupPredictionMatch = z.infer<typeof AdminCupPredictionMatchSchema>;
export type AdminCupPredictionRows = z.infer<typeof AdminCupPredictionRowsSchema>;

export const AdminCupPredictionRecoveryResultSchema = z.object({ settled: count, rewarded: count });
