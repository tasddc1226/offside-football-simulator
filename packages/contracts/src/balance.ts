import { z } from 'zod';
import {
  BALANCE_KEYS,
  BALANCE_NOTE_MAX,
  BALANCE_SPEC,
  CHOICE_BONUS_RANGE,
  CHOICE_KEY_PATTERN,
  EVENT_ID_PATTERN,
  EVENT_WEIGHT_RANGE,
  type BalanceKey,
} from './balance-spec.js';
import { IsoUtcSchema } from './primitives.js';

export * from './balance-spec.js';

/** T-10-016. 밸런스 설정(기본값과 다른 값만). 범위를 벗어나거나 모르는 키면 거절한다. */
export const BalanceOverridesSchema = z.strictObject({
  ...(Object.fromEntries(
    BALANCE_KEYS.map((k) => [
      k,
      z.number().min(BALANCE_SPEC[k].min).max(BALANCE_SPEC[k].max).optional(),
    ]),
  ) as Record<BalanceKey, z.ZodOptional<z.ZodNumber>>),
  eventWeight: z
    .record(
      z.string().regex(EVENT_ID_PATTERN),
      z.number().min(EVENT_WEIGHT_RANGE.min).max(EVENT_WEIGHT_RANGE.max),
    )
    .optional(),
  choiceBonus: z
    .record(
      z.string().regex(CHOICE_KEY_PATTERN),
      z.number().min(CHOICE_BONUS_RANGE.min).max(CHOICE_BONUS_RANGE.max),
    )
    .optional(),
});

/** GET /v1/balance — 지금 적용 중인 버전. 활성 버전이 없으면 version 0(코드 기본값). */
export const BalanceConfigSchema = z.object({
  version: z.number().int().min(0),
  values: BalanceOverridesSchema,
  activatedAt: IsoUtcSchema.nullable(),
});
export type BalanceConfig = z.infer<typeof BalanceConfigSchema>;

/** T-11-141 공개 밸런스 이력: 한 번이라도 적용된 버전(최근 적용 순). 운영 메모는 싣지 않는다. */
export const BALANCE_HISTORY_LIMIT = 30;

/** T-11-333 코드 배포로 바뀐 밸런스 키 기본값 하나 — 이력 화면이 버전 변경과 같은 모양(이전 → 이후)으로 그린다. */
export const BalancePatchChangeSchema = z.strictObject({
  key: z.enum(BALANCE_KEYS as [BalanceKey, ...BalanceKey[]]),
  from: z.number(),
  to: z.number(),
});
export type BalancePatchChange = z.infer<typeof BalancePatchChangeSchema>;
export const BALANCE_PATCH_CHANGES_MAX = 20;

/** 한국어 원문과 번역(없으면 한국어를 보여 준다). */
const LocalizedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ ko: item, en: item.optional(), ja: item.optional(), zh: item.optional() });
export const BalancePatchSchema = z.object({
  /** 릴리즈 노트 항목 id와 같다. */
  id: z.string().min(1).max(80),
  appliedAt: IsoUtcSchema,
  title: LocalizedSchema(z.string()),
  items: LocalizedSchema(z.array(z.string())),
  changes: z.array(BalancePatchChangeSchema).max(BALANCE_PATCH_CHANGES_MAX),
  /** 패치를 알린 릴리즈 노트 글(소식 → 업데이트). 없으면 null. */
  postId: z.string().nullable(),
});
export type BalancePatch = z.infer<typeof BalancePatchSchema>;

export const BalanceHistorySchema = z.object({
  versions: z
    .array(
      z.object({
        version: z.number().int().min(1),
        values: BalanceOverridesSchema,
        activatedAt: IsoUtcSchema,
        active: z.boolean(),
      }),
    )
    .max(BALANCE_HISTORY_LIMIT),
  /** T-11-333 코드 배포로 적용된 패치(최근 적용 순). 화면은 버전과 섞어 적용 순으로 보여 준다. */
  patches: z.array(BalancePatchSchema).max(BALANCE_HISTORY_LIMIT),
});
export type BalanceHistory = z.infer<typeof BalanceHistorySchema>;

const BalanceStatusSchema = z.enum(['draft', 'active', 'archived']);

export const BalanceVersionSchema = z.object({
  version: z.number().int().min(1),
  status: BalanceStatusSchema,
  note: z.string(),
  values: BalanceOverridesSchema,
  createdAt: IsoUtcSchema,
  updatedAt: IsoUtcSchema,
  activatedAt: IsoUtcSchema.nullable(),
});
export type BalanceVersion = z.infer<typeof BalanceVersionSchema>;

/** T-11-488 다음 시즌 개막에 켤 버전. 개막 뒤 첫 5분 cron이 활성화하고 지운다. */
export const BalanceScheduleSchema = z.object({
  version: z.number().int().min(1),
  season: z.number().int().min(1),
  scheduledAt: IsoUtcSchema,
});
export type BalanceSchedule = z.infer<typeof BalanceScheduleSchema>;

export const BalanceVersionListSchema = z.object({
  versions: z.array(BalanceVersionSchema),
  /** T-11-488 예약(없으면 null). 옛 서버 응답에는 없다. */
  scheduled: BalanceScheduleSchema.nullable().optional(),
});
export type BalanceVersionList = z.infer<typeof BalanceVersionListSchema>;

export const BalanceDraftInputSchema = z.strictObject({
  note: z.string().trim().max(BALANCE_NOTE_MAX).default(''),
  values: BalanceOverridesSchema,
});
export type BalanceDraftInput = z.input<typeof BalanceDraftInputSchema>;

export const BalanceVersionParamSchema = z.coerce.number().int().min(1).max(1_000_000);
