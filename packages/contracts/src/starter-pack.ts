import { z } from 'zod';
import { IapStoreSchema } from './cup-api.js';

// T-11-770d 첫 구매 묶음 API 모양. 구성 · 가격은 zod 없는 starter-pack-rules.ts(`@offside/contracts/starter-pack`).

const Count = z.number().int().min(0);

/**
 * GET /v1/starter-pack — 로그인한 구단주의 첫 구매 묶음 자격.
 * - eligible: 지금 살 수 있다(stores · account가 온다).
 * - owned: 이미 샀다. 다시 팔지 않는다.
 * - ineligible: 살 수 없다(실결제 이력이 있거나, 끝까지 뛴 은퇴 선수가 아직 없거나, 대조군).
 * - off: 지금은 팔지 않는다(서버 스위치 · 이 구단주가 쓸 수 있는 스토어 없음).
 */
export const StarterPackResponseSchema = z.strictObject({
  state: z.enum(['eligible', 'owned', 'ineligible', 'off']),
  /** 이 구성의 판. */
  version: z.string().min(1).max(16),
  /** 사면 받는 아이템. */
  items: z.strictObject({ reroll: Count, boost: Count, scout: Count, rename: Count }),
  stores: z.array(IapStoreSchema),
  /** 살 수 있을 때만: 결제에 붙일 구단주 표시(Apple appAccountToken · Google obfuscatedAccountId). */
  account: z.string().optional(),
});
export type StarterPackResponse = z.infer<typeof StarterPackResponseSchema>;

/** POST /v1/starter-pack/iap — 앱에서 산 묶음 거래를 확인하고 아이템을 준다. 같은 거래를 다시 보내면 같은 결과다. */
export const StarterPackIapBodySchema = z.strictObject({
  store: IapStoreSchema,
  token: z.string().min(1).max(16384),
});
export type StarterPackIapBody = z.infer<typeof StarterPackIapBodySchema>;

/** 지급 뒤: 자격(owned)과 지금 가진 장수. */
export const StarterPackIapResponseSchema = z.strictObject({
  pack: StarterPackResponseSchema,
  have: z.strictObject({ reroll: Count, boost: Count, scout: Count, rename: Count }),
});
export type StarterPackIapResponse = z.infer<typeof StarterPackIapResponseSchema>;
