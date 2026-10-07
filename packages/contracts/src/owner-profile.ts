// T-11-150 구단주 프로필(누구나 보는 화면)과 명예관(대표 칭호 고르기). 시즌을 넘어 쌓이는 기록 — 컵 트로피, 시즌별 업적
// 점수, 영구결번 — 을 한곳에 모은다. 남의 프로필은 팀 id로 연다(프로필 id는 내보내지 않는다).
import { z } from 'zod';
import { TITLE_NONE } from './owner-title.js';
import { OwnerTierTagSchema } from './season-recap.js';
import {
  CupHonorSchema,
  OwnerTitleSchema,
  TeamIdSchema,
  TeamLogoSchema,
  TeamSeasonSchema,
} from './teams.js';

const count = z.number().int().min(0);

/** 시즌 한 줄 — 끝난 시즌은 마감 때 굳힌 값, 지금 시즌은 지금 값. */
export const OwnerSeasonLineSchema = z.strictObject({
  season: TeamSeasonSchema,
  name: z.string(),
  /** 업적 점수(등급은 owner-team achGradeOf). 기록이 없으면 null. */
  achScore: count.nullable(),
  teamName: z.string().nullable(),
  /** 팀 레이팅 순위. 끝난 시즌은 마감 순위, 지금 시즌은 지금 순위. */
  teamRank: z.number().int().min(1).nullable(),
  closed: z.boolean(),
});
export type OwnerSeasonLine = z.infer<typeof OwnerSeasonLineSchema>;

export const OwnerProfileSchema = z.strictObject({
  nickname: z.string().nullable(),
  title: OwnerTitleSchema.nullable(),
  tier: OwnerTierTagSchema.nullable(),
  /** 가장 최근 시즌 팀(감독 이름과 함께). 팀을 만든 적이 없으면 null. */
  team: z
    .strictObject({
      id: TeamIdSchema,
      name: z.string(),
      manager: z.string(),
      logo: TeamLogoSchema.nullable().optional(),
      season: TeamSeasonSchema,
      seasonName: z.string(),
    })
    .nullable(),
  /** 컵 성적(최근 대회부터). 트로피 진열장. */
  cupHonors: z.array(CupHonorSchema),
  /** 시즌별 기록(오래된 시즌부터). */
  seasons: z.array(OwnerSeasonLineSchema),
  stats: z.strictObject({
    retiredNumbers: count,
    retired: count,
    /** 시즌 팀 순위 가운데 가장 높은 순위. */
    bestTeamRank: z.number().int().min(1).nullable(),
  }),
});
export type OwnerProfile = z.infer<typeof OwnerProfileSchema>;

export const OwnerProfileResponseSchema = z.strictObject({
  owner: OwnerProfileSchema,
  mine: z.boolean(),
});
export type OwnerProfileResponse = z.infer<typeof OwnerProfileResponseSchema>;

/** 명예관 — 내 프로필과 고를 수 있는 칭호(좋은 순). pinned: 내가 직접 고른 칭호(아니면 자동으로 가장 좋은 칭호). */
export const MyOwnerProfileResponseSchema = z.strictObject({
  owner: OwnerProfileSchema,
  titles: z.array(OwnerTitleSchema),
  pinned: z.boolean(),
});
export type MyOwnerProfileResponse = z.infer<typeof MyOwnerProfileResponseSchema>;

/** 대표 칭호 고르기. 'none'이면 달지 않는다, null이면 다시 자동(가장 좋은 칭호). */
export const PutOwnerTitleBodySchema = z.strictObject({
  title: z.union([OwnerTitleSchema, z.literal(TITLE_NONE)]).nullable(),
});
export type PutOwnerTitleBody = z.infer<typeof PutOwnerTitleBodySchema>;

export const PutOwnerTitleResponseSchema = z.strictObject({
  title: OwnerTitleSchema.nullable(),
  pinned: z.boolean(),
});
export type PutOwnerTitleResponse = z.infer<typeof PutOwnerTitleResponseSchema>;
