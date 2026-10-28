import { z } from 'zod';
import type { TeamSynergy } from './team-synergy.js';
import {
  CareerIdParamSchema,
  CareerPosSchema,
  DetailPosSchema,
  PeakProfileSchema,
} from './careers.js';
import { PUBLIC_NAME_CHARS } from './content-filter.js';
import { CUP_DIVISIONS, CUP_STAGES } from './cup.js';
import { isOwnerTitle } from './owner-title.js';
import {
  ACH_CATEGORIES,
  FORMATION_IDS,
  LINEUP_SIZE,
  TEAM_PRESET_MAX,
  TEAM_PRESET_NAME_MAX,
  MANAGER_NAME_MAX,
  MANAGER_NAME_MIN,
  positionRole,
  legacyPositionRole,
  TEAM_NAME_MAX,
  TEAM_NAME_MIN,
  TEAM_STATS_MATCHES_MAX,
} from './owner-team.js';
import { IsoUtcSchema } from './primitives.js';
import { TeamCoachSchema } from './manager.js';
import { TEAM_DIVISION_TOP } from './team-division.js';
import { TEAM_LOGO_IMG_MAX, TEAM_LOGO_PATTERNS, TEAM_LOGO_SHAPES } from './team-logo.js';

// T-10-092 구단주 팀(팀 슬롯). 값(포메이션·적합도)은 zod 없는 `./owner-team.ts`에 있다.

export const FormationIdSchema = z.enum(FORMATION_IDS);

export const TeamLogoSchema = z.strictObject({
  shape: z.enum(TEAM_LOGO_SHAPES),
  pattern: z.enum(TEAM_LOGO_PATTERNS),
  text: z
    .string()
    .trim()
    .max(3)
    .refine((text) => !text || PUBLIC_NAME_CHARS.test(text), '로고에 쓸 수 없는 글자예요.'),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  img: z
    .string()
    .max(TEAM_LOGO_IMG_MAX)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});

export const TeamLayoutSchema = z
  .array(
    z.strictObject({
      x: z.number().min(8).max(92),
      y: z.number().min(8).max(94),
      slot: DetailPosSchema,
    }),
  )
  .length(LINEUP_SIZE)
  .refine(
    (layout) =>
      layout[0]?.slot === 'GK' &&
      layout[0].y >= 84 &&
      layout
        .slice(1)
        .every(
          (p, i) =>
            p.y <= 82 &&
            (p.slot === positionRole(p.x, p.y, i + 1) ||
              p.slot === legacyPositionRole(p.x, p.y, i + 1)),
        ),
    '골키퍼는 첫 자리 하나이고 필드 선수는 골문 앞까지 배치할 수 있어요.',
  );

/** 팀 이름: 2~12자, 제어 문자·꺾쇠 없이. 욕설·링크·운영자 사칭은 서버가 따로 거른다. */
export const TeamNameSchema = z
  .string()
  .trim()
  .min(TEAM_NAME_MIN)
  .max(TEAM_NAME_MAX)
  .regex(PUBLIC_NAME_CHARS, '팀 이름에 쓸 수 없는 문자가 있어요.');

/** 감독 이름: 2~10자, 팀 이름과 같은 문자 규칙. */
export const ManagerNameSchema = z
  .string()
  .trim()
  .min(MANAGER_NAME_MIN)
  .max(MANAGER_NAME_MAX)
  .regex(PUBLIC_NAME_CHARS, '감독 이름에 쓸 수 없는 문자가 있어요.');

/** 팀 시즌: 서비스 시즌 id, 0 = 프리시즌(첫 시즌 개막 전). */
export const TeamSeasonSchema = z.number().int().min(0);
/** T-11-375 디비전 index(0 아마추어 ~ 7 마스터). */
export const TeamDivisionSchema = z.number().int().min(0).max(TEAM_DIVISION_TOP);
/** `?season=` — 없으면 지금 시즌. */
export const TeamSeasonQuerySchema = z.coerce.number().int().min(0).max(999).optional();
/** 고를 수 있는 시즌(0 = 프리시즌). */
export const TeamSeasonOptionSchema = z.strictObject({ id: TeamSeasonSchema, name: z.string() });
export type TeamSeasonOption = z.infer<typeof TeamSeasonOptionSchema>;

/** T-11-150 구단주 대표 칭호 id('cup-1-champion', owner-title.ts). 칭호가 없으면 null, 배포 전 응답엔 없다. */
export const OwnerTitleSchema = z.string().refine(isOwnerTitle);
const titleField = OwnerTitleSchema.nullable().optional();

export const TeamIdSchema = z.string().regex(/^tem_[0-9a-f-]{36}$/, '팀 id 형식이 아니에요.');

const count = z.number().int().min(0);
export const TeamRecordSchema = z.strictObject({ w: count, d: count, l: count });
export type TeamRecord = z.infer<typeof TeamRecordSchema>;

