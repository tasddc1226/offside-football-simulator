import { z } from 'zod';

/**
 * T-9-009. 커리어·시즌 요약 + 이벤트 선택 로그 업로드 계약. 세이브 전체(브리프: "클라우드 세이브
 * 아님")가 아니라 커리어 메타 + 시즌 한 줄 요약 + 그 시즌의 버퍼링된 선택 로그만 담는다. 선수 이름은
 * 담지 않는다(브리프: 실명일 수 있어 저장 금지).
 */

export const CareerPosSchema = z.enum(['FW', 'MF', 'DF', 'GK']);
export type CareerPos = z.infer<typeof CareerPosSchema>;

export const CareerFootSchema = z.enum(['오른발', '왼발', '양발']);
export type CareerFoot = z.infer<typeof CareerFootSchema>;

const ShortStringSchema = z.string().max(40);

/** 커리어 생성 시 고정되는 메타(포지션·주발·유형·특성·시작 연도·앱 버전). 매 PUT마다 함께 보내
 * 새 커리어면 이 값으로 생성하고, 이미 있으면 값이 같은지 검증 없이 덮어쓴다(클라이언트가 정본). */
export const CareerMetaSchema = z.strictObject({
  pos: CareerPosSchema,
  foot: CareerFootSchema,
  type: ShortStringSchema,
  trait: ShortStringSchema,
  startYear: z.number().int().min(2000).max(2200),
  appVersion: ShortStringSchema,
});
export type CareerMeta = z.infer<typeof CareerMetaSchema>;

export const CareerHonorSchema = z.string().max(60);

/** T-10-006. 시즌 한 줄의 컵·대륙 대회 기록(game/types.ts `SeasonComp`에서 기록용 필드만). */
export const SeasonCompSchema = z.strictObject({
  type: z.enum(['cup', 'cont', 'super']),
  name: ShortStringSchema,
  stage: z.string().max(20),
  apps: z.number().int().min(0).max(200),
  g: z.number().int().min(0).max(200),
  a: z.number().int().min(0).max(200),
});
export type SeasonComp = z.infer<typeof SeasonCompSchema>;

/** season.ts `endSeason()`이 만드는 `CareerRecord`에서 뽑아낸 한 시즌 요약. */
export const CareerSeasonPayloadSchema = z.strictObject({
  age: z.number().int().min(0).max(100),
  club: ShortStringSchema,
  league: ShortStringSchema,
  apps: z.number().int().min(0).max(1000),
  goals: z.number().int().min(0).max(1000),
  assists: z.number().int().min(0).max(1000),
  rating: z.number().min(0).max(10),
  // game/types.ts `CareerRecord.rank`가 number|string이라 그대로 허용한다(예: 병역 연차 표시).
  rank: z.union([z.number().int().min(0).max(100), z.string().max(20)]),
  ovr: z.number().int().min(0).max(200),
  honors: z.array(CareerHonorSchema).max(30),
  mil: z.boolean().optional(),
  // T-10-006: 시즌 상세. 옛 클라이언트·재시도 큐에 남은 옛 페이로드는 없을 수 있어 모두 선택 필드다.
  /** 무실점 경기 수(GK·DF 위주, 다른 포지션도 집계된다). */
  cs: z.number().int().min(0).max(1000).optional(),
  /** 리그 경기만 센 출전·득점(apps/goals는 컵·대륙 대회 포함 합계). */
  lgApps: z.number().int().min(0).max(1000).optional(),
  lgGoals: z.number().int().min(0).max(1000).optional(),
  /** 그 시즌 A매치 출전 수. */
  caps: z.number().int().min(0).max(200).optional(),
  comps: z.array(SeasonCompSchema).max(10).optional(),
  /** 이 시즌에 경신한 커리어 하이 지표 키(goals/assists/apps/rating/cs). */
  ch: z.array(z.string().min(1).max(12)).max(10).optional(),
});
export type CareerSeasonPayload = z.infer<typeof CareerSeasonPayloadSchema>;

/** 시즌 중 버퍼링되는 선택 로그 한 줄. 자유 텍스트 없이 짧은 코드만 담는다(브리프: "no free text"). */
export const EventLogEntrySchema = z.strictObject({
  /** 종류: 'ev'(이벤트) | 'mkt'(이적시장) | 'mil'(병역) 등. */
  k: z.string().min(1).max(8),
  id: z.string().min(1).max(32),
  c: z.union([z.number().int().min(-1000).max(1000), z.string().max(24)]),
  ok: z.boolean().optional(),
  /** 발생 시점(halves/phase 인덱스). */
  h: z.number().int().min(0).max(1000),
});
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

export const PutCareerSeasonBodySchema = z.strictObject({
  career: CareerMetaSchema,
  season: CareerSeasonPayloadSchema,
  events: z.array(EventLogEntrySchema).max(300),
});
export type PutCareerSeasonBody = z.infer<typeof PutCareerSeasonBodySchema>;

