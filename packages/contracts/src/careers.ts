import { z } from 'zod';
import { bodyError } from './body.js';
import { NATION_BY_CODE } from './nations.js';
import { PUBLIC_NAME_CHARS, PUBLIC_NAME_MAX } from './content-filter.js';
import { STYLE_COUNTERS, STYLE_COUNT_MAX, type StyleCounter } from './play-style.js';
import { serviceSeason } from './service-seasons.js';
import { DETAIL_POSITIONS, FACE_ATTRS, type DetailPos, type FaceAttr } from './positions.js';

/**
 * T-9-009. 커리어·시즌 요약 + 이벤트 선택 로그 업로드 계약. 세이브 전체(브리프: "클라우드 세이브
 * 아님")가 아니라 커리어 메타 + 시즌 한 줄 요약 + 그 시즌의 버퍼링된 선택 로그만 담는다. 선수 이름은
 * 유저가 공개를 켠 경우에만 `publicName`으로 따로 보낸다(T-10-065, 끄면 익명).
 */

export const CareerPosSchema = z.enum(['FW', 'MF', 'DF', 'GK']);
export type CareerPos = z.infer<typeof CareerPosSchema>;
/** T-10-091 세부 포지션(시즌 1부터 만든 선수만). 큰 포지션과 어긋나면 서버가 버린다. */
export const DetailPosSchema = z.enum(DETAIL_POSITIONS);

const Rating99Schema = z.number().int().min(0).max(99);
/** T-10-092 은퇴 선수의 최고 시점 능력치(positions.ts PeakProfile). 서버는 roles를 최고 OVR 아래로 자른다. */
export const PeakProfileSchema = z.strictObject({
  attrs: z.strictObject(
    Object.fromEntries(FACE_ATTRS.map((k) => [k, Rating99Schema])) as Record<
      FaceAttr,
      typeof Rating99Schema
    >,
  ),
  roles: z.strictObject(
    Object.fromEntries(DETAIL_POSITIONS.map((k) => [k, Rating99Schema])) as Record<
      DetailPos,
      typeof Rating99Schema
    >,
  ),
});

export const CareerFootSchema = z.enum(['오른발', '왼발', '양발']);
export type CareerFoot = z.infer<typeof CareerFootSchema>;

const ShortStringSchema = z.string().max(40);

/**
 * T-10-066. 기록에 이름과 함께 남기는 클럽 id(web game/data.ts CLUBS[].id, 상무는 'sangmu'). 유저가 구단명을 바꿔도
 * 엠블럼이 제 클럽을 찾게 한다. 옛 클라이언트·옛 기록엔 없고, 대표팀 기록엔 붙지 않는다.
 */
export const ClubIdSchema = z.string().regex(/^[a-z0-9-]{1,24}$/);

/** 커리어 생성 시 고정되는 메타(포지션·주발·유형·특성·시작 연도·앱 버전). 매 PUT마다 함께 보내
 * 새 커리어면 이 값으로 생성하고, 이미 있으면 값이 같은지 검증 없이 덮어쓴다(클라이언트가 정본). */
export const CareerMetaSchema = z
  .strictObject({
    pos: CareerPosSchema,
    dpos: DetailPosSchema.optional(),
    foot: CareerFootSchema,
    type: ShortStringSchema,
    trait: ShortStringSchema,
    startYear: z.number().int().min(2000).max(2200),
    appVersion: ShortStringSchema,
    /** T-10-096 국적(nations.ts 코드). 옛 클라이언트·옛 커리어엔 없다 = 대한민국. */
    nation: z
      .string()
      .refine((c) => NATION_BY_CODE.has(c), '알 수 없는 국적')
      .optional(),
    /** T-10-096 키(cm)·몸무게(kg). 둘 다 있거나 둘 다 없다. */
    height: z.number().int().optional(),
    weight: z.number().int().optional(),
  })
  .check((ctx) => {
    const { height: h, weight: w } = ctx.value;
    if (h === undefined && w === undefined) return;
    const err =
      h === undefined || w === undefined ? '키·몸무게는 함께 보낸다' : bodyError({ h, w });
    if (err) ctx.issues.push({ code: 'custom', message: err, input: ctx.value, path: ['height'] });
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
  clubId: ClubIdSchema.optional(),
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
  /**
   * T-10-089 원터치 미니게임으로 가린 선택의 탭 정확도 — 구간 가운데에서 떨어진 정도 ×100(100 이하가 성공).
   * 구간 넓이 조정용 관찰 값이다. 미니게임이 없던 선택·옛 클라이언트는 없다.
   */
  mg: z.number().int().min(0).max(1000).optional(),
});
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

