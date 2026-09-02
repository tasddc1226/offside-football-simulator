import { z } from 'zod';
import { successEnvelope } from './envelope.js';

export const HealthDataSchema = z.object({ ok: z.literal(true) }).strict();
export type HealthData = z.infer<typeof HealthDataSchema>;

export const HealthResponseSchema = successEnvelope(HealthDataSchema);
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
