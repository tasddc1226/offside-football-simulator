import { z } from 'zod';
import {
  BOARD_KEYS,
  COMMENT_BODY_MAX,
  COMMENT_NICKNAME_MAX,
  POST_BODY_MAX,
  POST_TITLE_MAX,
  POST_VERSION_MAX,
} from './board-limits.js';
import { IsoUtcSchema } from './primitives.js';

export * from './board-limits.js';

/**
 * T-10-011. 게시판 공통 구조 — 보드 키로 나뉜 글(post)과 글마다 달리는 댓글(comment).
 * 읽기는 누구나, 글은 관리자만, 댓글은 프로필이 있는 누구나 쓴다. 새 게시판(예: 버그 제보)은
 * BOARD_KEYS에 키를 더하고, 보드별 규칙이 다르면 API 라우트에서 나눈다.
 */
export const BoardKeySchema = z.enum(BOARD_KEYS);

export const BoardIdParamSchema = z.string().regex(/^(pst|cmt)_[0-9a-f-]{36}$/);

export const BoardListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** 이전 페이지 마지막 글의 createdAt. 고정 글은 첫 페이지에만 온다. */
  before: IsoUtcSchema.optional(),
});

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const PostInputSchema = z.strictObject({
  title: trimmed(POST_TITLE_MAX),
  body: trimmed(POST_BODY_MAX),
  /** 릴리즈 노트의 버전 표기(예: v1.4.0). */
  version: z.string().trim().max(POST_VERSION_MAX).optional(),
  pinned: z.boolean().default(false),
});
export type PostInput = z.input<typeof PostInputSchema>;

export const CommentInputSchema = z.strictObject({
  nickname: trimmed(COMMENT_NICKNAME_MAX),
  body: trimmed(COMMENT_BODY_MAX),
});
export type CommentInput = z.infer<typeof CommentInputSchema>;

export const PostSummarySchema = z.object({
  id: z.string(),
  board: BoardKeySchema,
  title: z.string(),
  version: z.string().nullable(),
  pinned: z.boolean(),
  commentCount: z.number().int().min(0),
  createdAt: IsoUtcSchema,
  updatedAt: IsoUtcSchema,
});
export type PostSummary = z.infer<typeof PostSummarySchema>;

export const PostSchema = PostSummarySchema.extend({ body: z.string() });
export type Post = z.infer<typeof PostSchema>;

export const CommentSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  body: z.string(),
  /** 관리자가 쓴 댓글(운영자 표시). */
  admin: z.boolean(),
  /** 보는 사람이 지울 수 있다(본인 댓글이거나 관리자). */
  deletable: z.boolean(),
  createdAt: IsoUtcSchema,
});
export type Comment = z.infer<typeof CommentSchema>;

export const BoardListResponseSchema = z.object({ posts: z.array(PostSummarySchema), hasMore: z.boolean() });
export type BoardListResponse = z.infer<typeof BoardListResponseSchema>;

export const PostDetailResponseSchema = z.object({ post: PostSchema, comments: z.array(CommentSchema) });
export type PostDetailResponse = z.infer<typeof PostDetailResponseSchema>;

export const BoardViewerResponseSchema = z.object({ admin: z.boolean() });
export type BoardViewerResponse = z.infer<typeof BoardViewerResponseSchema>;