/** 선수의 공개 이름(명예의 전당·홈 라이브). 환경설정 '선수 이름 공개'가 켜져 있을 때만 보낸다 — 끄면 null(익명). */
export const PublicNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PUBLIC_NAME_MAX)
  .regex(PUBLIC_NAME_CHARS, '이름에 사용할 수 없는 문자가 있습니다.');

/**
 * 자동 플레이 탐지(관찰용)를 위한 그 시즌의 조작 요약. 입력 내용은 담지 않고 횟수만 센다. 게임에는 영향이 없다 —
 * 운영 도구가 사람답지 않은 흐름(자동화 브라우저, 스크립트가 만든 클릭, 마우스 이동 없는 클릭)을 모아 보는 데만 쓴다.
 */
const signalCount = z.number().int().min(0).max(1_000_000);
const signalMs = z
  .number()
  .int()
  .min(0)
  .max(7 * 86_400_000);
export const PlaySignalsSchema = z.strictObject({
  /** 지난 시즌 업로드(또는 앱 시작)부터 이 시즌이 끝날 때까지 걸린 시간. */
  ms: signalMs,
  /** 사용자가 직접 한 클릭·키·터치(isTrusted). */
  clicks: signalCount,
  keys: signalCount,
  touches: signalCount,
  /** 마우스 이동(포인터 종류가 mouse일 때만). */
  moves: signalCount,
  /** 스크립트가 만든 클릭(isTrusted가 아님). */
  synthetic: signalCount,
  /** 탭이 가려져 있던 시간. */
  hiddenMs: signalMs,
  /** navigator.webdriver — 자동화 도구가 조종하는 브라우저. */
  webdriver: z.boolean(),
});
export type PlaySignals = z.infer<typeof PlaySignalsSchema>;

export const PutCareerSeasonBodySchema = z.strictObject({
  career: CareerMetaSchema,
  season: CareerSeasonPayloadSchema,
  events: z.array(EventLogEntrySchema).max(300),
  /** T-10-065 진행 중 커리어의 공개 이름(홈 라이브). 없으면(옛 클라이언트) 서버 값을 그대로 둔다. */
  publicName: PublicNameSchema.nullable().optional(),
  /** 자동 플레이 탐지용 조작 요약. 옛 클라이언트·기록을 다시 보낼 때는 없다. */
  // 관찰용 부가 정보라 모양이 틀려도 시즌 기록은 받는다(버리면 기기 큐가 시즌 전체를 버린다).
  signals: PlaySignalsSchema.optional().catch(undefined),
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
  lastClubId: ClubIdSchema.optional(),
  /** T-10-026 은퇴 때의 대표 칭호. 옛 클라이언트는 보내지 않는다. */
  title: TitleIdSchema.nullable().optional(),
});
export type RetirementSummary = z.infer<typeof RetirementSummarySchema>;

/**
 * T-10-076 영구결번 심사 결과. granted: 결번을 받았다(seq = 서버 몇 번째 결번). taken: 자격은 있지만 그 구단의 그
 * 번호(두 번째 구단까지)를 이미 다른 선수가 가졌다 — holder는 가장 큰 기여 구단의 보유자(익명이면 null).
 * anonymous: 자격은 있지만 이름을 공개하지 않아 아직 자리를 잡지 않았다. pending: 서버가 기존 은퇴 기록을
 * 다시 훑는 중이거나 영구결번이 아직 열리지 않아 곧 판정된다.
 */
