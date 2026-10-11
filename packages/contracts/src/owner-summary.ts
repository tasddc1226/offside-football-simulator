import { z } from 'zod';
import { OwnerTierTagSchema } from './season-recap.js';

/** Only the fields needed to reconcile account totals with pending/device retirement records. */
export const OwnerSummaryResponseSchema = z.strictObject({
  linked: z.boolean(),
  admin: z.boolean(),
  tier: OwnerTierTagSchema.nullable(),
  tiers: z.array(OwnerTierTagSchema).default([]),
  entries: z.array(
    z.strictObject({
      id: z.string(),
      season: z.number().int().nullable(),
      legendScore: z.number(),
      retiredNumber: z.number().int().nullable(),
    }),
  ),
});
export type OwnerSummaryResponse = z.infer<typeof OwnerSummaryResponseSchema>;

/** Lightweight availability read for the global unread indicator. */
export const OwnerRecapStatusSchema = z.strictObject({ tier: OwnerTierTagSchema.nullable() });
export type OwnerRecapStatus = z.infer<typeof OwnerRecapStatusSchema>;
