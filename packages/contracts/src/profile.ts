import { z } from 'zod';
import { IsoUtcSchema } from './primitives.js';

/** 02 `ProfileSettings`. */
export const ProfileSettingsSchema = z.strictObject({
  reducedMotion: z.enum(['SYSTEM', 'ON', 'OFF']),
  textScale: z.union([z.literal(100), z.literal(125), z.literal(150)]),
  theme: z.enum(['SYSTEM', 'LIGHT', 'DARK']),
  defaultSimulationMode: z.enum(['FAST', 'CHAPTER']),
});

export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;

/** API-PRO-001. 클라이언트에 노출되는 필드만(02 `LocalProfile` 전체가 아니다). */
export const ProfileSchema = z.strictObject({
  id: z.string().min(1),
  settings: ProfileSettingsSchema,
  linked: z.strictObject({ google: z.boolean(), toss: z.boolean() }),
  recoveryCodeIssuedAt: IsoUtcSchema.nullable(),
  createdAt: IsoUtcSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;

/** API-PRO-002. */
export const PatchProfileSettingsBodySchema = ProfileSettingsSchema.partial();
export type PatchProfileSettingsBody = z.infer<typeof PatchProfileSettingsBodySchema>;

/** API-AUTH-005. */
export const TossSessionBodySchema = z.strictObject({ anonKey: z.string().min(1) });
export type TossSessionBody = z.infer<typeof TossSessionBodySchema>;

export const TossSessionResponseSchema = z.strictObject({
  sessionToken: z.string().min(1),
  expiresAt: IsoUtcSchema,
});
export type TossSessionResponse = z.infer<typeof TossSessionResponseSchema>;
