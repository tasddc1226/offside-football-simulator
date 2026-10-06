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
  // 구버전 앱 호환용 필드. 수신 여부는 기기 등록/해제로 통일하며 이 값으로 대상을 거르지 않는다.
  engagementEnabled: z.boolean().optional(),
}).strict();
export const PushDeviceResultSchema = z.object({ enabled: z.boolean() });
export const PushTestResultSchema = z.object({
  accepted: z.literal(true),
  nextTestAt: z.iso.datetime().optional(),
});
export type RegisterPushDevice = z.infer<typeof RegisterPushDeviceSchema>;

/** 재방문 안내는 기기 전체 수신 설정을 따르며 별도 항목을 두지 않는다. */
export const PushPreferencesSchema = z
  .object({
    notice: z.boolean(),
    release: z.boolean(),
    team: z.boolean(),
    market: z.boolean(),
    social: z.boolean(),
  })
  .strict();
export const PutPushPreferencesSchema = PushPreferencesSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '변경할 알림 설정을 선택해 주세요.' },
);
export type PushPreferences = z.infer<typeof PushPreferencesSchema>;
export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  notice: true,
  release: true,
  team: true,
  market: true,
  social: true,
};
