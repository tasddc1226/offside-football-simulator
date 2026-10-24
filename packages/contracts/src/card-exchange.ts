// T-11-374 카드 바치기 과제 API. 과제 정의는 card-exchange-rules(코드 묶음)라 응답에 싣지 않는다.
import { z } from 'zod';
import { CareerIdParamSchema } from './careers.js';
import { OWNER_ITEMS } from './cup.js';

/** 오늘 과제마다 내가 낸 횟수(낸 적 없는 과제는 빠진다). */
export const ExchangeMeResponseSchema = z.strictObject({
  claims: z.record(z.string(), z.number().int().min(0)),
});
export type ExchangeMeResponse = z.infer<typeof ExchangeMeResponseSchema>;

export const ExchangeClaimBodySchema = z.strictObject({
  careerIds: z.array(CareerIdParamSchema).min(1).max(11),
});
export type ExchangeClaimBody = z.infer<typeof ExchangeClaimBodySchema>;

export const ExchangeClaimResponseSchema = z.strictObject({
  claimed: z.number().int().min(1),
  /** 오늘 낸 과제 수(이번 요청 포함). */
  done: z.number().int().min(1),
  /** 오늘 과제를 모두 냈으면 보상, 아직이면 빈 배열. */
  rewards: z.array(z.strictObject({ item: z.enum(OWNER_ITEMS), qty: z.number().int().min(1) })),
  /** 새로 받은 구단주 칭호 id. */
  titles: z.array(z.string()),
});
export type ExchangeClaimResponse = z.infer<typeof ExchangeClaimResponseSchema>;
