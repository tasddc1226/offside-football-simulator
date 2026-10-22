import { z } from 'zod';
import {
  CUP_DIVISIONS,
  CUP_ROUNDS,
  CUP_STAGES,
  IAP_PRODUCT_IDS,
  REWARD_KINDS,
  SCOUT_MODES,
} from './cup.js';
import { IsoUtcSchema } from './primitives.js';
import { TeamIdSchema, TeamLogoSchema, TeamMatchSchema } from './teams.js';

// T-11-145 오프사이드 컵·구단주 아이템 API 모양. 값은 zod 없는 cup.ts.

// ───────── API 모양 ─────────

export const CupIdSchema = z.string().regex(/^s\d+-\d+(?:-(?:junior|senior|master))?$/);
/** T-11-410 OVR 구간. */
export const CupDivisionSchema = z.enum(CUP_DIVISIONS);
export const CupRoundSchema = z.enum(CUP_ROUNDS);
export const CupStageSchema = z.enum(CUP_STAGES);
export const CupPhaseSchema = z.enum([
  'soon',
  'open',
  'closed',
  'group',
  'knockout',
  'done',
  'cancelled',
]);
export type CupPhase = z.infer<typeof CupPhaseSchema>;

export const CupTeamSchema = z.strictObject({
  teamId: z.string(),
  name: z.string(),
  owner: z.string(),
  logo: TeamLogoSchema.nullable(),
  ovr: z.number().int(),
});
export type CupTeam = z.infer<typeof CupTeamSchema>;

export const CupStandingSchema = z.strictObject({
  teamId: z.string(),
  p: z.number().int(),
  w: z.number().int(),
  d: z.number().int(),
  l: z.number().int(),
  gf: z.number().int(),
  ga: z.number().int(),
  pts: z.number().int(),
  /** 조 안 순위(1부터). 조별이 끝나면 1·2위가 진출. */
  rank: z.number().int(),
});
export type CupStanding = z.infer<typeof CupStandingSchema>;

export const CupGroupSchema = z.strictObject({
  no: z.number().int().min(1),
  standings: z.array(CupStandingSchema),
});

/** T-11-407 경기 전 예상 승 · 무 · 패(홈 기준 정수 %, 합 100). */
export const CupMatchOddsSchema = z.strictObject({
  home: z.number().int().min(0).max(100),
  draw: z.number().int().min(0).max(100),
  away: z.number().int().min(0).max(100),
});
export type CupMatchOdds = z.infer<typeof CupMatchOddsSchema>;

export const CupMatchSchema = z.strictObject({
  id: z.string(),
  round: CupRoundSchema,
  group: z.number().int().nullable(),
  /** 토너먼트 대진 순서(0부터). 조별 경기는 0. */
  slot: z.number().int(),
  homeTeamId: z.string().nullable(),
  awayTeamId: z.string().nullable(),
  at: IsoUtcSchema,
  played: z.boolean(),
  homeGoals: z.number().int().nullable(),
  awayGoals: z.number().int().nullable(),
  /** 토너먼트 무승부의 승부차기 점수. */
  pens: z.strictObject({ home: z.number().int(), away: z.number().int() }).nullable(),
  winnerTeamId: z.string().nullable(),
  /** 한 팀이 나오지 못해 0:3으로 끝난 경기. */
  forfeit: z.boolean(),
  /** T-11-407 경기 전 예상(명단이 잠긴 경기 1시간 전부터). 잠금 전 · 몰수 경기는 null, 옛 서버 응답에는 없다. */
  odds: CupMatchOddsSchema.nullable().optional(),
});
export type CupMatch = z.infer<typeof CupMatchSchema>;

export const CupInfoSchema = z.strictObject({
  id: CupIdSchema,
  season: z.number().int(),
  edition: z.number().int(),
  opensAt: IsoUtcSchema,
  closesAt: IsoUtcSchema,
  drawAt: IsoUtcSchema,
  rounds: z.array(
    z.strictObject({ round: CupRoundSchema, at: IsoUtcSchema, lockAt: IsoUtcSchema }),
  ),
  capacity: z.number().int(),
  minFilled: z.number().int(),
  /** T-11-410 구간(통합 대회 · 옛 응답에는 없다). */
  division: CupDivisionSchema.optional(),
  /** T-11-410 팀 OVR 상한(마스터 · 접수 전 아랫 구간은 null). */
  ovrMax: z.number().int().nullable().optional(),
});
export type CupInfo = z.infer<typeof CupInfoSchema>;

