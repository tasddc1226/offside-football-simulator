// T-11-128 구단주 시즌 결산과 휘장. 시즌이 끝나면(프리시즌은 첫 시즌 개막, 시즌은 마감) 서버가 그 시각까지의 기록을
// 한 번 굳히고(owner_season_records) 휘장을 영구히 남긴다(owner_honors). 굳힌 뒤에는 계산식이 바뀌어도 다시 세지 않는다.
import { z } from 'zod';
import { CARD_TIERS } from './card-tier.js';
import { CareerPosSchema } from './careers.js';
import { OWNER_TIERS } from './owner-tier.js';
import { IsoUtcSchema } from './primitives.js';
import { TeamPlayerSchema, TeamSeasonSchema } from './teams.js';

/** 휘장 종류. 순위 휘장은 band(1위 · 상위 10 · …)로, 보유 휘장은 value(개수)로 단계를 나눈다. */
export const HONOR_KINDS = [
  'pioneer',
  'achievements',
  'team',
  'hof',
  'retired-number',
  'wall-of-honor',
  'first',
] as const;
export const HonorKindSchema = z.enum(HONOR_KINDS);
export type HonorKind = z.infer<typeof HonorKindSchema>;

/** 순위 휘장의 단계 — 순위가 이 값 안이면 그 단계(작은 값이 위). */
export const HONOR_BANDS = {
  achievements: [1, 10, 100],
  team: [1, 10, 50],
  hof: [1, 10, 100],
} as const satisfies Partial<Record<HonorKind, readonly number[]>>;
export type RankedHonorKind = keyof typeof HONOR_BANDS;

export const OwnerHonorSchema = z.strictObject({
  season: TeamSeasonSchema,
  kind: HonorKindSchema,
  /** 순위 휘장의 단계(1 · 10 · 50 · 100). 보유 휘장은 null. */
  band: z.number().int().min(1).nullable(),
  /** 순위 휘장의 실제 순위. */
  rank: z.number().int().min(1).nullable(),
  /** 보유 휘장의 개수(결번 · 명예의 벽 · 최초 기록). */
  value: z.number().int().min(0).nullable(),
  grantedAt: IsoUtcSchema,
});
export type OwnerHonor = z.infer<typeof OwnerHonorSchema>;

const RankSchema = z.number().int().min(1).nullable();
const CountSchema = z.number().int().min(0);

/** 결산 화면 · 공유 카드용 시즌 기록 — 마감 전 은퇴한 그 시즌 선수들의 통산 합과 카드 등급별 수. */
export const SeasonRecapStatsSchema = z.strictObject({
  apps: CountSchema,
  goals: CountSchema,
  assists: CountSchema,
  trophies: CountSchema,
  caps: CountSchema,
  ballon: CountSchema,
  /** 카드 등급별 선수 수(card-tier.ts). */
  tiers: z.record(z.enum(CARD_TIERS), CountSchema),
  /** 가장 많이 넣은 선수. */
  scorer: z
    .strictObject({
      careerId: z.string(),
      name: z.string().nullable(),
      pos: CareerPosSchema,
      goals: CountSchema,
    })
    .nullable(),
});
export type SeasonRecapStats = z.infer<typeof SeasonRecapStatsSchema>;

/** 결산 단체사진 · 카드 흐름에 싣는 선수 수(레전드 점수 순). */
export const RECAP_SQUAD_MAX = 30;

/** 그 시즌에 키워 마감 전에 은퇴한 선수(카드 + 도트 유니폼용 마지막 구단). */
export const RecapSquadMemberSchema = z.strictObject({
  card: TeamPlayerSchema,
  lastClub: z.string().nullable(),
  lastClubId: z.string().nullable(),
});
export type RecapSquadMember = z.infer<typeof RecapSquadMemberSchema>;

export const SeasonRecapSchema = z.strictObject({
  season: TeamSeasonSchema,
  /** 이 시각까지의 기록이다(프리시즌은 첫 시즌 개막). */
  cutoff: IsoUtcSchema,
  closedAt: IsoUtcSchema,
  /** 그 시즌에 키운 선수 · 마감 전에 은퇴한 선수. */
  players: CountSchema,
  retired: CountSchema,
  /** 마감 전 은퇴한 선수 가운데 레전드 점수가 가장 높은 선수. */
  best: z
    .strictObject({
      careerId: z.string(),
      name: z.string().nullable(),
      pos: CareerPosSchema,
      lastClub: z.string().nullable(),
      score: CountSchema,
      /** 최고 OVR(카드 등급 색). */
      peak: z.number().int().nullable(),
      /** 선수 카드(팀 화면 카드와 같은 모양). 구버전 응답에는 없다. */
      card: TeamPlayerSchema.nullable().optional(),
    })
    .nullable(),
  /** 그 시즌 명예의 전당(마감 전 은퇴) 안에서 내 선수의 가장 높은 순위. */
  hofRank: RankSchema,
  hofRanked: CountSchema,
  retiredNumbers: CountSchema,
  wallOfHonor: CountSchema,
  firsts: CountSchema,
  team: z
    .strictObject({
      name: z.string(),
      rating: z.number().int(),
      rank: RankSchema,
      ranked: CountSchema,
      wins: CountSchema,
      draws: CountSchema,
      losses: CountSchema,
      goalsFor: CountSchema,
      /** 실점 · 가장 크게 이긴 점수 차. 기록 묶음이 없던 결산이면 null. */
      goalsAgainst: CountSchema.nullable(),
      bestMargin: CountSchema.nullable(),
      bestStreak: CountSchema,
    })
    .nullable(),
  achievements: z
    .strictObject({
      score: CountSchema,
      done: CountSchema,
      rank: RankSchema,
      ranked: CountSchema,
    })
    .nullable(),
  /** 기록 묶음. 굳히기 전 결산이면 null. */
  stats: SeasonRecapStatsSchema.nullable(),
  /** 키운 선수들(레전드 점수 순, RECAP_SQUAD_MAX명까지). 구버전 응답에는 없다. */
  squad: z.array(RecapSquadMemberSchema).max(RECAP_SQUAD_MAX).optional(),
});
export type SeasonRecap = z.infer<typeof SeasonRecapSchema>;

export const SeasonRecapResponseSchema = z.strictObject({
  season: TeamSeasonSchema,
  /** pending: 아직 끝나지 않았거나 서버가 굳히는 중 · none: 그 시즌 기록이 없다 · ready: 결산이 있다. */
  status: z.enum(['pending', 'none', 'ready']),
  recap: SeasonRecapSchema.nullable(),
  honors: z.array(OwnerHonorSchema),
});
export type SeasonRecapResponse = z.infer<typeof SeasonRecapResponseSchema>;

/** 결산을 볼 수 있는 시즌 목록과 내 휘장 전부(시즌 기록 보관함 · 트로피장). */
export const OwnerHonorsResponseSchema = z.strictObject({
  /** 끝난 시즌(오래된 순). 결산을 굳히는 중인 시즌도 들어 있다. */
  seasons: z.array(TeamSeasonSchema),
  honors: z.array(OwnerHonorSchema),
});
export type OwnerHonorsResponse = z.infer<typeof OwnerHonorsResponseSchema>;

/** 프로필 · 댓글 · 채팅에 붙는 티어(그 시즌과 함께). 티어 규칙은 zod 없는 owner-tier.ts. */
export const OwnerTierSchema = z.enum(OWNER_TIERS);
export const OwnerTierTagSchema = z.strictObject({
  tier: OwnerTierSchema,
  season: TeamSeasonSchema,
});
export type OwnerTierTag = z.infer<typeof OwnerTierTagSchema>;
