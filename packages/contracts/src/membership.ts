// T-11-512 클럽 멤버십 API(GET /v1/membership, POST /v1/membership/iap).
import { z } from 'zod';
import { IapStoreSchema } from './cup-api.js';

export const MembershipResponseSchema = z.strictObject({
  /** 지금 혜택이 있나(만료 · 환불이면 false). */
  active: z.boolean(),
  /** 혜택이 끝나는 시각(스토어의 다음 결제일 · 결제 유예 끝). 구독한 적이 없으면 null. */
  until: z.string().nullable(),
  /** 다음 달에 다시 결제되나. 스토어가 알려 주지 않았으면 null. */
  autoRenew: z.boolean().nullable(),
  /** 구독한 스토어. 구독한 적이 없으면 null. */
  store: IapStoreSchema.nullable(),
  /** 이 구단주가 지금 가입할 수 있는 스토어(판매 스위치 · 서버 설정). 비어 있으면 가입 버튼을 보이지 않는다. */
  stores: z.array(IapStoreSchema),
  /** 스토어 구매에 붙이는 구단주 표시(stores가 비어 있지 않을 때만). */
  account: z.uuid().optional(),
});
export type MembershipResponse = z.infer<typeof MembershipResponseSchema>;

export const MembershipIapBodySchema = z.strictObject({
  store: IapStoreSchema,
  /** Apple: 서명된 거래(JWS), Google: purchaseToken. */
  token: z.string().min(1).max(8192),
});
export type MembershipIapBody = z.infer<typeof MembershipIapBodySchema>;