/** T-11-410 회차 안 구간 하나(탭 · 배너). entries는 신청(취소 제외) 팀 수. */
export const CupDivisionInfoSchema = z.strictObject({
  id: CupIdSchema,
  division: CupDivisionSchema,
  ovrMax: z.number().int().nullable(),
  entries: z.number().int(),
});
export type CupDivisionInfo = z.infer<typeof CupDivisionInfoSchema>;

export const CupResponseSchema = z.strictObject({
  cup: CupInfoSchema,
  phase: CupPhaseSchema,
  entries: z.number().int(),
  /** 추첨 전에는 신청한 팀(신청 순), 추첨 뒤에는 조에 들어간 팀(T-11-160). */
  teams: z.array(CupTeamSchema),
  groups: z.array(CupGroupSchema),
  matches: z.array(CupMatchSchema),
  /** 우승 팀(끝났을 때). */
  championTeamId: z.string().nullable(),
  /** T-11-410 같은 회차의 구간들(아래에서 위). 통합 대회 · 옛 응답에는 없다. */
  divisions: z.array(CupDivisionInfoSchema).optional(),
});
export type CupResponse = z.infer<typeof CupResponseSchema>;

/** T-11-290 가장 최근에 끝난 대회의 우승 팀(홈 우승 팝업). 팀 이름·구단주·로고는 지금 팀 기준(없어졌으면 신청 때 값). */
export const CupChampionSchema = z.strictObject({
  cupId: CupIdSchema,
  season: z.number().int(),
  edition: z.number().int(),
  /** T-11-410 구간 대회 우승이면 그 구간. */
  division: CupDivisionSchema.optional(),
  teamId: z.string(),
  name: z.string(),
  owner: z.string(),
  logo: TeamLogoSchema.nullable(),
  /** 대회 마감(보상·칭호 지급) 시각. */
  doneAt: IsoUtcSchema,
});
export type CupChampion = z.infer<typeof CupChampionSchema>;

/** Home banner only; no lineups, standings or match payloads. The only logo is the recent champion's (one row). */
export const CupHomeResponseSchema = z.strictObject({
  cup: CupInfoSchema,
  phase: CupPhaseSchema,
  entries: z.number().int(),
  teamCount: z.number().int(),
  round: CupRoundSchema.nullable(),
  championName: z.string().nullable(),
  /** T-11-290 결승 뒤 CUP_HOME_AFTER_MS 안에 끝난 가장 최근 대회의 우승 팀. 다음 대회 접수가 열려 cup이 바뀌어도 남는다. */
  champion: CupChampionSchema.nullable(),
  /** T-11-410 구간들(entries · teamCount는 구간을 합한 값). 통합 대회 · 옛 응답에는 없다. */
  divisions: z.array(CupDivisionInfoSchema).optional(),
});
export type CupHomeResponse = z.infer<typeof CupHomeResponseSchema>;

/** 신청 자격 검사 결과. ok가 아니면 reason으로 안내한다. */
export const CupEligibilitySchema = z.strictObject({
  ok: z.boolean(),
  // T-11-410 over-cap = 팀 OVR이 구간 상한보다 높다, entered-other = 같은 회차 다른 구간에 신청했다.
  reason: z
    .enum(['no-team', 'not-enough', 'listed', 'closed', 'full', 'over-cap', 'entered-other'])
    .nullable(),
  filled: z.number().int(),
});

export const CupEntryStatusSchema = z.enum(['active', 'out', 'champion', 'withdrawn']);

/**
 * T-11-405 내 다음 경기의 예상(지금 두 팀 명단 기준, 내 쪽에서 본 90분 승 · 무 · 패 %). 경기와 같은 줄 힘 · 기대 득점으로
 * 계산한다. 토너먼트에서 비기면 승부차기로 가린다.
 */