const RetiredSlotSchema = z.strictObject({
  clubId: z.string().min(1),
  club: z.string(),
  number: z.number().int(),
});
export const RetiredNumberResultSchema = z.discriminatedUnion('kind', [
  RetiredSlotSchema.extend({
    kind: z.literal('granted'),
    seq: z.number().int(),
  }),
  RetiredSlotSchema.extend({
    kind: z.literal('taken'),
    holder: z.string().nullable(),
  }),
  RetiredSlotSchema.extend({ kind: z.literal('anonymous') }),
  z.strictObject({ kind: z.literal('pending') }),
]);
export type RetiredNumberResult = z.infer<typeof RetiredNumberResultSchema>;

export const RetirementResponseSchema = z.strictObject({
  careerId: z.string().min(1),
  status: z.literal('retired'),
  /** T-10-076 영구결번 심사. 자격이 없으면 null(배포 전 응답엔 없다). */
  retiredNumber: RetiredNumberResultSchema.nullable().optional(),
});
export type RetirementResponse = z.infer<typeof RetirementResponseSchema>;

/** careerId 경로 파라미터. 클라이언트가 `crypto.randomUUID()`로 만든다(브리프). */
export const CareerIdParamSchema = z.string().uuid();

/** `/seasons/:year` 경로 파라미터. */
export const CareerYearParamSchema = z.coerce.number().int().min(2000).max(2200);

// ───────── T-10-005 공개 명예의 전당 ─────────

