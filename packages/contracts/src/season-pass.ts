import { z } from 'zod';
import { IapStoreSchema } from './cup-api.js';

// T-11-511 시즌 패스 API 모양. 규칙 · 단계표는 zod 없는 season-pass-rules.ts(`@offside/contracts/season-pass`).

const Count = z.number().int().min(0);

/** 한 시즌의 패스. owned가 false면 그 시즌 패스를 사지 않았다(진행도는 그래도 보인다). claimed = 받은 단계까지. */
export const SeasonPassSeasonSchema = z.strictObject({
  season: z.number().int().min(0),
  owned: z.boolean(),
  progress: Count,
  tier: Count,
  claimed: Count,
});
export type SeasonPassSeason = z.infer<typeof SeasonPassSeasonSchema>;

/**
 * GET /v1/season-pass — 로그인한 구단주의 패스. seasons[0]은 지금 시즌이고, 뒤로 산 패스 가운데 아직 받지 않은 단계가 남은
 * 지난 시즌 · 미리 산 다음 시즌이 붙는다. onSale이 false면 새로 팔지 않는다(산 패스의 보상은 계속 받는다). stores는 이
 * 구단주가 앱에서 살 수 있는 스토어.
 */
export const SeasonPassResponseSchema = z.strictObject({
  onSale: z.boolean(),
  stores: z.array(IapStoreSchema),
  /** 살 수 있을 때만: 결제에 붙일 구단주 표시(Apple appAccountToken · Google obfuscatedAccountId). */
  account: z.string().optional(),
  seasons: z.array(SeasonPassSeasonSchema).min(1),
});
export type SeasonPassResponse = z.infer<typeof SeasonPassResponseSchema>;

/** POST /v1/season-pass/iap — 앱에서 산 패스 거래를 확인하고 연다. 같은 거래를 다시 보내면 같은 결과다. */
export const SeasonPassIapBodySchema = z.strictObject({
  store: IapStoreSchema,
  token: z.string().min(1).max(16384),
});
export type SeasonPassIapBody = z.infer<typeof SeasonPassIapBodySchema>;

/** POST /v1/season-pass/claim — 그 시즌 패스의 열린 단계 보상을 한꺼번에 받는다. */
export const SeasonPassClaimBodySchema = z.strictObject({ season: z.number().int().min(0) });
export type SeasonPassClaimBody = z.infer<typeof SeasonPassClaimBodySchema>;

export const SeasonPassClaimResponseSchema = z.strictObject({
  pass: SeasonPassResponseSchema,
  granted: z.strictObject({ reroll: Count, boost: Count, scout: Count, rename: Count }),
});
export type SeasonPassClaimResponse = z.infer<typeof SeasonPassClaimResponseSchema>;
