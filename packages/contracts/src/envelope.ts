import { z } from 'zod';
import { ErrorCodeSchema } from './errors.js';

/** meta는 확장이 예정된 곳이라 passthrough. */
export const MetaSchema = z
  .object({
    requestId: z.string().min(1),
    careerRevision: z.number().int().nonnegative().optional(),
    rulesetVersion: z.string().optional(),
  })
  .passthrough();

export type Meta = z.infer<typeof MetaSchema>;

export const successEnvelope = <T extends z.ZodTypeAny>(data: T) => z.object({ data, meta: MetaSchema }).strict();

export const ErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: ErrorCodeSchema,
        message: z.string(),
        retryable: z.boolean(),
        details: z.unknown().optional(),
      })
      .strict(),
    meta: MetaSchema,
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export const envelope = <T extends z.ZodTypeAny>(data: T) => z.union([successEnvelope(data), ErrorEnvelopeSchema]);
