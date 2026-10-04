import { z } from 'zod';

export const HealthDataSchema = z.strictObject({ ok: z.literal(true) });
