import { z } from 'zod';
import { ErrorCodeSchema } from './errors.js';

/** meta는 확장이 예정된 곳이라 looseObject. */
export const MetaSchema = z.looseObject({
  requestId: z.string().min(1),
  careerRevision: z.number().int().nonnegative().optional(),
  rulesetVersion: z.string().optional(),
});

export type Meta = z.infer<typeof MetaSchema>;

export const successEnvelope = <T extends z.ZodTypeAny>(data: T) =>
  z.strictObject({ data, meta: MetaSchema });

export const ErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: ErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
    details: z.unknown().optional(),
  }),
  meta: MetaSchema,
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.union([successEnvelope(data), ErrorEnvelopeSchema]);
