import { z } from 'zod';
import { IsoUtcSchema } from './primitives.js';

/**
 * API-NOTICE-001. 사용자 결정(2026-09-14): 홈 공지사항은 서버가 관리한다(D1 `notices` 테이블).
 * `body`는 문단 배열이다 — 화면은 각 항목을 별도 `<p>`로 그린다(HomeCommunity의 기존 렌더링).
 */
export const NoticeSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.array(z.string().min(1)).min(1),
  publishedAt: IsoUtcSchema,
});

export type Notice = z.infer<typeof NoticeSchema>;

export const NOTICES_DEFAULT_LIMIT = 10;
export const NOTICES_MAX_LIMIT = 50;

export const NoticesResponseSchema = z.strictObject({
  items: z.array(NoticeSchema),
});

export type NoticesResponse = z.infer<typeof NoticesResponseSchema>;
