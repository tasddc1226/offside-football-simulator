import { z } from 'zod';
import { FRIEND_CODE_RE } from './owner-team.js';
import { TeamIdSchema, TeamLogoSchema, TeamMatchSchema, TeamRecordSchema } from './teams.js';

// T-11-098 친구 · 친선전. 친구는 로그인한 구단주끼리 신청 → 수락으로 맺는다. 사람은 친구 코드로만 가리킨다(프로필 id를
// 밖에 내지 않는다). 친선전은 레이팅·전적·업적에 들어가지 않고 두 사람의 상대 전적만 남는다. 값은 `./owner-team.ts`.

export const FriendCodeSchema = z.string().regex(FRIEND_CODE_RE, '친구 코드 형식이 아니에요.');

/** 친구의 지금 시즌 팀(없으면 null). */
export const FriendTeamSchema = z.strictObject({
  id: TeamIdSchema,
  name: z.string(),
  logo: TeamLogoSchema.nullable().optional(),
  ovr: z.number().int(),
  /** 선발에 든 은퇴 선수 수(0이면 친선전을 걸 수 없다). */
  filled: z.number().int().min(0),
});
export type FriendTeam = z.infer<typeof FriendTeamSchema>;

/** 친구·신청 한 사람. name은 닉네임, 없으면 최근 팀 감독 이름, 그것도 없으면 '구단주'. */
export const FriendPersonSchema = z.strictObject({
  code: FriendCodeSchema,
  name: z.string(),
  team: FriendTeamSchema.nullable(),
  /** 친선전 상대 전적(내 쪽 기준). 신청 중이면 모두 0. */
  h2h: TeamRecordSchema,
});
export type FriendPerson = z.infer<typeof FriendPersonSchema>;

export const FriendsResponseSchema = z.strictObject({
  /** 내 친구 코드(초대 링크에 쓴다). */
  code: FriendCodeSchema,
  friends: z.array(FriendPersonSchema),
  received: z.array(FriendPersonSchema),
  sent: z.array(FriendPersonSchema),
  /** 내가 치른 최근 친선전(건 경기 + 받은 경기). */
  recent: z.array(TeamMatchSchema),
  /** 오늘(한국 시각) 남은 친선전 수 · 하루 친선전 수 · 친구 상한. */
  matchesLeft: z.number().int().min(0),
  matchesPerDay: z.number().int().min(1),
  max: z.number().int().min(1),
  /** 지금 시즌 내 팀이 경기할 수 있는가(팀이 있고 선수가 한 명 이상). 시즌 사이 휴식기면 false. */
  canPlay: z.boolean(),
});
export type FriendsResponse = z.infer<typeof FriendsResponseSchema>;

/** 친구 신청: 친구 코드 또는 팀 프로필의 팀 id 중 하나. */
export const FriendRequestBodySchema = z.union([
  z.strictObject({ code: z.string().trim().min(1).max(20) }),
  z.strictObject({ teamId: TeamIdSchema }),
]);
export type FriendRequestBody = z.infer<typeof FriendRequestBodySchema>;

/** 신청·수락 결과. 상대가 이미 나에게 신청했으면 신청이 곧 수락이라 accepted다. */
export const FriendRequestResponseSchema = z.strictObject({
  state: z.enum(['sent', 'accepted']),
  friend: FriendPersonSchema,
});
export type FriendRequestResponse = z.infer<typeof FriendRequestResponseSchema>;

export const PlayFriendlyResponseSchema = z.strictObject({
  match: TeamMatchSchema,
  h2h: TeamRecordSchema,
  matchesLeft: z.number().int().min(0),
});
export type PlayFriendlyResponse = z.infer<typeof PlayFriendlyResponseSchema>;

/** 거절·취소·친구 끊기. removed는 지운 관계가 있었는가(없었어도 200 — 다시 눌러도 같은 결과). */
export const FriendRemoveResponseSchema = z.strictObject({ removed: z.boolean() });
export type FriendRemoveResponse = z.infer<typeof FriendRemoveResponseSchema>;
