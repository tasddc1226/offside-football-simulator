import { z } from 'zod';
import { CHAT_DENY_REASONS, CHAT_MUTE_DAYS } from './chat-limits.js';
import { IsoUtcSchema } from './primitives.js';

export * from './chat-limits.js';

/**
 * T-11-015 `POST /v1/chat/ticket`. 쓸 수 있으면 ticket을 받아 소켓 주소에 붙인다(`?t=`). 못 쓰면 ticket 없이
 * 읽기만 한다 — reason이 이유다. author는 내 메시지를 알아보는 키, blocked는 내가 차단한 작성자 키, reported는
 * 내가 신고한 메시지 id(둘 다 화면에서 뺀다).
 */
export const ChatTicketResponseSchema = z.strictObject({
  ticket: z.string().nullable(),
  reason: z.enum(CHAT_DENY_REASONS).nullable(),
  author: z.string().nullable(),
  nickname: z.string().nullable(),
  admin: z.boolean(),
  mutedUntil: IsoUtcSchema.nullable(),
  blocked: z.array(z.string()),
  reported: z.array(z.string()).default([]),
});
export type ChatTicketResponse = z.infer<typeof ChatTicketResponseSchema>;

/** 채팅 메시지 id(방이 만드는 UUID). */
export const ChatMessageIdSchema = z.uuid();

/** 운영자 채팅 정지. 메시지 한 줄로 작성자를 고른다. */
export const ChatMuteInputSchema = z.strictObject({
  days: z.literal(CHAT_MUTE_DAYS),
});
export type ChatMuteInput = z.infer<typeof ChatMuteInputSchema>;

/** 차단 응답 — 게시판 차단(board_blocks)과 같은 줄이고, author로 채팅 화면에서 바로 뺀다. */
export const ChatBlockResponseSchema = z.strictObject({
  id: z.string(),
  nickname: z.string(),
  createdAt: IsoUtcSchema,
  author: z.string(),
});
export type ChatBlockResponse = z.infer<typeof ChatBlockResponseSchema>;
