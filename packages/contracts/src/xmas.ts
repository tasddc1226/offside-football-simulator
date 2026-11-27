import { z } from 'zod';
import { XMAS_TARGET_RE } from './xmas-rules.js';

// T-11-834 크리스마스 이벤트 API 모양. 규칙 · 보상 표는 zod 없는 xmas-rules.ts(`@offside/contracts/xmas`).

const Count = z.number().int().min(0);
const RewardSchema = z.strictObject({
  reroll: Count.optional(),
  boost: Count.optional(),
  scout: Count.optional(),
  rename: Count.optional(),
});

export const XmasSockSchema = z.strictObject({
  key: z.enum(['start', 'retire', 'team']),
  reward: RewardSchema,
  /** 조건을 채웠다(로그인하지 않았어도 세는 것은 센다). */
  done: z.boolean(),
  claimed: z.boolean(),
});

export const XmasTreeStepSchema = z.strictObject({
  pct: Count,
  reward: RewardSchema,
  reached: z.boolean(),
  claimed: z.boolean(),
});

/**
 * GET /v1/events/xmas — 이벤트 상태. 누구나 볼 수 있고, 프로필이 있으면 내 양말 · 내가 보탠 수를 함께 준다. owner가 false면
 * 받기 전에 로그인해야 한다(보상은 로그인한 구단주만).
 */
export const XmasEventSchema = z.strictObject({
  phase: z.enum(['before', 'open', 'ended']),
  startAt: z.string(),
  treeEndAt: z.string(),
  endAt: z.string(),
  owner: z.boolean(),
  socks: z.array(XmasSockSchema),
  tree: z.strictObject({
    count: Count,
    goal: Count,
    /** 내가 트리 기간에 은퇴시킨 커리어 수. */
    mine: Count,
    counting: z.boolean(),
    steps: z.array(XmasTreeStepSchema),
  }),
  /** 한정 칭호를 가졌다. */
  title: z.boolean(),
});
export type XmasEvent = z.infer<typeof XmasEventSchema>;
export type XmasSock = z.infer<typeof XmasSockSchema>;

/** POST /v1/events/xmas/claim — 양말 하나나 트리 단계 하나를 받는다. 같은 대상을 다시 보내면 409 XMAS_CLAIMED. */
export const XmasClaimBodySchema = z.strictObject({ target: z.string().regex(XMAS_TARGET_RE) });
export type XmasClaimBody = z.infer<typeof XmasClaimBodySchema>;

export const XmasClaimResponseSchema = z.strictObject({
  event: XmasEventSchema,
  granted: z.strictObject({ reroll: Count, boost: Count, scout: Count, rename: Count }),
  /** 이번에 한정 칭호를 받았다. */
  title: z.boolean(),
});
export type XmasClaimResponse = z.infer<typeof XmasClaimResponseSchema>;