/** 팀에 넣을 수 있는 내 은퇴 선수. 서버에는 선수 이름이 없다 — 공개한 이름(publicName)만 있다. */
export const TeamPlayerSchema = z.strictObject({
  careerId: z.string(),
  /** 은퇴 때 굳은 꾸미기 코드. 옛 응답은 커리어 ID로 기본 얼굴을 그린다. */
  look: z.string().nullable().optional(),
  pos: CareerPosSchema,
  /** 선수 국적. 옛 응답의 null/누락은 기본 국적(대한민국)으로 읽는다. */
  nation: z.string().nullable().optional(),
  /** 세부 포지션(T-10-091). 아직 모르면 null. */
  dpos: DetailPosSchema.nullable(),
  peak: z.number().int(),
  /** 최고 시점의 자리별 실력(T-10-092). 이 기능 전에 은퇴한 선수는 null — 최고 OVR × 적합도로 센다. */
  roles: PeakProfileSchema.shape.roles.nullable(),
  /** 카드 표시용 대표 능력치 6개. 원본을 우선하고, 옛 기록은 attrsEstimated인 추정치 또는 null. */
  attrs: PeakProfileSchema.shape.attrs.nullable(),
  /** 원본이 없는 옛 선수의 카드 표시용 추정치. 구버전 응답에는 없다. 경기 계산에는 쓰지 않는다. */
  attrsEstimated: z.boolean().optional(),
  number: z.number().int().nullable(),
  publicName: z.string().nullable(),
  legendScore: z.number().int().nullable(),
  /** T-11-080 카드 기준가(만 원). 스냅샷이 없는 옛 기록·소급 전이면 null, 구버전 응답에는 없다. */
  cardValue: z.number().int().nullable().optional(),
  /** T-11-080 내가 직접 키운 선수(방출할 수 있다). 영입한 선수는 false. 구버전 응답에는 없다. */
  raised: z.boolean().optional(),
  /** T-11-105 시너지용 유형 id·주발. 구버전 응답에는 없다. */
  type: z.string().nullable().optional(),
  foot: z.string().nullable().optional(),
  /** T-11-467 시너지 '리그 컬러' · '클럽 동료'용 가장 오래 뛴 프로 리그 id · 클럽 id. 아직 모르면 없다. */
  mainLeague: z.string().nullable().optional(),
  mainClub: z.string().nullable().optional(),
  /** T-11-114 카드 시즌(0 = 프리시즌). 팀 시즌보다 앞이면 와일드카드다. 구버전 응답에는 없다. */
  season: z.number().int().nonnegative().optional(),
  /** T-11-180 키(cm)·몸무게(kg). 체격을 입력하지 않은 옛 커리어·구버전 응답에는 없다. */
  height: z.number().int().optional(),
  weight: z.number().int().optional(),
  /** T-11-188 구단주가 잠근 선수(이적시장에 내놓거나 방출할 수 없다). 구버전 응답에는 없다. */
  locked: z.boolean().optional(),
  /** T-11-080 판매 등록 중이면 그 등록. */
  listing: z.strictObject({ id: z.string(), price: z.number().int() }).nullable().optional(),
});
export type TeamPlayer = z.infer<typeof TeamPlayerSchema>;

