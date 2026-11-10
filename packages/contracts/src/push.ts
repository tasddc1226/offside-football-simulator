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
  // OS 권한 상태. iOS 조용한 알림(provisional)과 정식 허용을 구분해 센다. 옛 앱은 보내지 않는다.
  permission: z.enum(['authorized', 'provisional']).optional(),
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
/**
 * 알림 주제. 지금 설정 6개(notice · release · team · market · social · nudge)를 더 잘게 나눈 것이다.
 * 주제 값을 고르지 않은 계정은 그 알림 종류(kind)의 옛 설정을 그대로 따른다.
 */
export const PUSH_TOPICS = [
  'match',
  'cup',
  'league',
  'market',
  'friend',
  'reward',
  'attendance',
  'comeback',
  'notice',
  'release',
] as const;
export const PushTopicSchema = z.enum(PUSH_TOPICS);
export type PushTopic = z.infer<typeof PushTopicSchema>;
/** 알림에 적는 주제. 공지 · 업데이트는 게시판 발송 경로라 알림 행에 주제를 적지 않는다. */
export const NOTIFICATION_TOPICS = [
  'match',
  'cup',
  'league',
  'market',
  'friend',
  'reward',
  'attendance',
  'comeback',
] as const;
export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];
/** `?v=2`로 묻는 앱에 주는 모양: 옛 설정을 반영한 주제별 실제 적용 값. */
export const PushTopicPreferencesSchema = z
  .object(
    Object.fromEntries(PUSH_TOPICS.map((t) => [t, z.boolean()])) as Record<PushTopic, z.ZodBoolean>,
  )
  .strict();
export type PushTopicPreferences = z.infer<typeof PushTopicPreferencesSchema>;
export const DEFAULT_PUSH_TOPIC_PREFERENCES = Object.fromEntries(
  PUSH_TOPICS.map((t) => [t, true]),
) as PushTopicPreferences;
/** 옛 키와 주제 키를 함께 받는다. 주제 키는 한 요청에 여러 개를 실을 수 있다(선택 창이 요청 하나로 저장). */
export const PutPushPreferencesSchema = PushPreferencesSchema.extend(
  PushTopicPreferencesSchema.shape,
)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: '변경할 알림 설정을 선택해 주세요.',
  });
export type PutPushPreferences = z.infer<typeof PutPushPreferencesSchema>;
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
