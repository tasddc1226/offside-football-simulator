import { z } from 'zod';
import { COMMENT_BODY_MAX } from './board-limits.js';
import { LOCALES } from './i18n.js';

/** T-11-146 사용자가 쓴 글(댓글·채팅)의 "번역 보기". 가장 긴 댓글까지 받는다(채팅은 더 짧다). */
export const TRANSLATE_TEXT_MAX = COMMENT_BODY_MAX;

export const TranslateInputSchema = z.strictObject({
  text: z.string().trim().min(1).max(TRANSLATE_TEXT_MAX),
  to: z.enum(LOCALES),
});

export const TranslateResponseSchema = z.object({ text: z.string() });
export type TranslateResponse = z.infer<typeof TranslateResponseSchema>;
