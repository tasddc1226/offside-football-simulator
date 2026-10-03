import { z } from 'zod';
import {
  CareerIdParamSchema,
  CareerPosSchema,
  DetailPosSchema,
  PeakProfileSchema,
} from './careers.js';
import { PUBLIC_NAME_CHARS } from './content-filter.js';
import {
  ACH_CATEGORIES,
  FORMATION_IDS,
  LINEUP_SIZE,
  MANAGER_NAME_MAX,
  MANAGER_NAME_MIN,
  TEAM_NAME_MAX,
  TEAM_NAME_MIN,
} from './owner-team.js';
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

/** 감독 이름: 2~10자, 팀 이름과 같은 문자 규칙. */
export const ManagerNameSchema = z
  .string()
  .trim()
  .min(MANAGER_NAME_MIN)
  .max(MANAGER_NAME_MAX)
  .regex(PUBLIC_NAME_CHARS, '감독 이름에 쓸 수 없는 문자가 있습니다.');

/** 팀 시즌: 서비스 시즌 id, 0 = 프리시즌(첫 시즌 개막 전). */
export const TeamSeasonSchema = z.number().int().min(0);
/** `?season=` — 없으면 지금 시즌. */
export const TeamSeasonQuerySchema = z.coerce.number().int().min(0).max(999).optional();
/** 고를 수 있는 시즌(0 = 프리시즌). */
export const TeamSeasonOptionSchema = z.strictObject({ id: TeamSeasonSchema, name: z.string() });
export type TeamSeasonOption = z.infer<typeof TeamSeasonOptionSchema>;

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
  /** 최고 시점의 자리별 실력(T-10-092). 이 기능 전에 은퇴한 선수는 null — 최고 OVR × 적합도로 센다. */
  roles: PeakProfileSchema.shape.roles.nullable(),
  /** 최고 시점 대표 능력치 6개(선수 고르기 표시용). 이 기능 전에 은퇴한 선수는 null. */
  attrs: PeakProfileSchema.shape.attrs.nullable(),
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
  /** 그 자리에서의 실력(자리별 실력, 없으면 최고 OVR × 적합도). */
  rating: z.number().int(),
  fit: z.number(),
});
export type TeamSlot = z.infer<typeof TeamSlotSchema>;

/** 공격·중원·수비·골키퍼 힘(owner-team.ts lineStrength, 반올림) — 포메이션마다 무게가 다르다. */
export const TeamLinesSchema = z.strictObject({
  atk: z.number().int(),
  mid: z.number().int(),
  def: z.number().int(),
  gk: z.number().int(),
});
export type TeamLines = z.infer<typeof TeamLinesSchema>;

export const OwnerTeamSchema = z.strictObject({
  id: TeamIdSchema,
  season: TeamSeasonSchema,
  name: z.string(),
  manager: z.string(),
  formation: FormationIdSchema,
  slots: z.array(TeamSlotSchema).length(LINEUP_SIZE),
  ovr: z.number().int(),
  lines: TeamLinesSchema,
  /** 팀 레이팅(경기 결과로 오르내린다). */
  rating: z.number().int(),
  record: TeamRecordSchema,
  likes: count,
  views: count,
  createdAt: IsoUtcSchema,
  updatedAt: IsoUtcSchema,
});
export type OwnerTeam = z.infer<typeof OwnerTeamSchema>;

/**
 * 내 팀 화면. season은 보고 있는 시즌, current는 지금 고치고 겨루는 시즌(시즌 사이 휴식기면 null) — 지난 시즌 팀은
 * 보기만 한다. players는 그 시즌에 처음 올라와 은퇴한 내 선수(팀에 넣을 수 있는 선수)다.
 */
export const OwnerTeamResponseSchema = z.strictObject({
  season: TeamSeasonSchema,
  current: TeamSeasonSchema.nullable(),
  seasons: z.array(TeamSeasonOptionSchema),
  team: OwnerTeamSchema.nullable(),
  players: z.array(TeamPlayerSchema),
  /** 새 팀을 만들 때 채워 둘 감독 이름(가장 최근 팀의 감독). */
  lastManager: z.string().nullable(),
  /** 오늘(한국 시각) 남은 경기 수. */
  matchesLeft: z.number().int().min(0),
  matchesPerDay: z.number().int().min(1),
});
export type OwnerTeamResponse = z.infer<typeof OwnerTeamResponseSchema>;

