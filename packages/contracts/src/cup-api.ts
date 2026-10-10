import { z } from 'zod';
import { CUP_ROUNDS, CUP_STAGES, IAP_PRODUCT_IDS, REWARD_KINDS } from './cup.js';
import { IsoUtcSchema } from './primitives.js';
import { TeamIdSchema, TeamLogoSchema, TeamMatchSchema } from './teams.js';

// T-11-145 오프사이드 컵·구단주 아이템 API 모양. 값은 zod 없는 cup.ts.

// ───────── API 모양 ─────────

export const CupIdSchema = z.string().regex(/^s\d+-\d+$/);
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
});
export type CupInfo = z.infer<typeof CupInfoSchema>;

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
});
export type CupResponse = z.infer<typeof CupResponseSchema>;

/** 신청 자격 검사 결과. ok가 아니면 reason으로 안내한다. */
export const CupEligibilitySchema = z.strictObject({
  ok: z.boolean(),
  reason: z.enum(['no-team', 'not-enough', 'listed', 'closed', 'full']).nullable(),
  filled: z.number().int(),
});

export const CupEntryStatusSchema = z.enum(['active', 'out', 'champion', 'withdrawn']);

export const CupMeResponseSchema = z.strictObject({
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
 * 구단주 아이템 장수. reroll: 선수 후보 리롤권, boost: 잠재력 강화권(T-11-174). iap는 GET /v1/items만 준다 — account는
 * 인앱 구매에 붙이는 구단주 표시(Apple appAccountToken · Google obfuscatedAccountId), stores는 서버가 구매를 확인할 수 있는
 * 스토어(여기 없는 스토어에선 상품을 보이지 않는다).
 */
export const OwnerItemsResponseSchema = z.strictObject({
  reroll: z.number().int().min(0),
  boost: z.number().int().min(0),
  iap: z.strictObject({ account: z.uuid(), stores: z.array(IapStoreSchema) }).optional(),
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
});
export type RerollShopResponse = z.infer<typeof RerollShopResponseSchema>;

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
    entryDays: z.number().int().min(1).max(14).optional(),
    drawHour: z.number().int().min(0).max(23).optional(),
    matchHour: z.number().int().min(0).max(23).optional(),
    capacity: z.number().int().min(4).max(64).optional(),
    minFilled: z.number().int().min(1).max(11).optional(),
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
export const AdminCupListSchema = z.strictObject({ items: z.array(AdminCupSchema) });
export type AdminCupList = z.infer<typeof AdminCupListSchema>;