const LegendSeasonSchema = z.strictObject({
  year: z.number().int().min(2000).max(2200),
  age: z.number().int().min(0).max(100),
  club: ShortStringSchema,
  clubId: ClubIdSchema.optional(),
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

const StyleCountSchema = z.number().int().min(0).max(STYLE_COUNT_MAX);
/**
 * T-10-077 플레이 성향 — 커리어 내내 유저가 한 선택을 센 값(은퇴 화면 성향 카드). 무엇을 골랐는지 목록은
 * 담지 않고 횟수만 센다(각 카운터의 뜻은 play-style.ts). 이 기능이 나온 뒤의 선택만 세므로 `from`(세기 시작한
 * 나이)부터의 기록이다.
 */
export const PlayStyleSchema = z.strictObject({
  from: z.number().int().min(0).max(100),
  /** 확률 선택들의 성공 확률 합(%, 정수). betWins와 견주면 기대보다 운이 좋았는지 나온다. */
  betOdds: z
    .number()
    .int()
    .min(0)
    .max(STYLE_COUNT_MAX * 100),
  /** 가장 낮은 확률로 성공한 선택(이벤트 id · 성공 확률). */
  best: z
    .strictObject({ id: EventLogEntrySchema.shape.id, p: z.number().min(0).max(1) })
    .optional(),
  ...(Object.fromEntries(STYLE_COUNTERS.map((k) => [k, StyleCountSchema])) as Record<
    StyleCounter,
    typeof StyleCountSchema
  >),
});
export type PlayStyle = z.infer<typeof PlayStyleSchema>;

/**
 * 은퇴 선수 상세(시즌별 기록 · 수상 · 여정)를 다시 그리는 데 필요한 커리어 스냅샷. 선수 이름은 담지
 * 않는다 — 공개 이름은 `publicName`으로 따로 보내고, 공개하지 않으면 서버에 이름이 남지 않는다.
 * 필드 모양은 web `GameState`의 같은 이름 필드와 같다(은퇴 리포트 코드를 그대로 재사용하기 위해).
 */
export const LegendSnapshotSchema = z.strictObject({
  number: z.number().int().min(0).max(99),
  pos: CareerPosSchema,
  dpos: DetailPosSchema.optional(),
  age: z.number().int().min(0).max(100),
  peak: z.number().int().min(0).max(200),
  lastClub: ShortStringSchema,
  lastClubId: ClubIdSchema.optional(),
  career: z.array(LegendSeasonSchema).max(40),
  trophies: z
    .array(YearTextSchema.extend({ club: ShortStringSchema, clubId: ClubIdSchema.optional() }))
    .max(300),
  awards: z.array(YearTextSchema).max(300),
  ballon: z
    .array(
      z.strictObject({
        year: z.number().int().min(2000).max(2200),
        rank: z.number().int().min(1).max(30),
      }),
    )
    .max(40),
  nat: z.strictObject({
    caps: z.number().int().min(0).max(10000),
    /** T-10-086 A매치 통산 골·도움. 옛 스냅샷엔 없다(그땐 출전 수만 남겼다). */
    goals: z.number().int().min(0).max(10000).optional(),
    assists: z.number().int().min(0).max(10000).optional(),
  }),
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
  /** T-10-077 플레이 성향. 기능이 나오기 전에 은퇴한 스냅샷엔 없다. */
  style: PlayStyleSchema.optional(),
});
export type LegendSnapshot = z.infer<typeof LegendSnapshotSchema>;

/** 은퇴 PUT 본문 = 요약 + (선택) 공개 이름 · 상세 스냅샷. 두 필드가 없는 옛 클라이언트 본문도 그대로 통과한다.
 * 같은 커리어로 다시 PUT하면 공개 이름을 바꿀 수 있다(이름 공개 토글). */
export const PutRetirementBodySchema = RetirementSummarySchema.extend({
  publicName: PublicNameSchema.nullable().optional(),
  snapshot: LegendSnapshotSchema.optional(),
  /** T-10-092 최고 시점 능력치. 옛 클라이언트는 없다 — 모양이 틀려도 은퇴는 받는다. */
  profile: PeakProfileSchema.optional().catch(undefined),
});
export type PutRetirementBody = z.infer<typeof PutRetirementBodySchema>;

/** `GET /v1/hof` 목록 한 줄. `name`이 null이면 익명(유저가 이름 공개를 끔). */
export const PublicHofEntrySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().nullable(),
  pos: CareerPosSchema,
  /** T-10-091 세부 포지션. 프리시즌 선수·옛 기록은 null(배포 전 엣지 캐시 응답엔 없다). */
  dpos: DetailPosSchema.nullable().optional(),
  /** T-10-096 국적 코드. 대한민국·옛 기록은 null(배포 전 엣지 캐시 응답엔 없다). */
  nation: z.string().nullable().optional(),
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
  /** T-10-066 마지막 소속 클럽 id. 옛 기록·옛 클라이언트 은퇴는 null(배포 전 엣지 캐시 응답엔 없다). */
  lastClubId: z.string().nullable().optional(),
  retiredAt: z.string(),
  hasDetail: z.boolean(),
  /** T-10-026 대표 칭호 id(없으면 null). */
  title: z.string().nullable(),
  /** T-10-076 이 선수가 가진 영구결번(없으면 null, 배포 전 엣지 캐시 응답엔 없다). */
  retiredNumber: RetiredSlotSchema.extend({ seq: z.number().int() }).nullable().optional(),
  /** T-10-100 은퇴 가치(만 원). 아직 소급하지 못한 옛 기록은 null(배포 전 엣지 캐시 응답엔 없다). */
  value: z.number().int().nullable().optional(),
  /** T-10-101 이름 검색 결과에만: 고른 순위 유형·시즌에서의 실제 순위(1부터). */
  rank: z.number().int().min(1).optional(),
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
 * ga = 공격포인트(골 + 도움), value = 은퇴 가치(T-10-100). */
export const HofSortSchema = z
  .enum([
    'score',
    'value',
    'goals',
    'assists',
    'ga',
    'apps',
    'trophies',
    'awards',
    'ballon',
    'caps',
    'peak',
  ])
  .default('score');
export type HofSort = z.infer<typeof HofSortSchema>;
/** `GET /v1/hof?page=` 1부터 시작하는 페이지 번호(한 페이지 = limit명). */
export const HofPageQuerySchema = z.coerce.number().int().min(1).max(10000).default(1);
/** T-10-101 `GET /v1/hof?q=` 공개 이름 검색(부분 일치). 비었으면 검색하지 않는다. */
export const HofSearchQuerySchema = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((v) => v || undefined);
/** T-10-090 `GET /v1/hof?season=` 서비스 시즌 순위(service-seasons.ts의 id → 그 시즌). 없으면 전체 명예의 전당. */
export const HofSeasonQuerySchema = z.coerce
  .number()
  .int()
  .refine((id) => serviceSeason(id) !== undefined, '없는 시즌입니다.')
  .transform((id) => serviceSeason(id)!)
  .optional();
/**
 * T-11-029 `?season=` 시즌 id(0 = 프리시즌, 그 밖엔 service-seasons.ts의 id). 없으면 서버가 지금 시즌을 쓴다
 * (displaySeasonAt — 개막 전이면 프리시즌, 휴식기면 마지막 시즌).
 */
export const SeasonPickQuerySchema = z.coerce
  .number()
  .int()
  .refine((id) => id === 0 || serviceSeason(id) !== undefined, '없는 시즌입니다.')
  .optional();
/** T-11-018 `GET /v1/hof?pos=` 그 포지션 선수만(포지션별 순위). 없으면 모든 포지션. */
export const HofPosQuerySchema = CareerPosSchema.optional();

// ───────── T-10-027 서버 최초 기록 ─────────

export const ServerFirstCatSchema = z.enum(['total', 'season', 'honor']);
export type ServerFirstCat = z.infer<typeof ServerFirstCatSchema>;

/** 기록을 가진 커리어. 이름은 명예의 전당에 이름 공개를 고른 경우만. */
const FirstHolderSchema = z.strictObject({
  careerId: z.string().min(1),
  name: z.string().nullable(),
  pos: CareerPosSchema,
  number: z.number().int().nullable(),
});

/** 기록 하나. 아직 아무도 못 채웠으면 achievedAt·holder가 null. */
export const ServerFirstSchema = z.strictObject({
  id: z.string().min(1).max(32),
  cat: ServerFirstCatSchema,
  label: z.string().max(80),
  achievedAt: z.string().nullable(),
  holder: FirstHolderSchema.nullable(),
});
export type ServerFirst = z.infer<typeof ServerFirstSchema>;

/** T-10-056 서버 기록(깨질 수 있는 최고 기록). 아직 아무도 없으면 value·achievedAt·holder가 null. */
export const ServerRecordSchema = z.strictObject({
  id: z.string().min(1).max(32),
  label: z.string().max(80),
  unit: z.string().max(8),
  value: z.number().int().nullable(),
  achievedAt: z.string().nullable(),
  holder: FirstHolderSchema.nullable(),
});
export type ServerRecord = z.infer<typeof ServerRecordSchema>;

/**
 * `GET /v1/firsts`. items는 규칙 순서 그대로(미달성 포함 — 달성 개수는 holder로 센다). 끝없는 단계는 달성된
 * 단계와 그 위 다음 목표 하나까지만 담는다(T-10-056). records는 서버 기록.
 */
export const FirstsResponseSchema = z.strictObject({
  items: z.array(ServerFirstSchema),
  records: z.array(ServerRecordSchema),
});
export type FirstsResponse = z.infer<typeof FirstsResponseSchema>;

/**
 * T-10-076 `GET /v1/retired-numbers?season=` 한 시즌의 영구결번(결번 순). 이름은 공개를 고른 경우에만.
 * T-11-029 결번은 시즌마다 따로다 — season은 이 목록의 시즌(0 = 프리시즌).
 */
export const RetiredNumbersResponseSchema = z.strictObject({
  season: z.number().int().nonnegative(),
  items: z.array(
    RetiredSlotSchema.extend({
      seq: z.number().int(),
      grantedAt: z.string(),
      careerId: z.string(),
      name: z.string().nullable(),
      pos: CareerPosSchema,
    }),
  ),
});
export type RetiredNumbersResponse = z.infer<typeof RetiredNumbersResponseSchema>;

/** T-10-076 `GET /v1/careers/:careerId/retired-number` 내 선수의 결번 심사 결과(소급으로 받은 결번·이미 찬 자리 포함). */
export const RetiredNumberCheckResponseSchema = z.strictObject({
  retiredNumber: RetiredNumberResultSchema.nullable(),
});
export type RetiredNumberCheckResponse = z.infer<typeof RetiredNumberCheckResponseSchema>;
