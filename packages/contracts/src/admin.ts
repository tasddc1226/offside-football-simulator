import { z } from 'zod';
import { NAME_REPORT_KINDS } from './board-limits.js';
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
  /** ?reported=1 이면 신고된 댓글만. */
  reported: z
    .literal('1')
    .optional()
    .transform((v) => v === '1'),
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
  /** 받은 신고 수. */
  reports: z.number().int().min(0).default(0),
  createdAt: IsoUtcSchema,
});
export type AdminComment = z.infer<typeof AdminCommentSchema>;

export const AdminCommentListSchema = z.object({
  comments: z.array(AdminCommentSchema),
  hasMore: z.boolean(),
});
export type AdminCommentList = z.infer<typeof AdminCommentListSchema>;

/** 처리를 기다리는 이름 신고 — 대상마다 한 줄. name은 지금 보이는 이름(대상이 지워졌으면 null). */
export const AdminNameReportSchema = z.object({
  kind: z.enum(NAME_REPORT_KINDS),
  targetId: z.string(),
  name: z.string().nullable(),
  reports: count,
  lastReportedAt: IsoUtcSchema,
});
export type AdminNameReport = z.infer<typeof AdminNameReportSchema>;
export const AdminNameReportListSchema = z.object({ items: z.array(AdminNameReportSchema) });
export type AdminNameReportList = z.infer<typeof AdminNameReportListSchema>;
/** hide: 이름을 가린다(선수는 익명, 구단은 HIDDEN_TEAM_NAME·HIDDEN_MANAGER_NAME). dismiss: 그대로 두고 닫는다. */
export const AdminNameReportResolveSchema = z.strictObject({
  kind: z.enum(NAME_REPORT_KINDS),
  id: z.string().min(1).max(64),
  action: z.enum(['hide', 'dismiss']),
});
export type AdminNameReportResolve = z.infer<typeof AdminNameReportResolveSchema>;

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

export const AnomalyReasonSchema = z.enum([
  /** 나이별 OVR 상한을 크게 넘음(자동 숨김). */
  'ovrFar',
  /** 나이별 OVR 상한을 조금 넘음(검토). */
  'ovrHigh',
  /** 한 시즌에 OVR이 정상 최대 상승 폭보다 많이 오름(자동 숨김). */
  'jump',
  /** 레전드 점수가 정상 상위권을 넘음(검토). */
  'legend',
]);
export type AnomalyReason = z.infer<typeof AnomalyReasonSchema>;

export const AnomalyCareerSchema = z.object({
  careerId: z.string(),
  status: z.enum(['active', 'retired']),
  legendScore: z.number().int().nullable(),
  peak: z.number().int().nullable(),
  reasons: z.array(AnomalyReasonSchema),
});
export type AnomalyCareer = z.infer<typeof AnomalyCareerSchema>;

/** `GET /v1/admin/anomalies` 운영자가 볼 비정상 기록: 검토 대상(숨기지 않은 의심)과 지금 숨겨진 커리어. */
export const AnomalyReportSchema = z.object({
  generatedAt: IsoUtcSchema,
  review: z.array(AnomalyCareerSchema),
  hidden: z.array(AnomalyCareerSchema),
});
export type AnomalyReport = z.infer<typeof AnomalyReportSchema>;

/** `POST /v1/admin/careers/hidden` 커리어를 공개 순위에서 숨기거나(true) 되돌린다(false). 되돌리면 자동 숨김이 다시 걸지 않는다. */
export const CareerHiddenInputSchema = z.object({
  careerId: z.string().min(1).max(64),
  hidden: z.boolean(),
});
export type CareerHiddenInput = z.infer<typeof CareerHiddenInputSchema>;

// ───────── T-11-153 구단 자금 대조 ─────────
// 잔액(owner_funds) = 방출 + 판매(가격 − 수수료) − 영입 − 구단 자금으로 산 것(owner_item_purchases). 금액은 만 원 단위.

/** 구단주 한 명의 자금 출처별 합과 대조 결과. diff = 잔액 − 기대값(0이 아니면 기록 밖에서 바뀐 돈). */
export const AdminFundsOwnerSumsSchema = z.object({
  profileId: z.string(),
  nickname: z.string().nullable(),
  balance: z.number().int(),
  released: z.number().int(),
  sold: z.number().int(),
  bought: z.number().int(),
  items: z.number().int(),
  diff: z.number().int(),
});
export type AdminFundsOwnerSums = z.infer<typeof AdminFundsOwnerSumsSchema>;

/** `GET /v1/admin/funds` 전체 구단주 대조 요약과 어긋난 구단주(차이 큰 순, 최대 50). */
export const AdminFundsReportSchema = z.object({
  generatedAt: IsoUtcSchema,
  owners: z.number().int(),
  balance: z.number().int(),
  released: z.number().int(),
  sold: z.number().int(),
  bought: z.number().int(),
  /** 거래 수수료로 없어진 돈. */
  fees: z.number().int(),
  /** 구단 자금으로 산 것(없어진 돈) — item별(reroll · reward:<kind>). */
  items: z.record(z.string(), z.number().int()),
  mismatched: z.number().int(),
  mismatches: z.array(AdminFundsOwnerSumsSchema),
});
export type AdminFundsReport = z.infer<typeof AdminFundsReportSchema>;

/** 자금이 움직인 한 번. amount는 들어오면 +, 나가면 −. item은 kind가 item일 때(reroll · reward:<kind>). */
export const AdminFundsMoveSchema = z.object({
  kind: z.enum(['released', 'sold', 'bought', 'item']),
  item: z.string().nullable(),
  amount: z.number().int(),
  at: z.string(),
});
export type AdminFundsMove = z.infer<typeof AdminFundsMoveSchema>;

/** `GET /v1/admin/funds/owner?q=` 프로필 id(prf_…) 또는 닉네임으로 찾은 구단주 한 명의 대조와 최근 움직임(최대 50). */
export const AdminFundsOwnerSchema = AdminFundsOwnerSumsSchema.extend({
  moves: z.array(AdminFundsMoveSchema),
});
export type AdminFundsOwner = z.infer<typeof AdminFundsOwnerSchema>;
export const AdminFundsQuerySchema = z.string().trim().min(1).max(64);