export const CupOddsSchema = z.strictObject({
  win: z.number().int().min(0).max(100),
  draw: z.number().int().min(0).max(100),
  loss: z.number().int().min(0).max(100),
  xg: z.strictObject({ mine: z.number(), opp: z.number() }),
});
export type CupOdds = z.infer<typeof CupOddsSchema>;

export const CupMeResponseSchema = z.strictObject({
  /** T-11-410 이 응답이 본 대회. 'current'로 물으면 내가 신청한 구간(없으면 내 OVR로 들어갈 가장 낮은 구간). */
  cupId: CupIdSchema.optional(),
  /** T-11-410 내 팀 OVR(팀이 없으면 null). 구간 탭에서 들어갈 수 있는 구간을 고른다. */
  ovr: z.number().int().nullable().optional(),
  entry: z
    .strictObject({
      teamId: TeamIdSchema,
      status: CupEntryStatusSchema,
      group: z.number().int().nullable(),
      stage: CupStageSchema.nullable(),
      createdAt: IsoUtcSchema,
    })
    .nullable(),
  eligibility: CupEligibilitySchema,
  /** 다음 내 경기(있으면). */
  next: CupMatchSchema.nullable(),
  /** T-11-405 다음 경기 예상(두 팀이 다 정해졌고 지금 팀이 있을 때만). 옛 서버 응답에는 없다. */
  nextOdds: CupOddsSchema.nullable().optional(),
  /** 지금 명단이 잠겨 있는가(경기 1시간 전 ~ 그 경기가 끝날 때까지). */
  locked: z.boolean(),
  rerolls: z.number().int().min(0),
});
export type CupMeResponse = z.infer<typeof CupMeResponseSchema>;

export const CupMatchResponseSchema = z.strictObject({
  match: TeamMatchSchema,
  cup: z.strictObject({
    round: CupRoundSchema,
    group: z.number().int().nullable(),
    pens: z.strictObject({ home: z.number().int(), away: z.number().int() }).nullable(),
    forfeit: z.boolean(),
  }),
});
export type CupMatchResponse = z.infer<typeof CupMatchResponseSchema>;

export const IapStoreSchema = z.enum(['apple', 'google']);
export type IapStore = z.infer<typeof IapStoreSchema>;

/**
 * 구단주 아이템 장수. reroll: 선수 후보 리롤권, boost: 잠재력 강화권(T-11-174), scout: 프리미엄 스카우트권(T-11-196). iap는 GET /v1/items만 준다 — account는
 * 인앱 구매에 붙이는 구단주 표시(Apple appAccountToken · Google obfuscatedAccountId), stores는 서버가 구매를 확인할 수 있는
 * 스토어(여기 없는 스토어에선 상품을 보이지 않는다).
 */
export const OwnerItemsResponseSchema = z.strictObject({
  reroll: z.number().int().min(0),
  boost: z.number().int().min(0),
  scout: z.number().int().min(0),
  /** T-11-377 선수 이름 변경권. 옛 서버 응답에는 없다. */
  rename: z.number().int().min(0).optional(),
  iap: z.strictObject({ account: z.uuid(), stores: z.array(IapStoreSchema) }).optional(),
  /** T-11-244 프리미엄 스카우트 천장 카운트(scoutPityView로 남은 장수를 그린다). */
  pity: z
    .strictObject({
      used: z.number().int().min(0),
      streak: z.number().int().min(0),
      elites: z.number().int().min(0),
    })
    .optional(),
  /** T-11-244 스카우트권을 쓴 응답에만: 이번 장의 모드(sure · elite면 기기가 그 확정 후보로 뽑는다). */
  scoutMode: z.enum(SCOUT_MODES).optional(),
  /** T-11-248 리롤권 마일리지: 마지막 스카우트권 지급 뒤 쓴 리롤권 장수(rerollMileageLeft로 남은 장수를 그린다). */
  mileage: z.number().int().min(0).optional(),
  /** T-11-248 리롤권을 쓴 응답에만: 이번 장으로 마일리지가 차 프리미엄 스카우트권 1장을 받았다. */
  mileageScout: z.literal(true).optional(),
});
export type OwnerItemsResponse = z.infer<typeof OwnerItemsResponseSchema>;

