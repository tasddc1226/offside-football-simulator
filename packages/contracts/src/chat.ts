import { z } from 'zod';
import { COMMENT_REPORT_REASONS } from './board-limits.js';
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

/** T-11-167 내가 차단한 사람 목록(채팅 화면에서 차단을 푼다). 푸는 건 게시판과 같은 DELETE /v1/boards/blocks/:id다. */
export const ChatBlockListResponseSchema = z.strictObject({
  blocks: z.array(ChatBlockResponseSchema),
});
export type ChatBlockListResponse = z.infer<typeof ChatBlockListResponseSchema>;

/** T-11-015 운영자 채팅 신고 목록 — 처리하지 않은 신고를 메시지마다 모은다. 본문은 신고할 때 남긴 사본이다. */
export const AdminChatReportSchema = z.object({
  messageId: z.string(),
  nickname: z.string(),
  body: z.string(),
  reasons: z.array(z.enum(COMMENT_REPORT_REASONS)),
  reports: z.number().int().min(0),
  lastReportedAt: IsoUtcSchema,
});
export type AdminChatReport = z.infer<typeof AdminChatReportSchema>;
export const AdminChatReportListSchema = z.object({ items: z.array(AdminChatReportSchema) });
export type AdminChatReportList = z.infer<typeof AdminChatReportListSchema>;
/** hide: 메시지를 가린다. dismiss: 그대로 두고 닫는다. mute: 작성자를 days일 정지하고 메시지도 가린다. */
export const AdminChatReportResolveSchema = z.discriminatedUnion('action', [
  z.strictObject({ messageId: ChatMessageIdSchema, action: z.enum(['hide', 'dismiss']) }),
  z.strictObject({
    messageId: ChatMessageIdSchema,
    action: z.literal('mute'),
    days: z.literal(CHAT_MUTE_DAYS),
  }),
]);
export type AdminChatReportResolve = z.infer<typeof AdminChatReportResolveSchema>;