export const CareerUpsertResponseSchema = z.strictObject({
  careerId: z.string().min(1),
  year: z.number().int(),
  status: z.enum(['active', 'retired']),
});
export type CareerUpsertResponse = z.infer<typeof CareerUpsertResponseSchema>;

/** T-10-026 칭호 id(web `game/titles.ts` 레지스트리 키). 서버는 모양만 검사하고 뜻은 웹이 해석한다. */
export const TitleIdSchema = z.string().regex(/^[a-z0-9_]{1,32}$/);

/** season.ts `retire()`가 만드는 `HofEntry` + `legendScore()`에서 뽑아낸 은퇴 요약. */
export const RetirementSummarySchema = z.strictObject({
  retireAge: z.number().int().min(0).max(100),
  peak: z.number().int().min(0).max(200),
  legendScore: z.number().int().min(0).max(100000),
  apps: z.number().int().min(0).max(100000),
  goals: z.number().int().min(0).max(100000),
  assists: z.number().int().min(0).max(100000),
  trophies: z.number().int().min(0).max(10000),
  awards: z.number().int().min(0).max(10000),
  caps: z.number().int().min(0).max(10000),
  ballon: z.number().int().min(0).max(1000),
  lastClub: ShortStringSchema,
  /** T-10-026 은퇴 때의 대표 칭호. 옛 클라이언트는 보내지 않는다. */
  title: TitleIdSchema.nullable().optional(),
});
export type RetirementSummary = z.infer<typeof RetirementSummarySchema>;

export const RetirementResponseSchema = z.strictObject({
  careerId: z.string().min(1),
  status: z.literal('retired'),
});
export type RetirementResponse = z.infer<typeof RetirementResponseSchema>;

/** careerId 경로 파라미터. 클라이언트가 `crypto.randomUUID()`로 만든다(브리프). */
export const CareerIdParamSchema = z.string().uuid();

/** `/seasons/:year` 경로 파라미터. */
export const CareerYearParamSchema = z.coerce.number().int().min(2000).max(2200);

// ───────── T-10-005 공개 명예의 전당 ─────────

/** 은퇴 선수의 공개 이름. 유저가 명시적으로 공개를 고른 경우에만 보낸다(기본은 익명 — null). */
export const PublicNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[^\p{Cc}<>]+$/u, '이름에 사용할 수 없는 문자가 있습니다.');

const LegendSeasonSchema = z.strictObject({
  year: z.number().int().min(2000).max(2200),
  age: z.number().int().min(0).max(100),
  club: ShortStringSchema,
  league: ShortStringSchema,
  apps: z.number().int().min(0).max(1000),
  goals: z.number().int().min(0).max(1000),
  assists: z.number().int().min(0).max(1000),
  cs: z.number().int().min(0).max(1000),
  rating: z.number().min(0).max(10),
  rank: z.union([z.number().int().min(0).max(100), z.string().max(20)]),
  ovr: z.number().int().min(0).max(200),
  honors: z.array(CareerHonorSchema).max(30),
  mil: z.boolean().optional(),
  ch: z.array(z.string().max(16)).max(10).optional(),
});

const YearTextSchema = z.strictObject({
  year: z.number().int().min(2000).max(2200),
  t: z.string().max(80),
});

/**
 * 은퇴 선수 상세(시즌별 기록 · 수상 · 여정)를 다시 그리는 데 필요한 커리어 스냅샷. 선수 이름은 담지
 * 않는다 — 공개 이름은 `publicName`으로 따로 보내고, 공개하지 않으면 서버에 이름이 남지 않는다.
 * 필드 모양은 web `GameState`의 같은 이름 필드와 같다(은퇴 리포트 코드를 그대로 재사용하기 위해).
 */
export const LegendSnapshotSchema = z.strictObject({
  number: z.number().int().min(0).max(99),
  pos: CareerPosSchema,
  age: z.number().int().min(0).max(100),
  peak: z.number().int().min(0).max(200),
  lastClub: ShortStringSchema,
  career: z.array(LegendSeasonSchema).max(40),
  trophies: z.array(YearTextSchema.extend({ club: ShortStringSchema })).max(300),
  awards: z.array(YearTextSchema).max(300),
  ballon: z
    .array(
      z.strictObject({
        year: z.number().int().min(2000).max(2200),
        rank: z.number().int().min(1).max(30),
      }),
    )
    .max(40),
  nat: z.strictObject({ caps: z.number().int().min(0).max(10000) }),
  storyLog: z
    .array(
      z.strictObject({
        year: z.number().int().min(2000).max(2200),
        key: z.string().max(32),
        name: z.string().max(40),
        ending: z.string().max(80),
      }),
    )
    .max(80),
  miles: z.array(YearTextSchema).max(300),
  /** T-10-026 획득한 칭호(year 0 = 칭호 도입 전 기록). 옛 스냅샷엔 없다. */
  titles: z
    .array(z.strictObject({ id: TitleIdSchema, year: z.number().int().min(0).max(2200) }))
    .max(200)
    .optional(),
});
export type LegendSnapshot = z.infer<typeof LegendSnapshotSchema>;

