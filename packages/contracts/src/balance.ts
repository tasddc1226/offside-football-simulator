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

export const BalanceVersionListSchema = z.object({ versions: z.array(BalanceVersionSchema) });
export type BalanceVersionList = z.infer<typeof BalanceVersionListSchema>;

export const BalanceDraftInputSchema = z.strictObject({
  note: z.string().trim().max(BALANCE_NOTE_MAX).default(''),
  values: BalanceOverridesSchema,
});
export type BalanceDraftInput = z.input<typeof BalanceDraftInputSchema>;

export const BalanceVersionParamSchema = z.coerce.number().int().min(1).max(1_000_000);
