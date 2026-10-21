import { z } from 'zod';
import { CareerPosSchema } from './careers.js';
import { IsoUtcSchema } from './primitives.js';
import { CupStandingSchema, CupTeamSchema } from './cup-api.js';
import { LEAGUE_OUTCOMES } from './league.js';
import { TeamIdSchema, TeamMatchSchema } from './teams.js';

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
  /** 신청한 구단주 수(취소한 신청 빼고). 배치 뒤에는 리그에 든 팀 수. */
  entries: z.number().int().min(0),
  /** T-11-418b 배치 뒤 부별 리그 수 · 팀 수(1부부터). 배치 전 · 옛 응답에는 없다. */
  tiers: z
    .array(
      z.strictObject({
        tier: z.number().int().min(1),
        leagues: z.number().int().min(1),
        teams: z.number().int().min(0),
      }),
    )
    .optional(),
  /** 마지막으로 끝난 라운드(1부터, 아직 없으면 0). 배치 전에는 없다. */
  playedRounds: z.number().int().min(0).optional(),
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
  /**
   * T-11-430 그 시즌 팀이 아직 없을 때(사전 신청 기간) 지금 시즌 내 팀의 선발 실카드 수. 자격 안내에 참고로 보인다. 그 시즌
   * 팀이 있거나 지금 시즌 팀도 없으면 null, 옛 응답에는 없다.
   */
  lastTeam: z
    .strictObject({ season: z.number().int(), filled: z.number().int() })
    .nullable()
    .optional(),
  /**
   * T-11-418b 배치 결과. placed: 리그에 들어감, dropped: 배치 때 자격(선발 실카드)이 모자라 빠짐, forfeited: 기권이 쌓여 남은 경기를
   * 모두 기권패로 치름. 배치 전 · 옛 응답에는 없다.
   */
  placement: z
    .strictObject({
      status: z.enum(['placed', 'dropped', 'forfeited']),
      tier: z.number().int().nullable(),
      league: z.number().int().nullable(),
      teamId: TeamIdSchema.nullable(),
      rank: z.number().int().nullable(),
      /**
       * T-11-430 빠진 이유(dropped만): short는 배치 때 자격(선발 실카드)이 모자람, capacity는 자격은 갖췄지만 참가 팀 수에
       * 맞춰 리그를 꾸리고 남음. 옛 응답에는 없다.
       */
      reason: z.enum(['short', 'capacity']).optional(),
      /** T-11-430 지금까지 쌓인 기권 수(리그에 든 팀만). 옛 응답에는 없다. */
      forfeits: z.number().int().min(0).optional(),
      /**
       * T-11-418e 결산(14라운드 뒤). 최종 순위 · 결과 · 받은 보상 · 다음 시즌에 신청하면 시작하는 부(기권 퇴출은 null = 맨
       * 아래). 결산 전 · 옛 응답에는 없다.
       */
      final: z
        .strictObject({
          rank: z.number().int(),
          outcome: z.enum(LEAGUE_OUTCOMES),
          rerolls: z.number().int(),
          scouts: z.number().int(),
          boosts: z.number().int(),
          nextTier: z.number().int().nullable(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
});
export type LeagueMeResponse = z.infer<typeof LeagueMeResponseSchema>;

/** T-11-418b 리그 한 팀(순위표 줄의 팀 정보). 컵 팀과 같은 모양. */
export const LeagueTeamSchema = CupTeamSchema;
export type LeagueTeam = z.infer<typeof LeagueTeamSchema>;

export const LeagueStandingSchema = CupStandingSchema.extend({
  /** 기권 수(LEAGUE_FORFEIT_LIMIT에 닿으면 남은 경기는 모두 기권패). */
  forfeits: z.number().int().min(0),
});
export type LeagueStanding = z.infer<typeof LeagueStandingSchema>;

export const LeagueMatchSchema = z.strictObject({
  id: z.string(),
  /** 라운드(1부터). */
  round: z.number().int().min(1),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  at: IsoUtcSchema,
  played: z.boolean(),
  homeGoals: z.number().int().nullable(),
  awayGoals: z.number().int().nullable(),
  /** 기권으로 끝난 경기(나오지 못한 쪽이 0:3 패, 둘 다면 둘 다 패). */
  forfeit: z.boolean(),
  /**
   * T-11-418d 마지막 라운드 동시 중계용 골 시각(분 · 넣은 쪽). 마지막 라운드의 치른 경기에만 있다(기권 경기 · 다른 라운드 ·
   * 옛 응답에는 없다).
   */
  goals: z
    .array(z.strictObject({ minute: z.number().int(), side: z.enum(['home', 'away']) }))
    .optional(),
});
export type LeagueMatch = z.infer<typeof LeagueMatchSchema>;

/** T-11-418b 리그 하나(누구나): 팀 · 순위표 · 14라운드 경기. */
export const LeagueTableResponseSchema = z.strictObject({
  season: z.number().int(),
  tier: z.number().int().min(1),
  league: z.number().int().min(1),
  teams: z.array(LeagueTeamSchema),
  standings: z.array(LeagueStandingSchema),
  matches: z.array(LeagueMatchSchema),
  /**
   * T-11-418d 리그 득점 순위(유스 선수 빼고, 많은 순 · 같으면 같은 순위로 상한까지). name은 공개 이름(비공개면 null이라
   * 화면이 포지션 · 등번호로 익명 표기를 만든다). 옛 응답에는 없다.
   */
  scorers: z
    .array(
      z.strictObject({
        name: z.string().nullable(),
        pos: CareerPosSchema,
        number: z.number().int().nullable(),
        teamId: z.string(),
        goals: z.number().int().min(1),
      }),
    )
    .optional(),
});
export type LeagueTableResponse = z.infer<typeof LeagueTableResponseSchema>;

/** T-11-418b 리그 경기 상세(누구나). */
export const LeagueMatchResponseSchema = z.strictObject({
  match: TeamMatchSchema,
  league: z.strictObject({
    tier: z.number().int(),
    league: z.number().int(),
    round: z.number().int(),
    forfeit: z.boolean(),
  }),
});
export type LeagueMatchResponse = z.infer<typeof LeagueMatchResponseSchema>;

/** T-11-418b 운영 도구: 지금 리그 상태(GET /v1/admin/leagues/current). */
export const AdminLeagueSchema = z.strictObject({
  league: LeagueInfoSchema,
  phase: LeaguePhaseSchema,
  /** 운영 도구로 일정을 미뤘는가(league_seasons 행이 있다). */
  delayed: z.boolean(),
  /** 신청 수(취소 제외) · 배치된 팀 수 · 자격이 모자라 빠진 수 · 기권 처리된 수. */
  counts: z.strictObject({
    entries: z.number().int(),
    placed: z.number().int(),
    dropped: z.number().int(),
    forfeited: z.number().int(),
  }),
  drawnAt: IsoUtcSchema.nullable(),
  doneAt: IsoUtcSchema.nullable(),
  playedRounds: z.number().int(),
  /** 시각이 지났는데 아직 치르지 않은 경기 수(cron이 밀렸는지). */
  overdue: z.number().int(),
});
export type AdminLeague = z.infer<typeof AdminLeagueSchema>;

/** T-11-418b 운영 도구: 배치 전 일정 미루기(접수 마감 · 배치 · 모든 라운드를 days일 뒤로). */
export const AdminLeagueDelaySchema = z.strictObject({ days: z.number().int().min(1).max(7) });
export type AdminLeagueDelay = z.infer<typeof AdminLeagueDelaySchema>;
