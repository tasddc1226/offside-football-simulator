import { z } from 'zod';
import { BEST11_SLOTS } from './best11-rules.js';
import { DetailPosSchema } from './careers.js';

// T-11-463 시즌 BEST 11 공개 조회(`GET /v1/best11?season=`). 모두에게 같은 응답이라 엣지에 담는다. 구단주 id는 내보내지 않고,
// 같은 구단주라 빠진 후보는 held로만 알린다.

export const Best11SlotSchema = z.enum(BEST11_SLOTS);

export const Best11PlayerSchema = z.object({
  careerId: z.string(),
  name: z.string(),
  dpos: DetailPosSchema,
  nation: z.string().nullable(),
  peak: z.number().int(),
  retiredAt: z.string(),
  /** BEST 11 지수와 세 기둥(자리 1위 = 100). */
  index: z.number(),
  ind: z.number(),
  team: z.number(),
  award: z.number(),
  /** 선정 이유: 전성기 5시즌 평점, 프로 경기, 리그 우승 · 챔스 · 월드컵 · 발롱도르 · FIFPRO · 자기 포지션 상. */
  facts: z.object({
    rating: z.number(),
    apps: z.number().int(),
    leagues: z.number().int(),
    ucl: z.number().int(),
    wc: z.number().int(),
    ballon: z.number().int(),
    fifpro: z.number().int(),
    posAwards: z.number().int(),
  }),
});
export type Best11Player = z.infer<typeof Best11PlayerSchema>;

export const Best11RankedSchema = Best11PlayerSchema.extend({
  /** 'xi' 이미 BEST 11(이 자리나 다른 자리), 'owner' 같은 구단주의 다른 선수가 BEST 11이라 빠짐. */
  held: z.enum(['xi', 'owner']).nullable(),
  /** BEST 11에 오른 자리(held가 'xi'일 때). */
  at: Best11SlotSchema.nullable(),
});
export type Best11Ranked = z.infer<typeof Best11RankedSchema>;

export const Best11ChangeSchema = z.object({
  slot: Best11SlotSchema,
  at: z.string(),
  in: z.string().nullable(),
  out: z.string().nullable(),
});
export type Best11Change = z.infer<typeof Best11ChangeSchema>;

export const Best11ResponseSchema = z.object({
  season: z.number().int(),
  /** 시즌 마감 뒤 확정되면 확정 시각. null이면 잠정(은퇴마다 바뀐다). */
  finalAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  slots: z.array(
    z.object({
      slot: Best11SlotSchema,
      player: Best11PlayerSchema.nullable(),
      since: z.string().nullable(),
    }),
  ),
  /** 자리마다 지수 상위 BEST11_TOP명(CB2는 CB1과 같은 후보군이라 없다). */
  rankings: z.array(z.object({ slot: Best11SlotSchema, entries: z.array(Best11RankedSchema) })),
  /** 최근 자리 주인 변화(새것부터). */
  changes: z.array(Best11ChangeSchema),
});
export type Best11Response = z.infer<typeof Best11ResponseSchema>;
