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

// ───────── 자동 플레이 탐지 (관찰 전용) ─────────

/** 의심 근거. 가중치·문턱은 api `automation.ts`. */
export const AutomationReasonSchema = z.enum([
  /** navigator.webdriver — 자동화 도구가 조종하는 브라우저. */
  'webdriver',
  /** User-Agent가 헤드리스 브라우저. */
  'headless',
  /** 스크립트가 만든 클릭이 절반 넘음. */
  'synthetic',
  /** 시즌이 끝났는데 직접 한 클릭·키·터치가 없음. */
  'noInput',
  /** 마우스로 클릭하는데 커서 이동이 거의 없음(클릭당 2번 미만). */
  'noMoves',
  /** 시즌 간격이 기계처럼 일정함(문턱은 api db/repos/automation.ts). */
  'metronome',
  /** 시즌 간격이 꽤 일정함(metronome보다 약한 근거). */
  'steady',
  /** 같은 이름에 번호만 바꾼 커리어를 연달아 돌림. */
  'serial',
  /** 조회 구간 대부분(10시간 이상)에 걸쳐 쉬지 않고 업로드. */
  'nonstop',
  /** AI·봇을 떠올리게 하는 이름. */
  'aiName',
]);
export type AutomationReason = z.infer<typeof AutomationReasonSchema>;

const AutomationCareerSchema = z.object({
  careerId: z.string(),
  name: z.string().nullable(),
  status: z.enum(['active', 'retired']),
  seasons: count,
  /** 시즌 사이 간격 중앙값(초). 기기가 잰 시간이 있으면 그것, 없으면 서버 도착 간격. */
  medianGapSec: z.number().nullable(),
  /** 간격의 변동계수(표준편차/평균). 간격이 적으면 null(최소 수는 api automation.ts). */
  cv: z.number().nullable(),
  reasons: z.array(AutomationReasonSchema),
});

export const AutomationSuspectSchema = z.object({
  /** 프로필 id 앞 8자리. */
  profile: z.string(),
  score: count,
  level: z.enum(['high', 'medium']),
  reasons: z.array(AutomationReasonSchema),
  seasons: count,
  /** 시즌을 올린 서로 다른 시간(시각 단위) 수. */
  activeHours: count,
  firstAt: IsoUtcSchema,
  lastAt: IsoUtcSchema,
  careers: z.array(AutomationCareerSchema),
});
export type AutomationSuspect = z.infer<typeof AutomationSuspectSchema>;

/** `GET /v1/admin/automation?hours=` 최근 hours시간 동안 시즌을 올린 프로필 중 의심 점수가 있는 곳(점수순). */
export const AutomationReportSchema = z.object({
  generatedAt: IsoUtcSchema,
  hours: count,
  /** 조회 구간에 시즌을 올린 프로필 수(비교용). */
  profiles: count,
  suspects: z.array(AutomationSuspectSchema),
});
export type AutomationReport = z.infer<typeof AutomationReportSchema>;
export const AutomationHoursSchema = z.coerce.number().int().min(1).max(24).default(6);