/** 선발 한 자리. careerId가 null이면 유스 선수가 채운 자리다. */
export const TeamSlotSchema = z.strictObject({
  slot: DetailPosSchema,
  careerId: z.string().nullable(),
  /** 표시 이름 — 공개 이름, 없으면 익명 표기, 유스 선수면 '유스 선수'. */
  name: z.string(),
  pos: CareerPosSchema.nullable(),
  nation: z.string().nullable().optional(),
  /** T-11-114 카드 시즌(0 = 프리시즌). 구버전 응답·유스 선수 자리에는 없다. */
  season: z.number().int().nonnegative().optional(),
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

/** T-11-217 팀 프리셋 하나(포메이션 · 선발 · 배치만 — 이름 · 로고 · 감독은 팀 것을 쓴다). 이름은 나만 본다. */
export const TeamPresetSchema = z.strictObject({
  name: z.string().trim().min(1).max(TEAM_PRESET_NAME_MAX),
  formation: FormationIdSchema,
  slots: z.array(CareerIdParamSchema.nullable()).length(LINEUP_SIZE),
  layout: TeamLayoutSchema.nullable(),
});
export type TeamPreset = z.infer<typeof TeamPresetSchema>;
export const TeamPresetsSchema = z.array(TeamPresetSchema).max(TEAM_PRESET_MAX);

export const OwnerTeamSchema = z.strictObject({
  id: TeamIdSchema,
  season: TeamSeasonSchema,
  name: z.string(),
  manager: z.string(),
  logo: TeamLogoSchema.nullable().optional(),
  formation: FormationIdSchema,
  slots: z.array(TeamSlotSchema).length(LINEUP_SIZE),
  layout: TeamLayoutSchema.nullable().optional(),
  ovr: z.number().int(),
  lines: TeamLinesSchema,
  /** 팀 레이팅(경기 결과로 오르내린다). */
  rating: z.number().int(),
  /** T-11-375 디비전 index(0 아마추어 ~ 7 마스터, 강등 보호 포함). 배포 전 응답엔 없다. */
  division: TeamDivisionSchema.optional(),
  record: TeamRecordSchema,
  likes: count,
  views: count,
  /** T-11-217 내 팀 프리셋(최대 5개). 배포 전 응답엔 없다. */
  presets: TeamPresetsSchema.optional(),
  /** T-11-310 감독 칸(끝낸 감독 카드). 비었으면 null, 배포 전 응답엔 없다. */
  coach: TeamCoachSchema.nullable().optional(),
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
  /**
   * T-11-552 끝나지 않은 컵에 참가 중인 지난 시즌(시즌 1 제3회 컵). 그 시즌 팀은 컵이 끝날 때까지 고친다. 옛 응답에는 없다.
   */
  cupSeason: TeamSeasonSchema.nullable().optional(),
  seasons: z.array(TeamSeasonOptionSchema),
  team: OwnerTeamSchema.nullable(),
  players: z.array(TeamPlayerSchema),
  /** 새 팀을 만들 때 채워 둘 감독 이름(가장 최근 팀의 감독). */
  lastManager: z.string().nullable(),
  /** 오늘(한국 시각) 남은 경기 수. */
  matchesLeft: z.number().int().min(0),
  matchesPerDay: z.number().int().min(1),
  /** T-11-376 지난 시즌 선수 급여 예산(운영 도구 밸런스 활성 값). 배포 전 응답엔 없다 — 화면은 PAST_SALARY_BUDGET을 쓴다. */
  pastSalaryBudget: z.number().int().min(0).optional(),
  /** T-11-113 창단 멤버(프리시즌에 은퇴 선수를 남긴 구단주). 배포 전 응답엔 없다. */
  founder: z.boolean().optional(),
  /** T-11-512 클럽 멤버십 서포터(구독 중). 배포 전 응답엔 없다. */
  member: z.boolean().optional(),
  /** T-11-150 내 대표 칭호(구단주 탭 닉네임 옆). 달지 않았으면 null, 배포 전 응답엔 없다. */
  ownerTitle: titleField,
});
export type OwnerTeamResponse = z.infer<typeof OwnerTeamResponseSchema>;

/**
 * 지금 시즌 팀 만들기·고치기(시즌마다 한 팀 — 있으면 고친다). slots는 포메이션 순서의 11자리. season을 0으로 보내면
 * 프리시즌 팀을 고친다(T-11-113 — 개막 뒤엔 친선전 전용). 없으면 지금 시즌.
 */
export const PutOwnerTeamBodySchema = z.strictObject({
  season: TeamSeasonSchema.optional(),
  name: TeamNameSchema,
  manager: ManagerNameSchema,
  logo: TeamLogoSchema.nullable().optional(),
  formation: FormationIdSchema,
  slots: z.array(CareerIdParamSchema.nullable()).length(LINEUP_SIZE),
  layout: TeamLayoutSchema.nullable().optional(),
  /** T-11-310 감독 칸에 넣을 감독 카드(careerId). null이면 비운다, 보내지 않으면 그대로 둔다. */
  coach: CareerIdParamSchema.nullable().optional(),
});
export type PutOwnerTeamBody = z.infer<typeof PutOwnerTeamBodySchema>;

export const PutOwnerTeamResponseSchema = z.strictObject({ team: OwnerTeamSchema });
export type PutOwnerTeamResponse = z.infer<typeof PutOwnerTeamResponseSchema>;

/** T-11-310 지금 시즌 팀의 감독 칸만 바꾼다(null이면 비운다). 감독 화면에서 쓴다. */
export const PutTeamCoachBodySchema = z.strictObject({ coach: CareerIdParamSchema.nullable() });
export type PutTeamCoachBody = z.infer<typeof PutTeamCoachBodySchema>;
export const PutTeamCoachResponseSchema = z.strictObject({ coach: TeamCoachSchema.nullable() });
export type PutTeamCoachResponse = z.infer<typeof PutTeamCoachResponseSchema>;

/** T-11-217 프리셋 목록 통째 교체(저장 · 덮어쓰기 · 이름 바꾸기 · 삭제 모두). 팀을 한 번 저장한 뒤에만. */
export const PutTeamPresetsBodySchema = z.strictObject({
  season: TeamSeasonSchema.optional(),
  presets: TeamPresetsSchema,
});
export type PutTeamPresetsBody = z.infer<typeof PutTeamPresetsBodySchema>;
export const PutTeamPresetsResponseSchema = z.strictObject({ presets: TeamPresetsSchema });
export type PutTeamPresetsResponse = z.infer<typeof PutTeamPresetsResponseSchema>;

/** 경기 상대로 보이는 다른 구단주의 팀. */
export const TeamOpponentSchema = z.strictObject({
  teamId: TeamIdSchema,
  name: z.string(),
  logo: TeamLogoSchema.nullable().optional(),
  /** 감독 이름. */
  owner: z.string(),
  formation: FormationIdSchema,
  /** T-11-216 배치 프리셋 이름(4-2-3-1 등). 옛 앱은 formation만 읽는다. */
  shape: z.string().max(16).optional(),
  ovr: z.number().int(),
  rating: z.number().int(),
  record: TeamRecordSchema,
  /** T-11-150 구단주 대표 칭호. */
  title: titleField,
});
export type TeamOpponent = z.infer<typeof TeamOpponentSchema>;

export const TeamOpponentsResponseSchema = z.strictObject({ items: z.array(TeamOpponentSchema) });
export type TeamOpponentsResponse = z.infer<typeof TeamOpponentsResponseSchema>;

/** T-11-387 live: true면 문자중계 도중 장면을 고르는 경기로 시작한다(옛 앱은 보내지 않아 한 번에 끝난다). */
export const PlayTeamMatchBodySchema = z.strictObject({
  opponentTeamId: TeamIdSchema,
  live: z.boolean().optional(),
});
export type PlayTeamMatchBody = z.infer<typeof PlayTeamMatchBodySchema>;

export const TeamMatchSideSchema = z.strictObject({
  teamId: z.string(),
  name: z.string(),
  logo: TeamLogoSchema.nullable().optional(),
  owner: z.string(),
  formation: FormationIdSchema,
  ovr: z.number().int(),
  goals: z.number().int().min(0),
  /** 이 경기로 바뀐 그 팀 레이팅(T-10-095 전에 치른 경기는 기록이 없어 null). */
  ratingChange: z.number().int().nullable(),
  /** T-11-379 기대 득점(소수 한 자리). 이 기능 전에 치른 경기에는 없다. */
  xg: z.number().min(0).optional(),
  /** T-11-379 그 경기 줄 힘(시너지 · 감독 보정 뒤, 반올림). 이 기능 전에 치른 경기에는 없다. */
  lines: TeamLinesSchema.optional(),
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
  /** T-11-387 득점자 자리. 이 기능 전에 치른 경기에는 없다. */
  slot: DetailPosSchema.optional(),
});
export type TeamMatchEvent = z.infer<typeof TeamMatchEventSchema>;

// ───────── 장면 경기(T-11-387) ─────────
// 장면 · 선택지 id와 규칙은 `@offside/contracts/team-moments`. 확률은 서버가 그 선수로 계산한 정수 %다(찬스는 골, 위기는 막을 확률).

export const TeamMomentChoiceSchema = z.strictObject({
  id: z.string().max(32),
  pct: z.number().int().min(0).max(100),
  /** 동료가 마무리한다. */
  mate: z.boolean(),
  /** 실패하면 상대 역습 골 확률(%). */
  risk: z.number().int().min(0).max(100),
  /** 막아 내면 우리 역습 골 확률(%). */
  gain: z.number().int().min(0).max(100),
});
export type TeamMomentChoice = z.infer<typeof TeamMomentChoiceSchema>;

/** 장면 한 사람. id는 조회한 구단주 쪽 선수의 커리어 id(웹 · 앱이 기기 안 이름으로 바꾼다). */
export const TeamMomentActorSchema = z.strictObject({
  name: z.string(),
  id: z.string().nullable(),
  slot: DetailPosSchema,
});
export type TeamMomentActor = z.infer<typeof TeamMomentActorSchema>;

export const TeamMomentSchema = z.strictObject({
  index: z.number().int().min(0),
  minute: z.number().int().min(1).max(90),
  kind: z.enum(['chance', 'crisis']),
  situation: z.string().max(32),
  actor: TeamMomentActorSchema,
  mate: TeamMomentActorSchema,
  opp: TeamMomentActorSchema,
  choices: z.array(TeamMomentChoiceSchema).min(1).max(3),
  /** 판정한 장면이면 고른 선택지('auto' = 자동 선택)와 결과. */
  picked: z.string().max(32).optional(),
  ok: z.boolean().optional(),
});
export type TeamMoment = z.infer<typeof TeamMomentSchema>;

/** 진행 중인 장면 경기. moments는 아직 고르지 않은 장면이다. choiceSec 안에 안 고르면 자동 선택한다. */
export const TeamLiveSchema = z.strictObject({
  moments: z.array(TeamMomentSchema),
  choiceSec: z.number().int().min(1),
});
export type TeamLive = z.infer<typeof TeamLiveSchema>;

export const TeamMomentBodySchema = z.strictObject({ choice: z.string().min(1).max(32) });
export type TeamMomentBody = z.infer<typeof TeamMomentBodySchema>;

/** 한 경기. home은 경기를 건 팀이다. mine은 조회한 구단주 팀의 쪽. */
export const TeamMatchSchema = z.strictObject({
  id: z.string(),
  home: TeamMatchSideSchema,
  away: TeamMatchSideSchema,
  events: z.array(TeamMatchEventSchema),
  mine: z.enum(['home', 'away']),
  /** T-11-098 친구와 치른 친선전(레이팅·전적에 들어가지 않는다). 랭크 경기와 구버전 응답에는 없다. */
  friendly: z.boolean().optional(),
  /** T-11-387 화면에서 고른 장면과 결과(장면 경기만). */
  moments: z.array(TeamMomentSchema).optional(),
  createdAt: IsoUtcSchema,
});
export type TeamMatch = z.infer<typeof TeamMatchSchema>;

export const PlayTeamMatchResponseSchema = z.strictObject({
  match: TeamMatchSchema,
  record: TeamRecordSchema,
  rating: z.number().int(),
  /** T-11-375 이 경기 전후 내 디비전(같으면 승강 없음). 배포 전 응답엔 없다. */
  division: z.strictObject({ from: TeamDivisionSchema, to: TeamDivisionSchema }).optional(),
  matchesLeft: z.number().int().min(0),
  /**
   * T-11-387 장면 경기를 시작했으면 고를 장면들. 이때 match는 장면을 뺀 지금까지의 골만 담고, record · rating은 경기 전
   * 값이다. 마지막 장면을 고르거나 마감하면 TeamMomentResponse.final로 결과가 온다.
   */
  live: TeamLiveSchema.optional(),
});
export type PlayTeamMatchResponse = z.infer<typeof PlayTeamMatchResponseSchema>;

/** 장면 하나를 고른 결과. goals는 이 장면에서 난 골, final은 경기가 끝났을 때의 경기 결과다. */
export const TeamMomentResponseSchema = z.strictObject({
  moment: TeamMomentSchema,
  goals: z.array(TeamMatchEventSchema),
  final: PlayTeamMatchResponseSchema.optional(),
});
export type TeamMomentResponse = z.infer<typeof TeamMomentResponseSchema>;

/** T-11-269 경기 기록 다음 쪽 커서(`<createdAt>_<경기 id>`). 첫 쪽에는 붙이지 않는다. */
export const TeamMatchCursorSchema = z
  .string()
  .max(96)
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z_[\w-]{1,64}$/);
/** 첫 쪽(커서 없음)과 다음 쪽 크기. */
export const TEAM_MATCHES_FIRST_PAGE = 10;
export const TEAM_MATCHES_PAGE = 20;

/** next는 다음 쪽 커서(더 없으면 null). T-11-269 전 응답에는 없다. */
export const TeamMatchesResponseSchema = z.strictObject({
  items: z.array(TeamMatchSchema),
  next: TeamMatchCursorSchema.nullable().optional(),
});
export type TeamMatchesResponse = z.infer<typeof TeamMatchesResponseSchema>;

// ───────── 시즌 통계(T-11-269) ─────────

export { TEAM_STATS_MATCHES_MAX };
/** 상대별 전적에 보여 줄 팀 수. */
export const TEAM_STATS_OPPONENTS_MAX = 30;
/** T-11-358 최근 흐름에 보여 줄 경기 수. */
export const TEAM_STATS_FORM_MAX = 10;

const winDrawLoss = {
  w: z.number().int().min(0),
  d: z.number().int().min(0),
  l: z.number().int().min(0),
  gf: z.number().int().min(0),
  ga: z.number().int().min(0),
};

/** 우리 팀 선수 한 명의 그 시즌 랭크 경기 출전 · 골 · 도움. careerId가 null이면 유스 선수(한 줄로 모은다). */
export const TeamStatsPlayerSchema = z.strictObject({
  careerId: z.string().nullable(),
  /** 지금 공개 이름, 없으면 익명 표기(웹 · 앱이 이 기기에 남은 이름으로 바꿔 보여 준다). */
  name: z.string(),
  goals: z.number().int().min(0),
  assists: z.number().int().min(0),
  /** T-11-518 선발로 뛴 경기 수(선발 명단이 남은 경기만, 유스 선수는 빈 자리가 있던 경기). 전 응답에는 없다. */
  apps: z.number().int().min(0).optional(),
  /** T-11-518 가장 많이 선 자리. 출전 기록이 없으면 없다. */
  pos: DetailPosSchema.optional(),
});
export type TeamStatsPlayer = z.infer<typeof TeamStatsPlayerSchema>;

/** 한국 시각 하루의 전적. */
export const TeamStatsDaySchema = z.strictObject({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ...winDrawLoss,
});
export type TeamStatsDay = z.infer<typeof TeamStatsDaySchema>;

/** 한 상대와의 전적. 이름 · 구단주는 가장 최근 경기 때 이름, 로고는 지금 로고다. */
export const TeamStatsOpponentSchema = z.strictObject({
  teamId: z.string(),
  name: z.string(),
  owner: z.string(),
  logo: TeamLogoSchema.nullable(),
  ...winDrawLoss,
});
export type TeamStatsOpponent = z.infer<typeof TeamStatsOpponentSchema>;

/** T-11-358 최근 흐름 한 칸(최신이 앞). */
export const TeamFormSchema = z.enum(['w', 'd', 'l']);
export type TeamForm = z.infer<typeof TeamFormSchema>;

/** T-11-358 가장 큰 승리 · 패배 한 경기. 상대 이름은 그 경기 때 이름이다. */
export const TeamStatsMatchSchema = z.strictObject({
  opponent: z.string(),
  gf: z.number().int().min(0),
  ga: z.number().int().min(0),
  at: z.string(),
});
export type TeamStatsMatch = z.infer<typeof TeamStatsMatchSchema>;

/** T-11-358 경기 흐름 요약. 랭크 경기(센 범위 안)에서 센다. */
export const TeamStatsSummarySchema = z.strictObject({
  /** 최근 TEAM_STATS_FORM_MAX경기 결과(최신이 앞). */
  form: z.array(TeamFormSchema).max(TEAM_STATS_FORM_MAX),
  /** 지금 이어지는 결과와 경기 수(경기가 없으면 null). */
  streak: z.strictObject({ kind: TeamFormSchema, n: z.number().int().min(1) }).nullable(),
  /** 가장 길게 이어 이긴 경기 수. */
  bestWinStreak: z.number().int().min(0),
  /** 건 경기(홈) · 받은 경기(원정) 전적. */
  home: z.strictObject(winDrawLoss),
  away: z.strictObject(winDrawLoss),
  biggestWin: TeamStatsMatchSchema.nullable(),
  biggestLoss: TeamStatsMatchSchema.nullable(),
  /** 친선전 · 컵 경기 전적(랭크 경기는 total). 컵 승부차기는 이긴 쪽 승리, 기권 경기는 세지 않는다. */
  friendly: z.strictObject(winDrawLoss),
  cup: z.strictObject(winDrawLoss),
});
export type TeamStatsSummary = z.infer<typeof TeamStatsSummarySchema>;

/** T-11-379 줄 비교 세 가지(공격 대 상대 수비벽 · 중원 대 상대 중원 · 내 수비벽 대 상대 공격). */
export const TeamReportLineSchema = z.enum(['atk', 'mid', 'def']);
export type TeamReportLine = z.infer<typeof TeamReportLineSchema>;
const lineEdges = z.strictObject({ atk: z.number(), mid: z.number(), def: z.number() });

/** T-11-379 포메이션 하나의 전적과 기대 득점 합. */
export const TeamReportFormationSchema = z.strictObject({
  formation: FormationIdSchema,
  ...winDrawLoss,
  xgFor: z.number().min(0),
  xgAgainst: z.number().min(0),
});
export type TeamReportFormation = z.infer<typeof TeamReportFormationSchema>;

/** T-11-379 경기 리포트(기대 득점이 남은 랭크 경기만 센다). */
export const TeamStatsReportSchema = z.strictObject({
  /** 기대 득점이 남은 경기 수. 0이면 화면이 리포트를 그리지 않는다. */
  matches: z.number().int().min(0),
  /** 기대 득점 · 기대 실점 합(소수 한 자리)과 그 경기들의 실제 득실. */
  xgFor: z.number().min(0),
  xgAgainst: z.number().min(0),
  gf: z.number().int().min(0),
  ga: z.number().int().min(0),
  /** 줄 비교 평균(내 쪽 − 상대 쪽, 소수 한 자리). */
  edges: lineEdges,
  /** 줄마다 상대보다 약했던 경기 수. */
  behind: z.strictObject({
    atk: z.number().int().min(0),
    mid: z.number().int().min(0),
    def: z.number().int().min(0),
  }),
  formations: z.array(TeamReportFormationSchema),
});
export type TeamStatsReport = z.infer<typeof TeamStatsReportSchema>;

/** 내 팀(그 시즌)의 랭크 경기 통계. T-11-358부터 summary에 친선전 · 컵 전적과 흐름 요약을 함께 준다. */
export const TeamStatsResponseSchema = z.strictObject({
  season: z.number().int().min(0),
  /** 센 경기 수. capped면 최근 TEAM_STATS_MATCHES_MAX경기씩만 셌다. */
  matches: z.number().int().min(0),
  capped: z.boolean(),
  total: z.strictObject(winDrawLoss),
  players: z.array(TeamStatsPlayerSchema),
  /** T-11-518 센 경기 중 선발 명단이 남은 경기 수(출전 수를 센 경기). 전 응답에는 없다. */
  xiMatches: z.number().int().min(0).optional(),
  days: z.array(TeamStatsDaySchema),
  opponents: z.array(TeamStatsOpponentSchema),
  /** T-11-358 전 응답에는 없다. */
  summary: TeamStatsSummarySchema.optional(),
  /** T-11-379 전 응답에는 없다. */
  report: TeamStatsReportSchema.optional(),
});
export type TeamStatsResponse = z.infer<typeof TeamStatsResponseSchema>;

// ───────── 구단 시즌 업적(클럽하우스) ─────────

/**
 * 업적 한 줄. done은 달성 여부. 모으기·단계 업적은 cur/max(지금 값·목표)를, 단계 업적은 level(지금 단계, 0부터)과
 * next(다음 단계 목표, 끝까지 왔으면 null)를 함께 준다.
 */
export const ClubAchievementSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  /** T-11-237 판정 기준 한 줄(이름만으로 헷갈리는 업적만). 구버전 응답에는 없다. */
  desc: z.string().optional(),
  done: z.boolean(),
  cur: z.number().int().min(0).optional(),
  max: z.number().int().min(1).optional(),
  /** T-11-180 모음 업적에서 아직 못 모은 이름(리그 · 상 · 대회, 저장값 한국어 — 그릴 때 tn()). */
  missing: z.array(z.string()).optional(),
  level: z.number().int().min(0).optional(),
  next: z.number().int().nullable().optional(),
  /** 단계 업적 숫자 뒤에 붙는 단위('골'·'경기' …). */
  unit: z.string().optional(),
  /** T-11-028 지금까지 얻은 점수(단계 업적은 넘은 단계의 점수 합). */
  points: count,
  /** 다음에 달성하면 더 얻는 점수(끝까지 왔으면 0). */
  worth: count,
  /** T-11-357 다음에 달성하면 받는 아이템(지금 시즌만, 없으면 생략). */
  reward: z.strictObject({ boost: count, scout: count }).optional(),
  /** T-11-357 이 시즌에 이 업적으로 받은 아이템(지금 시즌만, 없으면 생략). */
  got: z.strictObject({ boost: count, scout: count }).optional(),
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

export const ClubAchievementNotificationsSchema = ClubAchievementsResponseSchema.pick({
  season: true,
  groups: true,
  score: true,
}).extend({
  /** T-11-489 상위 비율 등급 시즌(achTierByRank)에만 싣는 순위 · 랭킹 인원. */
  rank: ClubAchievementsResponseSchema.shape.rank.optional(),
  ranked: count.optional(),
});
export type ClubAchievementNotifications = z.infer<typeof ClubAchievementNotificationsSchema>;

// ───────── 라이브 랭킹(팀 랭킹) · 팀 프로필 ─────────

/** value: 구단 가치(선발 11명 카드 기준가 합, T-11-129). */
export const TeamRankSortSchema = z.enum(['rating', 'ovr', 'value']);
export type TeamRankSort = z.infer<typeof TeamRankSortSchema>;

export const TeamRankQuerySchema = z.strictObject({
  season: TeamSeasonQuerySchema,
  sort: TeamRankSortSchema.default('rating'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  /** T-11-375 디비전 탭(레이팅순만). 그 디비전의 레이팅 구간 팀만 고른다. */
  division: z.coerce.number().int().min(0).max(TEAM_DIVISION_TOP).optional(),
  /** T-11-441 '내 순위로': 내 팀이 있는 페이지를 돌려주고 me를 붙인다(세션을 보고 엣지 캐시에 담지 않는다). */
  me: z.literal('1').optional(),
});

/** 랭킹 한 줄. 선수가 한 명 이상 있는 팀만 오른다. */
export const TeamRankItemSchema = z.strictObject({
  rank: z.number().int().min(1),
  teamId: TeamIdSchema,
  name: z.string(),
  logo: TeamLogoSchema.nullable().optional(),
  manager: z.string(),
  formation: FormationIdSchema,
  ovr: z.number().int(),
  rating: z.number().int(),
  /** T-11-375 저장된 디비전(강등 보호 포함). 이전 API 응답에는 없을 수 있다. */
  division: TeamDivisionSchema.optional(),
  record: TeamRecordSchema,
  likes: count,
  /** 구단 가치 = 선발 11명 카드 기준가 합(만 원, T-11-129). 이전 API 응답에는 없을 수 있다. */
  value: count.default(0),
  createdAt: IsoUtcSchema,
  /** 최근 경기부터, 홈·원정을 합친 최대 5경기. 이전 API 응답에는 없을 수 있다. */
  recentForm: z
    .array(z.enum(['W', 'D', 'L']))
    .max(5)
    .default([]),
  /** T-11-150 구단주 대표 칭호. */
  title: titleField,
});
export type TeamRankItem = z.infer<typeof TeamRankItemSchema>;

export const TeamRankResponseSchema = z.strictObject({
  season: TeamSeasonSchema,
  seasons: z.array(TeamSeasonOptionSchema),
  sort: TeamRankSortSchema,
  page: z.number().int().min(1),
  total: count,
  items: z.array(TeamRankItemSchema),
  /** T-11-441 me=1로 물었을 때만. 그 시즌 랭킹에 내 팀이 없으면 null. */
  me: z
    .strictObject({ teamId: TeamIdSchema, rank: z.number().int().min(1) })
    .nullable()
    .optional(),
});
export type TeamRankResponse = z.infer<typeof TeamRankResponseSchema>;

export const TeamDivisionsQuerySchema = z.strictObject({ season: TeamSeasonQuerySchema });

/** T-11-375 디비전별 팀 수(랭킹에 오른 팀, 레이팅 구간 기준) · 지금 경계. 모두에게 같아 5분 엣지 캐시. */
export const TeamDivisionsResponseSchema = z.strictObject({
  season: TeamSeasonSchema,
  bounds: z.array(z.number().int()).length(TEAM_DIVISION_TOP),
  guard: z.number().int().min(0),
  counts: z.array(count).length(TEAM_DIVISION_TOP + 1),
  total: count,
});
export type TeamDivisionsResponse = z.infer<typeof TeamDivisionsResponseSchema>;

// ───────── T-11-028 업적 랭킹(기록실) ─────────

export const AchRankQuerySchema = z.strictObject({
  season: TeamSeasonQuerySchema,
  page: z.coerce.number().int().min(1).max(500).default(1),
  /** T-11-441 '내 순위로'(팀 랭킹과 같다). */
  me: z.literal('1').optional(),
});

/** 업적 랭킹 한 줄. 구단주는 공개 닉네임(없으면 null)과 그 시즌 팀 이름으로만 보인다. */
export const AchRankItemSchema = z.strictObject({
  rank: z.number().int().min(1),
  nickname: z.string().nullable(),
  team: z
    .strictObject({
      id: TeamIdSchema,
      name: z.string(),
      logo: TeamLogoSchema.nullable().optional(),
    })
    .nullable(),
  score: count,
  /** 달성한 업적 수. */
  done: count,
  /** 그 시즌 은퇴 선수 수. */
  players: count,
  /** T-11-150 구단주 대표 칭호. */
  title: titleField,
});
export type AchRankItem = z.infer<typeof AchRankItemSchema>;

export const AchRankResponseSchema = z.strictObject({
  season: TeamSeasonSchema,
  seasons: z.array(TeamSeasonOptionSchema),
  page: z.number().int().min(1),
  total: count,
  items: z.array(AchRankItemSchema),
  /** T-11-441 me=1로 물었을 때만. 그 시즌 랭킹에 내가 없으면 null. */
  me: z
    .strictObject({ rank: z.number().int().min(1) })
    .nullable()
    .optional(),
});
export type AchRankResponse = z.infer<typeof AchRankResponseSchema>;

/** 팀 히스토리 배지(경기·시즌 순위로 얻는다). */
export const TeamBadgeSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  desc: z.string(),
});
export type TeamBadge = z.infer<typeof TeamBadgeSchema>;