/** 지금 시즌 팀 만들기·고치기(시즌마다 한 팀 — 있으면 고친다). slots는 포메이션 순서의 11자리. */
export const PutOwnerTeamBodySchema = z.strictObject({
  name: TeamNameSchema,
  manager: ManagerNameSchema,
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
  /** 감독 이름. */
  owner: z.string(),
  formation: FormationIdSchema,
  ovr: z.number().int(),
  rating: z.number().int(),
  record: TeamRecordSchema,
});
export type TeamOpponent = z.infer<typeof TeamOpponentSchema>;

export const TeamOpponentsResponseSchema = z.strictObject({ items: z.array(TeamOpponentSchema) });
export type TeamOpponentsResponse = z.infer<typeof TeamOpponentsResponseSchema>;

export const PlayTeamMatchBodySchema = z.strictObject({ opponentTeamId: TeamIdSchema });
export type PlayTeamMatchBody = z.infer<typeof PlayTeamMatchBodySchema>;

export const TeamMatchSideSchema = z.strictObject({
  teamId: z.string(),
  name: z.string(),
  owner: z.string(),
  formation: FormationIdSchema,
  ovr: z.number().int(),
  goals: z.number().int().min(0),
  /** 이 경기로 바뀐 그 팀 레이팅(T-10-095 전에 치른 경기는 기록이 없어 null). */
  ratingChange: z.number().int().nullable(),
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
  rating: z.number().int(),
  matchesLeft: z.number().int().min(0),
});
export type PlayTeamMatchResponse = z.infer<typeof PlayTeamMatchResponseSchema>;

export const TeamMatchesResponseSchema = z.strictObject({ items: z.array(TeamMatchSchema) });
export type TeamMatchesResponse = z.infer<typeof TeamMatchesResponseSchema>;

// ───────── 구단 시즌 업적(클럽하우스) ─────────

/**
 * 업적 한 줄. done은 달성 여부. 모으기·단계 업적은 cur/max(지금 값·목표)를, 단계 업적은 level(지금 단계, 0부터)과
 * next(다음 단계 목표, 끝까지 왔으면 null)를 함께 준다.
 */
export const ClubAchievementSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
  cur: z.number().int().min(0).optional(),
  max: z.number().int().min(1).optional(),
  level: z.number().int().min(0).optional(),
  next: z.number().int().nullable().optional(),
  /** 단계 업적 숫자 뒤에 붙는 단위('골'·'경기' …). */
  unit: z.string().optional(),
  /** T-11-028 지금까지 얻은 점수(단계 업적은 넘은 단계의 점수 합). */
  points: count,
  /** 다음에 달성하면 더 얻는 점수(끝까지 왔으면 0). */
  worth: count,
});
export type ClubAchievement = z.infer<typeof ClubAchievementSchema>;

export const AchCategorySchema = z.enum(ACH_CATEGORIES);

export const ClubAchievementGroupSchema = z.strictObject({
  id: z.string(),
  /** T-11-028 분류(선수·팀·구단주·감독). */
  category: AchCategorySchema,
  /** 단계 표시('0단계' · 'TEAM'). */
  stage: z.string(),
  title: z.string(),
  items: z.array(ClubAchievementSchema),
  /** 아직 공개하지 않은 단계(원작처럼 잠금으로 예고만 한다 — items는 비어 있다). */
  locked: z.boolean().optional(),
});
export type ClubAchievementGroup = z.infer<typeof ClubAchievementGroupSchema>;

export const ClubAchievementsResponseSchema = z.strictObject({
  season: TeamSeasonSchema,
  seasons: z.array(TeamSeasonOptionSchema),
  /** 이 시즌에 처음 올라와 은퇴한 내 선수 수. */
  players: z.number().int().min(0),
  groups: z.array(ClubAchievementGroupSchema),
  /** T-11-028 이 시즌 업적 점수(등급은 contracts owner-team achGradeOf). */
  score: count,
  /** 업적 랭킹 순위(점수가 0이면 null)와 랭킹에 오른 구단주 수. */
  rank: z.number().int().min(1).nullable(),
  ranked: count,
});
export type ClubAchievementsResponse = z.infer<typeof ClubAchievementsResponseSchema>;

// ───────── 라이브 랭킹(팀 랭킹) · 팀 프로필 ─────────

