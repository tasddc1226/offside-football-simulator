import { z } from 'zod';
import { BoardKeySchema } from './boards.js';
import { IsoUtcSchema } from './primitives.js';

/** T-10-016 운영 도구(관리자 전용) — 대시보드 · 댓글 관리. 밸런스 설정은 ./balance.ts. */

const count = z.number().int().min(0);

/** 날짜는 한국 시간(KST) 기준 YYYY-MM-DD. */
const AdminDailySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  profiles: count,
  careers: count,
  retired: count,
});

export const AdminStatsSchema = z.object({
  generatedAt: IsoUtcSchema,
  profiles: z.object({
    total: count,
    linked: count,
    new24h: count,
    new7d: count,
    active24h: count,
    active7d: count,
  }),
  careers: z.object({
    total: count,
    active: count,
    retired: count,
    new7d: count,
    retired7d: count,
  }),
  board: z.object({ posts: count, comments: count, comments7d: count }),
  /** 최근 14일(오늘 포함, 오래된 날부터). 기록이 없는 날도 0으로 채운다. */
  daily: z.array(AdminDailySchema),
  balance: z
    .object({ version: z.number().int().min(1), activatedAt: IsoUtcSchema.nullable() })
    .nullable(),
  audit: z.array(z.object({ kind: z.string(), createdAt: IsoUtcSchema })),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

const ProfileIdSchema = z.string().regex(/^prf_[0-9a-f-]{36}$/);

export const AdminCommentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** 이전 페이지 마지막 댓글의 createdAt. */
  before: IsoUtcSchema.optional(),
  /** 한 작성자(프로필)의 댓글만. */
  profile: ProfileIdSchema.optional(),
});

export const AdminCommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  postTitle: z.string(),
  board: BoardKeySchema,
  profileId: z.string(),
  nickname: z.string(),
  body: z.string(),
  admin: z.boolean(),
  createdAt: IsoUtcSchema,
});
export type AdminComment = z.infer<typeof AdminCommentSchema>;

export const AdminCommentListSchema = z.object({
  comments: z.array(AdminCommentSchema),
  hasMore: z.boolean(),
});
export type AdminCommentList = z.infer<typeof AdminCommentListSchema>;

/** 한 작성자의 댓글을 모두 지운다(도배·욕설 대응). */
export const AdminCommentPurgeInputSchema = z.strictObject({ profileId: ProfileIdSchema });
export const AdminCommentPurgeResultSchema = z.object({ deleted: count });
