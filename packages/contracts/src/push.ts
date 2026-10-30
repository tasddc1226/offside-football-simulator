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

/**
 * 종류별 알림 받기. T-11-501 nudge는 출석 · 복귀 · 첫 주 안내(kind 'return')다. 옛 앱은 strict 스키마로 응답을 읽어 모르는
 * 키가 오면 설정 화면이 깨지므로, 서버는 `?nudge=1`로 묻는 새 앱에만 nudge를 싣는다(LegacyPushPreferencesSchema가 옛 모양).
 */
export const LegacyPushPreferencesSchema = z
  .object({
    notice: z.boolean(),
    release: z.boolean(),
    team: z.boolean(),
    market: z.boolean(),
    social: z.boolean(),
  })
  .strict();
export const PushPreferencesSchema = LegacyPushPreferencesSchema.extend({
  nudge: z.boolean(),
}).strict();
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
  nudge: true,
};

/** Only activity metadata; the local save and player name never leave the device here. */
export const CareerActivitySchema = z
  .object({
    careerId: z.uuid().nullable(),
    state: z.enum(['active', 'retired', 'none']),
  })
  .strict()
  .refine((v) => (v.state === 'none') === (v.careerId === null));
export type CareerActivityInput = z.infer<typeof CareerActivitySchema>;
