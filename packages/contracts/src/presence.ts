import { z } from 'zod';
import { successEnvelope } from './envelope.js';
import { IsoUtcSchema } from './primitives.js';

/** API-PRES-001. D-78: 최근 5분 안에 활동한 프로필 수(중복 제거). */
export const LivePresenceSchema = z.strictObject({
  playingNow: z.number().int().nonnegative(),
  windowMinutes: z.number().int().positive(),
  sampledAt: IsoUtcSchema,
});

export type LivePresence = z.infer<typeof LivePresenceSchema>;

export const GetLivePresenceResponseSchema = successEnvelope(LivePresenceSchema);
export type GetLivePresenceResponse = z.infer<typeof GetLivePresenceResponseSchema>;
