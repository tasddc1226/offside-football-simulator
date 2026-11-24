import { z } from 'zod';
import { TOUR_TACTICS } from './squad-tour.js';
import { FormationIdSchema, TeamMatchEventSchema } from './teams.js';

// T-11-825 원정 투어 API. 규칙 · 수치는 zod 없는 `./squad-tour.js`에 있고, 여기는 요청 · 응답 모양만 둔다.

export const TourTacticSchema = z.enum(TOUR_TACTICS);

export const TourRuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('peakMax'), max: z.number().int() }),
  z.strictObject({ kind: z.literal('enhanceMax'), max: z.number().int() }),
  z.strictObject({ kind: z.literal('plain') }),
  z.strictObject({ kind: z.literal('season'), when: z.enum(['now', 'past']) }),
  z.strictObject({ kind: z.literal('leagueBan'), league: z.string() }),
  z.strictObject({ kind: z.literal('typeCap'), max: z.number().int() }),
  z.strictObject({ kind: z.literal('nationCap'), max: z.number().int() }),
  z.strictObject({ kind: z.literal('leagueCap'), league: z.string(), max: z.number().int() }),
]);

/** 사다리의 한 경기(모두에게 같다). */
export const TourStageSchema = z.strictObject({
  stage: z.number().int().min(1),
  /** 상대의 자리 실력 평균. */
  opp: z.number(),
  formation: FormationIdSchema,
  /** 상대의 시작 전술(지면 전방 압박, 이기면 밀집 수비로 바꾼다). */
  tactic: TourTacticSchema,
  rules: z.array(TourRuleSchema),
  /** 처음 이기면 받는 대전료(만 원). */
  fee: z.number().int(),
  /** 빈 자리를 채우는 현지 용병의 자리 실력. */
  merc: z.number(),
  /** 내가 받은 별(0 = 아직 못 이김). */
  stars: z.number().int().min(0).max(3),
});
export type TourStage = z.infer<typeof TourStageSchema>;

const slotIds = z.array(z.string().min(1).max(64).nullable()).length(11);

/** 진행 중이거나 끝난 작전 경기. */
export const TourMatchSchema = z.strictObject({
  id: z.string(),
  stage: z.number().int(),
  /** 그 경기 몇 번째 도전인가. */
  tryNo: z.number().int(),
  status: z.enum(['live', 'won', 'lost']),
  /** 끝난 구간 수(0~3). */
  done: z.number().int(),
  formation: FormationIdSchema,
  slotIds,
  bench: z.array(z.string()),
  subsLeft: z.number().int(),
  tactic: TourTacticSchema,
  /** 자리별 체력(선발 순서, 0~100). */
  stamina: z.array(z.number()),
  oppTactic: TourTacticSchema,
  goalsFor: z.number().int(),
  goalsAgainst: z.number().int(),
  /** home = 상대(AI 구단), away = 나. */
  events: z.array(TeamMatchEventSchema),
  /** 작전 타임에만: 전술마다 지금부터 끝까지 이길 가망(0~1). */
  chances: z.partialRecord(TourTacticSchema, z.number()).nullable(),
  /** 끝난 경기만. */
  result: z
    .strictObject({
      pens: z.boolean(),
      stars: z.number().int(),
      score: z.number().int(),
      /** 이번에 받은 대전료(만 원). */
      fee: z.number().int(),
    })
    .nullable(),
});
export type TourMatchView = z.infer<typeof TourMatchSchema>;

export const TourStateResponseSchema = z.strictObject({
  /** 밸런스 tourOpen. false면 나머지는 빈 값이다. */
  open: z.boolean(),
  week: z.string(),
  season: z.number().int(),
  /** 이긴 경기 수(다음에 갈 경기는 cleared + 1). */
  cleared: z.number().int(),
  score: z.number().int(),
  /** 내 주간 순위(점수가 없으면 null). */
  rank: z.number().int().nullable(),
  triesLeft: z.number().int(),
  stages: z.array(TourStageSchema),
  live: TourMatchSchema.nullable(),
});
export type TourStateResponse = z.infer<typeof TourStateResponseSchema>;

export const TourStartBodySchema = z.strictObject({
  stage: z.number().int().min(1).max(999),
  formation: FormationIdSchema,
  slotIds,
  bench: z.array(z.string().min(1).max(64)).max(5),
  tactic: TourTacticSchema,
});
export type TourStartBody = z.infer<typeof TourStartBodySchema>;

export const TourOrderBodySchema = z.strictObject({
  /** 화면이 본 끝난 구간 수. 서버 값과 다르면 지시를 버리고 지금 상태를 돌려준다. */
  done: z.number().int().min(1).max(2),
  tactic: TourTacticSchema.optional(),
  subs: z
    .array(z.strictObject({ slot: z.number().int().min(0).max(10), cardId: z.string().min(1) }))
    .max(3)
    .optional(),
});
export type TourOrderBody = z.infer<typeof TourOrderBodySchema>;

export const TourMatchResponseSchema = z.strictObject({
  match: TourMatchSchema,
  triesLeft: z.number().int(),
  /** 대전료를 받았으면 그 뒤 잔액(만 원). */
  balance: z.number().int().nullable(),
});
export type TourMatchResponse = z.infer<typeof TourMatchResponseSchema>;

export const TourRankingResponseSchema = z.strictObject({
  week: z.string(),
  rows: z.array(
    z.strictObject({
      rank: z.number().int(),
      teamId: z.string().nullable(),
      name: z.string(),
      cleared: z.number().int(),
      score: z.number().int(),
      stars: z.number().int(),
    }),
  ),
});
export type TourRankingResponse = z.infer<typeof TourRankingResponseSchema>;
