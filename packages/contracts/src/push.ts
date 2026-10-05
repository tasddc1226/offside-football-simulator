import { z } from 'zod';

/** 기기 식별자는 보안 저장소의 난수다. 서버에는 해시만 저장하고 응답에 토큰을 싣지 않는다. */
export const PushDeviceIdentitySchema = z.object({ installationId: z.uuid() }).strict();
export const RegisterPushDeviceSchema = PushDeviceIdentitySchema.extend({
  token: z
    .string()
    .max(256)
    .regex(/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  engagementEnabled: z.boolean().optional(),
}).strict();
export const PushDeviceResultSchema = z.object({ enabled: z.boolean() });
export const PushTestResultSchema = z.object({
  accepted: z.literal(true),
  nextTestAt: z.iso.datetime().optional(),
});
export type RegisterPushDevice = z.infer<typeof RegisterPushDeviceSchema>;
