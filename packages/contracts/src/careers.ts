import { z } from 'zod';

/**
 * T-9-009. 커리어·시즌 요약 + 이벤트 선택 로그 업로드 계약. 세이브 전체(브리프: "클라우드 세이브
 * 아님")가 아니라 커리어 메타 + 시즌 한 줄 요약 + 그 시즌의 버퍼링된 선택 로그만 담는다. 선수 이름은
 * 담지 않는다(브리프: 실명일 수 있어 저장 금지).
 */

export const CareerPosSchema = z.enum(['FW', 'MF', 'DF', 'GK']);
export type CareerPos = z.infer<typeof CareerPosSchema>;

export const CareerFootSchema = z.enum(['오른발', '왼발', '양발']);
export type CareerFoot = z.infer<typeof CareerFootSchema>;

const ShortStringSchema = z.string().max(40);

/** 커리어 생성 시 고정되는 메타(포지션·주발·유형·특성·시작 연도·앱 버전). 매 PUT마다 함께 보내
 * 새 커리어면 이 값으로 생성하고, 이미 있으면 값이 같은지 검증 없이 덮어쓴다(클라이언트가 정본). */
export const CareerMetaSchema = z.strictObject({
  pos: CareerPosSchema,
  foot: CareerFootSchema,
  type: ShortStringSchema,
  trait: ShortStringSchema,
  startYear: z.number().int().min(2000).max(2200),
  appVersion: ShortStringSchema,
});
export type CareerMeta = z.infer<typeof CareerMetaSchema>;

export const CareerHonorSchema = z.string().max(60);

/** season.ts `endSeason()`이 만드는 `CareerRecord`에서 뽑아낸 한 시즌 요약. */
export const CareerSeasonPayloadSchema = z.strictObject({
  age: z.number().int().min(0).max(100),
  club: ShortStringSchema,
  league: ShortStringSchema,
  apps: z.number().int().min(0).max(1000),
  goals: z.number().int().min(0).max(1000),
  assists: z.number().int().min(0).max(1000),
  rating: z.number().min(0).max(10),
  // game/types.ts `CareerRecord.rank`가 number|string이라 그대로 허용한다(예: 병역 연차 표시).
  rank: z.union([z.number().int().min(0).max(100), z.string().max(20)]),
  ovr: z.number().int().min(0).max(200),
  honors: z.array(CareerHonorSchema).max(30),
  mil: z.boolean().optional(),
});
export type CareerSeasonPayload = z.infer<typeof CareerSeasonPayloadSchema>;

/** 시즌 중 버퍼링되는 선택 로그 한 줄. 자유 텍스트 없이 짧은 코드만 담는다(브리프: "no free text"). */
export const EventLogEntrySchema = z.strictObject({
  /** 종류: 'ev'(이벤트) | 'mkt'(이적시장) | 'mil'(병역) 등. */
  k: z.string().min(1).max(8),
  id: z.string().min(1).max(32),
  c: z.union([z.number().int().min(-1000).max(1000), z.string().max(24)]),
  ok: z.boolean().optional(),
  /** 발생 시점(halves/phase 인덱스). */
  h: z.number().int().min(0).max(1000),
});
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

export const PutCareerSeasonBodySchema = z.strictObject({
  career: CareerMetaSchema,
  season: CareerSeasonPayloadSchema,
  events: z.array(EventLogEntrySchema).max(300),
});
export type PutCareerSeasonBody = z.infer<typeof PutCareerSeasonBodySchema>;

export const CareerUpsertResponseSchema = z.strictObject({
  careerId: z.string().min(1),
  year: z.number().int(),
  status: z.enum(['active', 'retired']),
});
export type CareerUpsertResponse = z.infer<typeof CareerUpsertResponseSchema>;

/** season.ts `retire()`가 만드는 `HofEntry` + `legendScore()`에서 뽑아낸 은퇴 요약. */
export const RetirementSummarySchema = z.strictObject({
  retireAge: z.number().int().min(0).max(100),
  peak: z.number().int().min(0).max(200),
  legendScore: z.number().int().min(0).max(100000),
  apps: z.number().int().min(0).max(100000),
  goals: z.number().int().min(0).max(100000),
  assists: z.number().int().min(0).max(100000),
  trophies: z.number().int().min(0).max(10000),
  awards: z.number().int().min(0).max(10000),
  caps: z.number().int().min(0).max(10000),
  ballon: z.number().int().min(0).max(1000),
  lastClub: ShortStringSchema,
});
export type RetirementSummary = z.infer<typeof RetirementSummarySchema>;

export const PutRetirementBodySchema = RetirementSummarySchema;
export type PutRetirementBody = z.infer<typeof PutRetirementBodySchema>;

export const RetirementResponseSchema = z.strictObject({
  careerId: z.string().min(1),
  status: z.literal('retired'),
});
export type RetirementResponse = z.infer<typeof RetirementResponseSchema>;

/** careerId 경로 파라미터. 클라이언트가 `crypto.randomUUID()`로 만든다(브리프). */
export const CareerIdParamSchema = z.string().uuid();

/** `/seasons/:year` 경로 파라미터. */
export const CareerYearParamSchema = z.coerce.number().int().min(2000).max(2200);