export const TeamRankSortSchema = z.enum(['rating', 'ovr']);
export type TeamRankSort = z.infer<typeof TeamRankSortSchema>;

export const TeamRankQuerySchema = z.strictObject({
  season: TeamSeasonQuerySchema,
  sort: TeamRankSortSchema.default('rating'),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

/** 랭킹 한 줄. 선수가 한 명 이상 있는 팀만 오른다. */
export const TeamRankItemSchema = z.strictObject({
  rank: z.number().int().min(1),
  teamId: TeamIdSchema,
  name: z.string(),
  manager: z.string(),
  formation: FormationIdSchema,
  ovr: z.number().int(),
  rating: z.number().int(),
  record: TeamRecordSchema,
  likes: count,
  createdAt: IsoUtcSchema,
  /** 최근 경기부터, 홈·원정을 합친 최대 5경기. 이전 API 응답에는 없을 수 있다. */
  recentForm: z
    .array(z.enum(['W', 'D', 'L']))
    .max(5)
    .default([]),
});
export type TeamRankItem = z.infer<typeof TeamRankItemSchema>;

export const TeamRankResponseSchema = z.strictObject({
  season: TeamSeasonSchema,
  seasons: z.array(TeamSeasonOptionSchema),
  sort: TeamRankSortSchema,
  page: z.number().int().min(1),
  total: count,
  items: z.array(TeamRankItemSchema),
});
export type TeamRankResponse = z.infer<typeof TeamRankResponseSchema>;

// ───────── T-11-028 업적 랭킹(기록실) ─────────

export const AchRankQuerySchema = z.strictObject({
  season: TeamSeasonQuerySchema,
  page: z.coerce.number().int().min(1).max(500).default(1),
});

/** 업적 랭킹 한 줄. 구단주는 공개 닉네임(없으면 null)과 그 시즌 팀 이름으로만 보인다. */
export const AchRankItemSchema = z.strictObject({
  rank: z.number().int().min(1),
  nickname: z.string().nullable(),
  team: z.strictObject({ id: TeamIdSchema, name: z.string() }).nullable(),
  score: count,
  /** 달성한 업적 수. */
  done: count,
  /** 그 시즌 은퇴 선수 수. */
  players: count,
});
export type AchRankItem = z.infer<typeof AchRankItemSchema>;

export const AchRankResponseSchema = z.strictObject({
  season: TeamSeasonSchema,
  seasons: z.array(TeamSeasonOptionSchema),
  page: z.number().int().min(1),
  total: count,
  items: z.array(AchRankItemSchema),
});
export type AchRankResponse = z.infer<typeof AchRankResponseSchema>;

/** 팀 히스토리 배지(경기·시즌 순위로 얻는다). */
export const TeamBadgeSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  desc: z.string(),
});
export type TeamBadge = z.infer<typeof TeamBadgeSchema>;

/** 누구나 보는 팀 프로필. 선수 이름은 공개 이름·익명 표기뿐이다. rank는 랭킹에 오르지 않은 팀(선수 0명)이면 null. */
export const TeamProfileSchema = z.strictObject({
  id: TeamIdSchema,
  season: TeamSeasonSchema,
  seasonName: z.string(),
  rank: z.number().int().min(1).nullable(),
  name: z.string(),
  manager: z.string(),
  formation: FormationIdSchema,
  slots: z.array(TeamSlotSchema).length(LINEUP_SIZE),
  ovr: z.number().int(),
  lines: TeamLinesSchema,
  rating: z.number().int(),
  record: TeamRecordSchema,
  goals: z.strictObject({ for: count, against: count }),
  likes: count,
  views: count,
  badges: z.array(TeamBadgeSchema),
  createdAt: IsoUtcSchema,
});
export type TeamProfile = z.infer<typeof TeamProfileSchema>;

/** liked: 조회한 프로필이 좋아요를 눌렀는가. mine: 조회한 프로필의 팀인가(좋아요·조회수를 세지 않는다). */
export const TeamProfileResponseSchema = z.strictObject({
  team: TeamProfileSchema,
  liked: z.boolean(),
  mine: z.boolean(),
});
export type TeamProfileResponse = z.infer<typeof TeamProfileResponseSchema>;

export const TeamLikeResponseSchema = z.strictObject({ liked: z.boolean(), likes: count });
export type TeamLikeResponse = z.infer<typeof TeamLikeResponseSchema>;