/**
 * T-11-174 POST /v1/items/iap — 스토어에서 산 소모성 상품을 서버에 알린다. token: Apple은 서명된 거래(JWS), Google은
 * purchaseToken. 서버가 스토어 기준으로 확인하고 거래마다 한 번만 아이템을 준다(같은 거래를 다시 보내도 한 번).
 */
export const IapClaimBodySchema = z.strictObject({
  store: IapStoreSchema,
  productId: z.enum(IAP_PRODUCT_IDS),
  token: z.string().min(1).max(16384),
});
export type IapClaimBody = z.infer<typeof IapClaimBodySchema>;

/**
 * T-11-152 GET /v1/items/shop — 리롤권 상점(구단 자금으로 산다). price는 다음 한 장 가격(만 원), 오늘 상한을 다 썼거나
 * 팔지 않으면(cap 0) null. bought·cap은 오늘(0시 한국 시각부터) 산 장수와 하루 상한.
 */
export const RerollShopResponseSchema = z.strictObject({
  reroll: z.number().int().min(0),
  balance: z.number().int().min(0),
  price: z.number().int().min(1).nullable(),
  bought: z.number().int().min(0),
  cap: z.number().int().min(0),
  /** T-11-244 구단 자금으로 사는 프리미엄 스카우트권(한 주 = 월요일 0시 한국 시각부터). 옛 앱은 모른다. */
  scout: z
    .strictObject({
      have: z.number().int().min(0),
      price: z.number().int().min(1).nullable(),
      bought: z.number().int().min(0),
      cap: z.number().int().min(0),
    })
    .optional(),
});
export type RerollShopResponse = z.infer<typeof RerollShopResponseSchema>;

/**
 * T-11-244 POST /v1/items/scout/use 본문. hit = 기기가 이번 시드로 뽑은 일반 프리미엄 후보에 S가 있는지(천장 카운트를
 * 0으로 돌린다). 본문이 없으면(천장을 모르는 옛 앱) 확정 모드를 주지 않고 장수만 센다.
 */
/**
 * T-11-275 GET /v1/items/gift — 받을 수 있는 홈 선물. 받았으면 null. T-11-386 홈 선물을 받았으면 시즌 업적 보상
 * (kind 'achSeason', season = 업적을 센 시즌)을 같은 칸으로 준다. kind가 없으면 홈 선물(옛 서버).
 */
export const HomeGiftResponseSchema = z.strictObject({
  gift: z
    .strictObject({
      id: z.string(),
      kind: z.enum(['home', 'achSeason']).optional(),
      season: z.number().int().min(1).optional(),
      boost: z.number().int().min(0),
      scout: z.number().int().min(0),
    })
    .nullable(),
});
/** T-11-386 POST /v1/items/gift/claim 본문. id = 화면에 보인 선물(없으면 지금 받을 수 있는 첫 선물 — 옛 앱). */
export const GiftClaimBodySchema = z.strictObject({ id: z.string().max(64).optional() });
export type HomeGiftResponse = z.infer<typeof HomeGiftResponseSchema>;

export const ScoutUseBodySchema = z.strictObject({ hit: z.boolean().optional() });

/** POST /v1/items/reroll/buy — 화면에서 본 가격을 함께 보낸다(그 사이 가격이 바뀌었으면 409). */
export const BuyRerollBodySchema = z.strictObject({ price: z.number().int().min(1) });
export type BuyRerollBody = z.infer<typeof BuyRerollBodySchema>;

/** T-11-153 보상 하나의 구단 자금 값 — 다음 한 번 가격(오늘 상한을 다 썼거나 팔지 않으면 null) · 오늘 쓴 횟수 · 상한. */
const RewardOfferSchema = z.strictObject({
  price: z.number().int().min(1).nullable(),
  bought: z.number().int().min(0),
  cap: z.number().int().min(0),
});
/** GET /v1/items/rewards — 광고 대신 구단 자금으로 받는 보상들의 값과 지금 구단 자금. */
export const RewardShopResponseSchema = z.strictObject({
  balance: z.number().int().min(0),
  offers: z.strictObject({
    candidates: RewardOfferSchema,
    peek: RewardOfferSchema,
    boost: RewardOfferSchema,
  }),
});
export type RewardShopResponse = z.infer<typeof RewardShopResponseSchema>;
export type RewardOffer = z.infer<typeof RewardOfferSchema>;

