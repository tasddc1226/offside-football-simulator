import { z } from 'zod';
import { IsoUtcSchema } from './primitives.js';
import { TeamIdSchema } from './teams.js';

// T-11-418 오프사이드 리그 API 모양. 값 · 일정 계산은 zod 없는 league.ts.

export const LeaguePhaseSchema = z.enum(['soon', 'open', 'closed', 'running', 'done']);

export const LeagueInfoSchema = z.strictObject({
  season: z.number().int().min(1),
  /** 그 시즌 개막. 이보다 앞선 신청은 사전 신청이다. */
  startsAt: IsoUtcSchema,
  opensAt: IsoUtcSchema,
  closesAt: IsoUtcSchema,
  drawAt: IsoUtcSchema,
  /** 라운드별 경기 시각(1라운드부터). */
  rounds: z.array(IsoUtcSchema),
  minFilled: z.number().int(),
});
export type LeagueInfo = z.infer<typeof LeagueInfoSchema>;

/** 리그 한눈에(누구나). 1차(T-11-418)는 접수만 연다 — 배치 · 순위표 · 경기는 다음 배포에서 더한다. */
export const LeagueResponseSchema = z.strictObject({
  league: LeagueInfoSchema,
  phase: LeaguePhaseSchema,
  /** 신청한 구단주 수(취소한 신청 빼고). */
  entries: z.number().int().min(0),
});
export type LeagueResponse = z.infer<typeof LeagueResponseSchema>;

/**
 * 내 신청과 준비 상태. 신청은 참가 의사만 남기고(사전 신청은 새 시즌 팀이 없을 때 받는다), 배치 때 그 시즌 팀의 선발 실카드
 * 수(minFilled 이상)로 자격을 본다. team은 지금 그 시즌 내 팀(없으면 null).
 */
export const LeagueMeResponseSchema = z.strictObject({
  entry: z.strictObject({ createdAt: IsoUtcSchema }).nullable(),
  /** 지금 신청할 수 있는가(접수 중이고 아직 신청하지 않았다). */
  canEnter: z.boolean(),
  team: z
    .strictObject({
      teamId: TeamIdSchema,
      /** 지금 선발에 든 실제 선수 수. */
      filled: z.number().int(),
      ovr: z.number().int(),
    })
    .nullable(),
});
export type LeagueMeResponse = z.infer<typeof LeagueMeResponseSchema>;