/** T-11-145 구단주가 얻은 오프사이드 컵 성적(영구 — 우승·준우승·4강은 트로피·칭호). stage는 cup.ts CUP_STAGES. */
export const CupHonorSchema = z.strictObject({
  cupId: z.string(),
  season: z.number().int(),
  edition: z.number().int(),
  /** T-11-410 구간 대회 성적이면 그 구간. */
  division: z.enum(CUP_DIVISIONS).optional(),
  stage: z.enum(CUP_STAGES),
  teamName: z.string(),
  /** 트로피 받침대에 새기는 구단주 닉네임(지금 닉네임, 없으면 null). 배포 전 응답엔 없다. */
  owner: z.string().nullable().optional(),
});
export type CupHonor = z.infer<typeof CupHonorSchema>;

/** T-11-290 팀 프로필에 싣는 선발 시너지(contracts team-synergy TeamSynergy와 같은 모양 — 서버가 경기 계산과 같은 입력으로 센다). */
const SynergyLinesSchema = z.strictObject({
  atk: z.number(),
  mid: z.number(),
  def: z.number(),
  gk: z.number(),
});
const TeamSynergyShape = z.strictObject({
  active: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      desc: z.string(),
      members: z.array(z.number().int().min(0)),
      effect: SynergyLinesSchema.partial(),
      kind: z.enum(['duo', 'team', 'badge', 'foot']),
      nation: z.string().optional(),
      style: z.string().optional(),
      league: z.string().optional(),
      club: z.string().optional(),
    }),
  ),
  foot: z.array(z.number()),
  lines: SynergyLinesSchema,
});
/** 모양은 위 스키마로 검사하고 타입은 contracts team-synergy의 TeamSynergy 그대로(exactOptionalPropertyTypes 때문에 z.infer를 쓰지 않는다). */
export const TeamSynergySchema = z.custom<TeamSynergy>(
  (v) => TeamSynergyShape.safeParse(v).success,
);

