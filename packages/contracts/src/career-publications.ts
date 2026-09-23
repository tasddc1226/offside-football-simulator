import { z } from 'zod';
import { PlayerDraftSchema, PositionSchema } from './player.js';
import { SimulationModeSchema } from './career-state.js';
import { SemverSchema } from './versions.js';

/** Deliberate public whitelist. Never extend with snapshot, archive or account fields. */
export const CareerArticleSchema = z.strictObject({
  id: z.string().uuid(),
  playerName: z.string().min(1).max(100),
  initialPosition: PositionSchema,
  seasons: z.number().int().nonnegative(),
  playedMatches: z.number().int().nonnegative(),
  minutes: z.number().int().nonnegative(),
  averageRatingTenths: z.number().int().nullable(),
  clubCount: z.number().int().nonnegative(),
  highlights: z
    .array(
      z.strictObject({
        kind: z.enum(['GOALS', 'ASSISTS', 'SAVES', 'CLEAN_SHEETS', 'KEY_PASSES', 'TACKLES']),
        total: z.number().int().nonnegative(),
      }),
    )
    .max(6),
  publishedAt: z.string(),
  challenge: z.strictObject({
    seed: z.string().min(1).max(256),
    rulesetVersion: SemverSchema,
    contentPackVersion: SemverSchema,
    simulationMode: SimulationModeSchema,
    draft: PlayerDraftSchema.omit({ name: true }),
  }),
});
export type CareerArticle = z.infer<typeof CareerArticleSchema>;
export const PublishCareerSchema = z.strictObject({ consent: z.literal(true) });
export const StartCareerChallengeSchema = z.strictObject({
  expectedProfileId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(20),
});
export const CareerPublicationStatusSchema = z.strictObject({
  article: CareerArticleSchema.nullable(),
});
