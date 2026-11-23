import { z } from 'zod';
import { LOCALES } from './i18n.js';
import { IsoUtcSchema } from './primitives.js';
import {
  hasVisibleChar,
  VOICE_ADMIN_PAGE,
  VOICE_ADMIN_PAGE_MAX,
  VOICE_BODY_MAX,
  VOICE_BODY_MIN,
  VOICE_KINDS,
  VOICE_PLATFORMS,
  VOICE_RESOLVE_MAX,
} from './voice-limits.js';

export * from './voice-limits.js';

// T-11-802 게임 안 '의견 보내기'. 숫자 · 종류는 zod 없는 ./voice-limits.ts(@offside/contracts/voice)에 있다.

/** 맥락 칸은 길이 상한만 둔다. 값은 서버가 다듬는다(모르는 종류는 other, 패턴 밖 입구는 null 등). */
const ContextField = z.string().max(200).optional();

/**
 * `POST /v1/voices`(익명 프로필 허용, 성공하면 204). 본문만 엄격히 본다(앞뒤 공백을 뺀 2~500자, 보이는 글자 하나 이상).
 * 모르는 필드는 버린다. 선수 이름 · 닉네임 · 구단 이름 · 커리어 id · 전체 UA는 보내지 않는다.
 */
export const VoiceInputSchema = z.object({
  body: z.string().trim().min(VOICE_BODY_MIN).max(VOICE_BODY_MAX).refine(hasVisibleChar),
  kind: ContextField,
  screen: ContextField,
  platform: ContextField,
  version: ContextField,
  device: ContextField,
});
export type VoiceInput = z.input<typeof VoiceInputSchema>;

/** `GET /v1/admin/voices` 운영 목록. before는 앞 쪽 마지막 의견의 createdAt(최신순). */
export const AdminVoiceQuerySchema = z.strictObject({
  status: z.enum(['open', 'all']).default('open'),
  kind: z.enum(VOICE_KINDS).optional(),
  /** 한 프로필의 의견만. */
  profile: z.string().max(64).optional(),
  before: IsoUtcSchema.optional(),
  limit: z.coerce.number().int().min(1).max(VOICE_ADMIN_PAGE_MAX).default(VOICE_ADMIN_PAGE),
});
export type AdminVoiceQuery = z.input<typeof AdminVoiceQuerySchema>;

/** 운영자가 읽는 의견 한 줄. body는 저장할 때 메일 · 전화번호 · 복구 코드를 가린 본문이다. */
export const AdminVoiceSchema = z.object({
  id: z.string(),
  kind: z.enum(VOICE_KINDS),
  body: z.string(),
  /** 의견 창을 연 곳(settings · home). 모르는 값이었으면 null. */
  screen: z.string().nullable(),
  platform: z.enum(VOICE_PLATFORMS),
  version: z.string(),
  device: z.string().nullable(),
  lang: z.enum(LOCALES),
  createdAt: IsoUtcSchema,
  /** 운영자가 처리한 시각. 열린 의견은 null. */
  resolvedAt: IsoUtcSchema.nullable(),
  profileId: z.string(),
  /** 구글 · 애플 로그인 구단주면 true, 익명 프로필이면 false. */
  linked: z.boolean(),
});
export type AdminVoice = z.infer<typeof AdminVoiceSchema>;

/** items는 최신순, hasMore면 더 보기가 있다. open은 필터와 상관없는 전체 열린 의견 수. */
export const AdminVoiceListSchema = z.object({
  items: z.array(AdminVoiceSchema),
  hasMore: z.boolean(),
  open: z.number().int().min(0),
});
export type AdminVoiceList = z.infer<typeof AdminVoiceListSchema>;

/** `POST /v1/admin/voices/resolve`. resolved가 true면 처리, false면 다시 연다. 없는 id는 건너뛴다. */
export const AdminVoiceResolveSchema = z.strictObject({
  ids: z.array(z.string().min(1).max(64)).min(1).max(VOICE_RESOLVE_MAX),
  resolved: z.boolean(),
});
export type AdminVoiceResolve = z.infer<typeof AdminVoiceResolveSchema>;

/** 상태가 실제로 바뀐 의견 수. */
export const AdminVoiceResolveResultSchema = z.object({ updated: z.number().int().min(0) });
export type AdminVoiceResolveResult = z.infer<typeof AdminVoiceResolveResultSchema>;
