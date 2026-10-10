import { z } from 'zod';

export const PushInteractionSchema = z
  .object({ event: z.enum(['click', 'target_open']), occurredAt: z.iso.datetime().optional() })
  .strict();
export const PushPerformanceQuerySchema = z
  .object({
    days: z.enum(['7', '30', '90']).default('7'),
    tests: z.enum(['1']).optional(),
    page: z.coerce.number().int().min(0).max(500).default(0),
    through: z.iso.datetime().optional(),
  })
  .strict();
export const PushCategorySchema = z.enum([
  'notice',
  'release',
  'team',
  'market',
  'social',
  'community',
  'friend-request',
  'friend-accepted',
  'friendly',
  'return',
  'test',
]);
const count = z.number().int().nonnegative();
export const PushMetricsSchema = z.object({
  queued: count,
  pending: count,
  accepted: count,
  confirmed: count,
  failed: count,
  unknown: count,
  cancelled: count,
  recipients: count,
  acceptedRecipients: count,
  clicked: count,
  targetOpened: count,
});
export const PushPerformanceSchema = z.object({
  generatedAt: z.iso.datetime(),
  trackingStartedAt: z.iso.datetime(),
  from: z.iso.datetime(),
  cohortThrough: z.iso.datetime(),
  totals: PushMetricsSchema,
  categories: z.array(PushMetricsSchema.extend({ category: PushCategorySchema })),
  daily: z.array(PushMetricsSchema.extend({ day: z.string() })).max(90),
  campaigns: z
    .array(
      PushMetricsSchema.extend({
        id: z.string(),
        category: PushCategorySchema,
        title: z.string(),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(20),
  hasMore: z.boolean(),
});
export type PushMetrics = z.infer<typeof PushMetricsSchema>;
export type PushCategory = z.infer<typeof PushCategorySchema>;
export type PushPerformance = z.infer<typeof PushPerformanceSchema>;
export type PushPerformanceQuery = z.infer<typeof PushPerformanceQuerySchema>;