/** POST /v1/items/rewards/buy — 받을 보상과 화면에서 본 가격(그 사이 바뀌었으면 409). 응답은 바뀐 RewardShopResponse. */
export const BuyRewardBodySchema = z.strictObject({
  kind: z.enum(REWARD_KINDS),
  price: z.number().int().min(1),
});
export type BuyRewardBody = z.infer<typeof BuyRewardBodySchema>;

// ───────── 관리자: 대회 열기 ─────────

/** POST /v1/admin/cups. 시작일만 주면 표준 일정(planCup)으로 연다. 시즌·회차·id는 서버가 정한다. */
export const AdminCupCreateSchema = z
  .strictObject({
    opensOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    opensTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    entryDays: z.number().int().min(1).max(14).optional(),
    drawHour: z.number().int().min(0).max(23).optional(),
    matchHour: z.number().int().min(0).max(23).optional(),
    capacity: z.number().int().min(4).max(128).optional(),
    minFilled: z.number().int().min(1).max(11).optional(),
    /** T-11-410 OVR 구간별로 연다(구간마다 대회 하나). 상한은 접수가 열릴 때 시즌 팀 분포로 정한다. */
    divisions: z.boolean().optional(),
  })
  // 추첨은 첫 경기 2시간 전보다 앞서야 한다.
  .refine((v) => (v.matchHour ?? 21) - (v.drawHour ?? 12) >= 2, { path: ['drawHour'] });
export type AdminCupCreate = z.infer<typeof AdminCupCreateSchema>;

export const AdminCupStatusSchema = z.enum(['scheduled', 'entry', 'running', 'done']);
export const AdminCupSchema = z.strictObject({
  cup: CupInfoSchema,
  status: AdminCupStatusSchema,
  /** 신청(취소 제외) 팀 수. */
  entries: z.number().int(),
});
export type AdminCup = z.infer<typeof AdminCupSchema>;
/** T-11-410 PUT /v1/admin/cups/:cupId/cap — 아랫 구간 상한(접수가 열리기 전만). */
export const AdminCupCapSchema = z.strictObject({ ovrMax: z.number().int().min(1).max(120) });
export type AdminCupCap = z.infer<typeof AdminCupCapSchema>;
/** T-11-410 GET /v1/admin/cups/caps — 지금 시즌 팀 분포로 낸 상한 제안. */
export const AdminCupCapsSuggestSchema = z.strictObject({
  season: z.number().int(),
  teams: z.number().int(),
  caps: z.array(z.number().int()),
});
export type AdminCupCapsSuggest = z.infer<typeof AdminCupCapsSuggestSchema>;
export const AdminCupListSchema = z.strictObject({ items: z.array(AdminCupSchema) });
export type AdminCupList = z.infer<typeof AdminCupListSchema>;

/** Public crowd picks are separate from account-specific predictions. */
export const CupPredictionPickSchema = z.enum(['home', 'draw', 'away']);
export type CupPredictionPick = z.infer<typeof CupPredictionPickSchema>;
export const PutCupPredictionBodySchema = z.strictObject({ pick: CupPredictionPickSchema });
export const CupPredictionCountsSchema = z.strictObject({
  matchId: z.string(),
  home: z.number().int().nonnegative(),
  draw: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
});
export type CupPredictionCounts = z.infer<typeof CupPredictionCountsSchema>;
export const CupPredictionsResponseSchema = z.strictObject({
  items: z.array(CupPredictionCountsSchema),
});
export type CupPredictionsResponse = z.infer<typeof CupPredictionsResponseSchema>;
export const CupPredictionMeResponseSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      matchId: z.string(),
      pick: CupPredictionPickSchema,
      correct: z.boolean().nullable(),
      rewarded: z.boolean(),
    }),
  ),
});
export type CupPredictionMeResponse = z.infer<typeof CupPredictionMeResponseSchema>;
