import { z } from 'zod';
import { IsoUtcSchema } from './primitives.js';

/** 02 `ProfileSettings`. */
export const ProfileSettingsSchema = z
  .object({
    reducedMotion: z.enum(['SYSTEM', 'ON', 'OFF']),
    textScale: z.union([z.literal(100), z.literal(125), z.literal(150)]),
    theme: z.enum(['SYSTEM', 'LIGHT', 'DARK']),
    defaultSimulationMode: z.enum(['FAST', 'CHAPTER']),
  })
  .strict();

export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;

/** API-PRO-001. 클라이언트에 노출되는 필드만(02 `LocalProfile` 전체가 아니다). */
export const ProfileSchema = z
  .object({
    id: z.string().min(1),
    settings: ProfileSettingsSchema,
    linked: z.object({ google: z.boolean(), toss: z.boolean() }).strict(),
    recoveryCodeIssuedAt: IsoUtcSchema.nullable(),
    createdAt: IsoUtcSchema,
  })
  .strict();

export type Profile = z.infer<typeof ProfileSchema>;

/** API-PRO-002. */
export const PatchProfileSettingsBodySchema = ProfileSettingsSchema.partial();
export type PatchProfileSettingsBody = z.infer<typeof PatchProfileSettingsBodySchema>;

/** API-AUTH-005. */
export const TossSessionBodySchema = z.object({ anonKey: z.string().min(1) }).strict();
export type TossSessionBody = z.infer<typeof TossSessionBodySchema>;

export const TossSessionResponseSchema = z
  .object({ sessionToken: z.string().min(1), expiresAt: IsoUtcSchema })
  .strict();
export type TossSessionResponse = z.infer<typeof TossSessionResponseSchema>;
