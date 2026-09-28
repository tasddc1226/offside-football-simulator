import { z } from 'zod';
import { CareerIdParamSchema, CareerPosSchema, DetailPosSchema } from './careers.js';
import { PUBLIC_NAME_CHARS } from './content-filter.js';
import { FORMATION_IDS, LINEUP_SIZE, TEAM_NAME_MAX, TEAM_NAME_MIN } from './owner-team.js';
import { IsoUtcSchema } from './primitives.js';

// T-10-092 구단주 팀(팀 슬롯). 값(포메이션·적합도)은 zod 없는 `./owner-team.ts`에 있다.

export const FormationIdSchema = z.enum(FORMATION_IDS);

/** 팀 이름: 2~12자, 제어 문자·꺾쇠 없이. 욕설·링크·운영자 사칭은 서버가 따로 거른다. */
export const TeamNameSchema = z
  .string()
  .trim()
  .min(TEAM_NAME_MIN)
  .max(TEAM_NAME_MAX)
  .regex(PUBLIC_NAME_CHARS, '팀 이름에 쓸 수 없는 문자가 있습니다.');

export const TeamIdSchema = z.string().regex(/^tem_[0-9a-f-]{36}$/, '팀 id 형식이 아닙니다.');

const count = z.number().int().min(0);
export const TeamRecordSchema = z.strictObject({ w: count, d: count, l: count });
export type TeamRecord = z.infer<typeof TeamRecordSchema>;

/** 팀에 넣을 수 있는 내 은퇴 선수. 서버에는 선수 이름이 없다 — 공개한 이름(publicName)만 있다. */
export const TeamPlayerSchema = z.strictObject({
  careerId: z.string(),
  pos: CareerPosSchema,
  /** 세부 포지션(T-10-091). 아직 모르면 null. */
  dpos: DetailPosSchema.nullable(),
  peak: z.number().int(),
  number: z.number().int().nullable(),
  publicName: z.string().nullable(),
  legendScore: z.number().int().nullable(),
});
export type TeamPlayer = z.infer<typeof TeamPlayerSchema>;

/** 선발 한 자리. careerId가 null이면 유스 선수가 채운 자리다. */
export const TeamSlotSchema = z.strictObject({
  slot: DetailPosSchema,
  careerId: z.string().nullable(),
  /** 표시 이름 — 공개 이름, 없으면 익명 표기, 유스 선수면 '유스 선수'. */
  name: z.string(),
  pos: CareerPosSchema.nullable(),
  /** 그 자리에서의 실력(최고 OVR × 적합도). */
  rating: z.number().int(),
  fit: z.number(),
});
export type TeamSlot = z.infer<typeof TeamSlotSchema>;

export const OwnerTeamSchema = z.strictObject({
  id: TeamIdSchema,
  name: z.string(),
  formation: FormationIdSchema,
  slots: z.array(TeamSlotSchema).length(LINEUP_SIZE),
  ovr: z.number().int(),
  record: TeamRecordSchema,
  createdAt: IsoUtcSchema,
  updatedAt: IsoUtcSchema,
});
export type OwnerTeam = z.infer<typeof OwnerTeamSchema>;

export const OwnerTeamResponseSchema = z.strictObject({
  teams: z.array(OwnerTeamSchema),
  /** 만들 수 있는 팀 수(TEAM_SLOTS). */
  slotsMax: z.number().int().min(1),
  players: z.array(TeamPlayerSchema),
  /** 오늘(한국 시각) 남은 경기 수. */
  matchesLeft: z.number().int().min(0),
  matchesPerDay: z.number().int().min(1),
});
export type OwnerTeamResponse = z.infer<typeof OwnerTeamResponseSchema>;

/** 팀 만들기·고치기. teamId가 없으면 새로 만든다(팀 슬롯이 남아 있을 때만). slots는 포메이션 순서의 11자리. */
export const PutOwnerTeamBodySchema = z.strictObject({
  teamId: TeamIdSchema.optional(),
  name: TeamNameSchema,
  formation: FormationIdSchema,
  slots: z.array(CareerIdParamSchema.nullable()).length(LINEUP_SIZE),
});
export type PutOwnerTeamBody = z.infer<typeof PutOwnerTeamBodySchema>;

export const PutOwnerTeamResponseSchema = z.strictObject({ team: OwnerTeamSchema });
export type PutOwnerTeamResponse = z.infer<typeof PutOwnerTeamResponseSchema>;

/** 경기 상대로 보이는 다른 구단주의 팀. */
export const TeamOpponentSchema = z.strictObject({
  teamId: TeamIdSchema,
  name: z.string(),
  /** 구단주 닉네임, 없으면 '익명 구단주'. */
  owner: z.string(),
  formation: FormationIdSchema,
  ovr: z.number().int(),
  record: TeamRecordSchema,
});
export type TeamOpponent = z.infer<typeof TeamOpponentSchema>;

export const TeamOpponentsResponseSchema = z.strictObject({ items: z.array(TeamOpponentSchema) });
export type TeamOpponentsResponse = z.infer<typeof TeamOpponentsResponseSchema>;

export const PlayTeamMatchBodySchema = z.strictObject({
  opponentTeamId: TeamIdSchema,
  /** 내 팀(팀이 여럿일 때). 없으면 첫 팀. */
  teamId: TeamIdSchema.optional(),
});
export type PlayTeamMatchBody = z.infer<typeof PlayTeamMatchBodySchema>;

export const TeamMatchSideSchema = z.strictObject({
  teamId: z.string(),
  name: z.string(),
  owner: z.string(),
  formation: FormationIdSchema,
  ovr: z.number().int(),
  goals: z.number().int().min(0),
});
export type TeamMatchSide = z.infer<typeof TeamMatchSideSchema>;

export const TeamMatchEventSchema = z.strictObject({
  minute: z.number().int().min(1).max(90),
  side: z.enum(['home', 'away']),
  scorer: z.string(),
  assist: z.string().nullable(),
  /** 조회한 구단주 쪽 선수의 커리어 id — 웹이 이 기기에 있는 (비공개) 이름으로 바꿔 보여 준다. 상대 쪽은 늘 null. */
  scorerId: z.string().nullable(),
  assistId: z.string().nullable(),
});
export type TeamMatchEvent = z.infer<typeof TeamMatchEventSchema>;

/** 한 경기. home은 경기를 건 팀이다. mine은 조회한 구단주 팀의 쪽. */
export const TeamMatchSchema = z.strictObject({
  id: z.string(),
  home: TeamMatchSideSchema,
  away: TeamMatchSideSchema,
  events: z.array(TeamMatchEventSchema),
  mine: z.enum(['home', 'away']),
  createdAt: IsoUtcSchema,
});
export type TeamMatch = z.infer<typeof TeamMatchSchema>;

export const PlayTeamMatchResponseSchema = z.strictObject({
  match: TeamMatchSchema,
  record: TeamRecordSchema,
  matchesLeft: z.number().int().min(0),
});
export type PlayTeamMatchResponse = z.infer<typeof PlayTeamMatchResponseSchema>;

export const TeamMatchesResponseSchema = z.strictObject({ items: z.array(TeamMatchSchema) });
export type TeamMatchesResponse = z.infer<typeof TeamMatchesResponseSchema>;
