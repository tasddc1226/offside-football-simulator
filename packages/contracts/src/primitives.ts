import { z } from 'zod';

/** ISO 8601 UTC, `Z` 접미만 허용한다. `Date` 객체는 계약에 쓰지 않는다. */
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

/**
 * T-11-818 클럽 멤버십 서포터 뱃지 단계(연속 구독 개월 수: 1 = 3개월 미만, 3 · 6 · 9 = 그 개월 이상). 단계 계산은
 * membership-rules.ts supporterTier. 지금 구독 중이 아니면 필드를 싣지 않는다.
 */
export const SupporterTierSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(6),
  z.literal(9),
]);
/** 응답에 붙이는 서포터 단계(배포 전 응답 · 구독하지 않는 구단주엔 없다). */
export const supporterField = SupporterTierSchema.optional();

export const IsoUtcSchema = z
  .string()
  .regex(ISO_UTC_PATTERN, '날짜는 ISO 8601 UTC 형식으로 입력해 주세요. 끝에 Z가 있어야 해요.');