/** 은퇴 PUT 본문 = 요약 + (선택) 공개 이름 · 상세 스냅샷. 두 필드가 없는 옛 클라이언트 본문도 그대로 통과한다.
 * 같은 커리어로 다시 PUT하면 공개 이름을 바꿀 수 있다(이름 공개 토글). */
export const PutRetirementBodySchema = RetirementSummarySchema.extend({
  publicName: PublicNameSchema.nullable().optional(),
  snapshot: LegendSnapshotSchema.optional(),
});
export type PutRetirementBody = z.infer<typeof PutRetirementBodySchema>;

/** `GET /v1/hof` 목록 한 줄. `name`이 null이면 익명(유저가 이름 공개를 고르지 않음). */
export const PublicHofEntrySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().nullable(),
  pos: CareerPosSchema,
  number: z.number().int().nullable(),
  retireAge: z.number().int(),
  peak: z.number().int(),
  legendScore: z.number().int(),
  apps: z.number().int(),
  goals: z.number().int(),
  assists: z.number().int(),
  trophies: z.number().int(),
  awards: z.number().int(),
  caps: z.number().int(),
  ballon: z.number().int(),
  lastClub: z.string(),
  retiredAt: z.string(),
  hasDetail: z.boolean(),
  /** T-10-026 대표 칭호 id(없으면 null). */
  title: z.string().nullable(),
});
export type PublicHofEntry = z.infer<typeof PublicHofEntrySchema>;

/** `total`은 공개 명예의 전당 전체 인원(페이지 수 계산용). */
export const HofListResponseSchema = z.strictObject({
  entries: z.array(PublicHofEntrySchema),
  total: z.number().int().min(0),
});
export type HofListResponse = z.infer<typeof HofListResponseSchema>;

export const HofDetailResponseSchema = z.strictObject({
  entry: PublicHofEntrySchema,
  snapshot: LegendSnapshotSchema.nullable(),
});
export type HofDetailResponse = z.infer<typeof HofDetailResponseSchema>;

/** T-10-013 `GET /v1/careers/mine`. 이 계정(프로필)의 은퇴 선수. `linked`가 false면 익명 프로필이라
 * 웹은 기기 기록(ft_hof)을 그대로 보여 준다. 이름은 서버에 없으므로(공개를 고른 경우만) 같은 기기의 기록이 채운다. */
export const MyCareersResponseSchema = z.strictObject({
  linked: z.boolean(),
  entries: z.array(PublicHofEntrySchema),
});
export type MyCareersResponse = z.infer<typeof MyCareersResponseSchema>;

export const HofListQuerySchema = z.coerce.number().int().min(1).max(100).default(50);
/** `GET /v1/hof?sort=` 명예의 전당 순위 유형. score(레전드 점수) 말고는 그 기록이 0인 선수는 빠진다.
 * ga = 공격포인트(골 + 도움). */
export const HofSortSchema = z
  .enum(['score', 'goals', 'assists', 'ga', 'apps', 'trophies', 'awards', 'ballon', 'caps', 'peak'])
  .default('score');
export type HofSort = z.infer<typeof HofSortSchema>;
/** `GET /v1/hof?page=` 1부터 시작하는 페이지 번호(한 페이지 = limit명). */
export const HofPageQuerySchema = z.coerce.number().int().min(1).max(10000).default(1);

// ───────── T-10-027 서버 최초 기록 ─────────

export const ServerFirstCatSchema = z.enum(['total', 'season', 'honor']);
export type ServerFirstCat = z.infer<typeof ServerFirstCatSchema>;

/** 기록 하나. 아직 아무도 못 채웠으면 achievedAt·holder가 null. 이름은 명예의 전당에 이름 공개를 고른 경우만. */
export const ServerFirstSchema = z.strictObject({
  id: z.string().min(1).max(32),
  cat: ServerFirstCatSchema,
  label: z.string().max(80),
  achievedAt: z.string().nullable(),
  holder: z
    .strictObject({
      careerId: z.string().min(1),
      name: z.string().nullable(),
      pos: CareerPosSchema,
      number: z.number().int().nullable(),
    })
    .nullable(),
});
export type ServerFirst = z.infer<typeof ServerFirstSchema>;

/** `GET /v1/firsts`. items는 규칙 순서 그대로(미달성 포함 — 달성 개수는 holder로 센다). */
export const FirstsResponseSchema = z.strictObject({ items: z.array(ServerFirstSchema) });
export type FirstsResponse = z.infer<typeof FirstsResponseSchema>;
