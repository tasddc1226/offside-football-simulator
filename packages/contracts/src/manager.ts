import { z } from 'zod';
import { CareerIdParamSchema, CareerPosSchema, DetailPosSchema } from './careers.js';
import {
  MANAGER_ENDINGS,
  MANAGER_GRADES,
  MANAGER_SEASONS_MAX,
  MANAGER_SPECIALS,
  MANAGER_SPECIALS_MAX,
  MANAGER_STYLES,
  MASTERY_GRADES,
} from './manager-rules.js';
import { IsoUtcSchema } from './primitives.js';

// T-11-310 감독 커리어 API. 규칙 값은 zod 없는 `./manager-rules.ts`에 있다.

export const ManagerCareerIdSchema = z.string().regex(/^mgr_[0-9a-f-]{36}$/);

const grade = z.enum(MASTERY_GRADES);
export const ManagerMasterySchema = z.strictObject({
  '4-3-3': grade,
  '4-4-2': grade,
  '3-5-2': grade,
});

/** 감독 커리어 시작값의 재료(서버가 은퇴 기록으로 채운다, manager-rules ManagerOrigin). */
export const ManagerOriginSchema = z.strictObject({
  pos: CareerPosSchema,
  dpos: DetailPosSchema.nullable(),
  seasons: z.number().int().min(0),
  apps: z.number().int().min(0),
  clubs: z.number().int().min(0),
  trophies: z.number().int().min(0),
  caps: z.number().int().min(0),
  peak: z.number().int().min(0),
  legendScore: z.number().int().min(0),
  retireAge: z.number().int().nullable(),
  nation: z.string().nullable(),
});

const small = z.number().int().min(0).max(200);

/** 끝낸 감독 커리어의 결과(기기가 보낸다). 감독 칸 효과는 숙련 · 성향 · 특기만 쓴다. */
export const ManagerResultSchema = z.strictObject({
  mastery: ManagerMasterySchema,
  style: z.enum(MANAGER_STYLES),
  specials: z
    .array(z.enum(MANAGER_SPECIALS))
    .max(MANAGER_SPECIALS_MAX)
    .refine((a) => new Set(a).size === a.length, 'duplicate special'),
  grade: z.enum(MANAGER_GRADES),
  ending: z.enum(MANAGER_ENDINGS),
  seasons: z.number().int().min(1).max(MANAGER_SEASONS_MAX),
  /** 리그 우승 · 컵 우승 · 승격 · 경질 횟수, 거친 구단 수. */
  titles: small,
  cups: small,
  promotions: small,
  sacked: small,
  clubs: z
    .number()
    .int()
    .min(1)
    .max(MANAGER_SEASONS_MAX + 2),
  /** 이끈 가장 높은 리그 id(contracts club-names LEAGUE_BASE). */
  topLeague: z.string().max(8),
  wins: z.number().int().min(0).max(1000),
  draws: z.number().int().min(0).max(1000),
  losses: z.number().int().min(0).max(1000),
});
export type ManagerResult = z.infer<typeof ManagerResultSchema>;

/** 감독 커리어 한 건. active는 진행 중, done은 감독 카드. 포기한 커리어는 목록에 오지 않는다. */
export const ManagerCareerSchema = z.strictObject({
  id: ManagerCareerIdSchema,
  careerId: CareerIdParamSchema,
  status: z.enum(['active', 'done']),
  /** 기기가 감독 커리어를 처음 만들 때 쓰는 시드. */
  seed: z.number().int().min(0),
  origin: ManagerOriginSchema,
  result: ManagerResultSchema.nullable(),
  /** 선수 카드 표시(공개 이름 · 등번호 · 꾸미기). 이름을 공개하지 않았으면 null. */
  publicName: z.string().nullable(),
  number: z.number().int().nullable(),
  look: z.string().nullable().optional(),
  startedAt: IsoUtcSchema,
  finishedAt: IsoUtcSchema.nullable(),
  /** T-11-345 끝낸 감독을 경질하면 받을 구단 자금(만 원). 직접 키운 선수만 방출처럼 받고, 영입한 카드는 0. 목록에만 온다. */
  releaseValue: z.number().int().min(0).optional(),
});
export type ManagerCareer = z.infer<typeof ManagerCareerSchema>;

/** 감독 커리어를 시작할 수 있는 내 카드(감독이 아닌 지금 가진 카드). 확인 창이 잃는 것을 미리 보여 준다. */
export const ManagerCandidateSchema = z.strictObject({
  careerId: CareerIdParamSchema,
  publicName: z.string().nullable(),
  number: z.number().int().nullable(),
  pos: CareerPosSchema,
  dpos: DetailPosSchema.nullable(),
  peak: z.number().int(),
  look: z.string().nullable().optional(),
  season: z.number().int().min(0),
  /** 기준가(만 원). 지금 시즌 선발에 들어 있으면 구단 가치에서 이만큼 빠진다. 옛 기록은 null. */
  cardValue: z.number().int().nullable(),
  inLineup: z.boolean(),
  listed: z.boolean(),
});
export type ManagerCandidate = z.infer<typeof ManagerCandidateSchema>;

export const ManagersResponseSchema = z.strictObject({
  active: ManagerCareerSchema.nullable(),
  managers: z.array(ManagerCareerSchema),
  candidates: z.array(ManagerCandidateSchema),
  /** 지금 시즌 팀 감독 칸에 앉은 감독(팀이 없거나 비었으면 null). */
  coachId: CareerIdParamSchema.nullable(),
  /** 지금 시즌 팀이 있는지(감독 칸은 팀이 있어야 쓴다). */
  hasTeam: z.boolean(),
});
export type ManagersResponse = z.infer<typeof ManagersResponseSchema>;

export const StartManagerBodySchema = z.strictObject({ careerId: CareerIdParamSchema });
export type StartManagerBody = z.infer<typeof StartManagerBodySchema>;

export const ManagerCareerResponseSchema = z.strictObject({ career: ManagerCareerSchema });
export type ManagerCareerResponse = z.infer<typeof ManagerCareerResponseSchema>;

/** T-11-345 끝낸 감독 경질 결과: 받은 자금 · 남은 잔액(만 원). */
export const ReleaseManagerResponseSchema = z.strictObject({
  amount: z.number().int().min(0),
  balance: z.number().int(),
});
export type ReleaseManagerResponse = z.infer<typeof ReleaseManagerResponseSchema>;

export const FinishManagerBodySchema = z.strictObject({ result: ManagerResultSchema });
export type FinishManagerBody = z.infer<typeof FinishManagerBodySchema>;

/** 팀 감독 칸에 든 감독(팀 화면 · 경기 상세). */
export const TeamCoachSchema = z.strictObject({
  careerId: CareerIdParamSchema,
  publicName: z.string().nullable(),
  number: z.number().int().nullable(),
  pos: CareerPosSchema,
  look: z.string().nullable().optional(),
  mastery: ManagerMasterySchema,
  style: z.enum(MANAGER_STYLES),
  specials: z.array(z.enum(MANAGER_SPECIALS)).max(MANAGER_SPECIALS_MAX),
  grade: z.enum(MANAGER_GRADES),
  ending: z.enum(MANAGER_ENDINGS),
});
export type TeamCoach = z.infer<typeof TeamCoachSchema>;