/** 누구나 보는 팀 프로필. 선수 이름은 공개 이름·익명 표기뿐이다. rank는 랭킹에 오르지 않은 팀(선수 0명)이면 null. */
export const TeamProfileSchema = z.strictObject({
  id: TeamIdSchema,
  season: TeamSeasonSchema,
  seasonName: z.string(),
  rank: z.number().int().min(1).nullable(),
  name: z.string(),
  manager: z.string(),
  logo: TeamLogoSchema.nullable().optional(),
  formation: FormationIdSchema,
  slots: z.array(TeamSlotSchema).length(LINEUP_SIZE),
  layout: TeamLayoutSchema.nullable().optional(),
  ovr: z.number().int(),
  lines: TeamLinesSchema,
  rating: z.number().int(),
  /** T-11-375 디비전(강등 보호 포함). 배포 전 응답엔 없다. */
  division: TeamDivisionSchema.optional(),
  record: TeamRecordSchema,
  goals: z.strictObject({ for: count, against: count }),
  likes: count,
  views: count,
  badges: z.array(TeamBadgeSchema),
  /** T-11-145 이 팀 구단주의 컵 성적(모든 시즌). 배포 전 응답엔 없다. */
  cupHonors: z.array(CupHonorSchema).optional(),
  /** T-11-150 이 팀 구단주의 대표 칭호. */
  ownerTitle: titleField,
  /** T-11-167 구단주의 공개 닉네임(업적 랭킹에 보이는 이름, 닉네임 신고 대상). 없으면 null, 배포 전 응답엔 없다. */
  ownerNickname: z.string().nullable().optional(),
  /**
   * T-11-165 선발 선수 카드(그라운드 카드를 누르면 확대해 보여 준다). 구단주만의 값(기준가 · 직접 키움 · 매물)은 싣지 않는다.
   * 배포 전 응답엔 없다.
   */
  players: z.array(TeamPlayerSchema).optional(),
  /** T-11-290 선발 시너지(내 팀 화면과 같은 표). 구단주가 직접 키운 선수 여부까지 서버가 알아야 해서 서버가 센다. 배포 전 응답엔 없다. */
  synergy: TeamSynergySchema.optional(),
  /** T-11-335 감독 칸에 앉힌 감독(끝낸 감독만, 없으면 null). 배포 전 응답엔 없다. */
  coach: TeamCoachSchema.nullable().optional(),
  createdAt: IsoUtcSchema,
});
export type TeamProfile = z.infer<typeof TeamProfileSchema>;

/** T-11-098 나와 그 구단주의 친구 상태. sent: 내가 보낸 신청 · received: 받은 신청 · accepted: 친구. */
export const FriendStateSchema = z.enum(['none', 'sent', 'received', 'accepted']);
export type FriendState = z.infer<typeof FriendStateSchema>;

/**
 * liked: 조회한 프로필이 좋아요를 눌렀는가. mine: 조회한 프로필의 팀인가(좋아요·조회수를 세지 않는다).
 * friend(T-11-098): 로그인한 구단주가 남의 팀을 볼 때만 준다(그 밖에는 null, 구버전 응답에는 없다).
 */
export const TeamProfileResponseSchema = z.strictObject({
  team: TeamProfileSchema,
  liked: z.boolean(),
  mine: z.boolean(),
  friend: FriendStateSchema.nullable().optional(),
});
export type TeamProfileResponse = z.infer<typeof TeamProfileResponseSchema>;

export const TeamLikeResponseSchema = z.strictObject({ liked: z.boolean(), likes: count });
export type TeamLikeResponse = z.infer<typeof TeamLikeResponseSchema>;
