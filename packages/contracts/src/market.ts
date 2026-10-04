import { z } from 'zod';
import {
  CareerIdParamSchema,
  CareerPosSchema,
  DetailPosSchema,
  PeakProfileSchema,
} from './careers.js';
import { IsoUtcSchema } from './primitives.js';

// T-11-080 이적시장 · 구단 자금 · 방출. 설계: docs/tracking/owner-funds-card-market-plan.md.
// 거래는 지금 팀 시즌(teamSeasonAt) 카드끼리만 한다. 금액은 모두 만 원 단위 정수.

export const MARKET_PER_PAGE = 20;
export const MARKET_SORTS = ['new', 'price'] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];
/** 한 번에 방출할 수 있는 선수 수. */
export const RELEASE_MAX = 50;

const man = z.number().int().min(0);

export const ListingIdSchema = z.string().regex(/^lst_[0-9a-f-]{36}$/);

/** 시장에 보이는 카드. 서버에는 선수 이름이 없다 — 공개한 이름(publicName)만 있다. */
export const MarketCardSchema = z.strictObject({
  careerId: z.string(),
  pos: CareerPosSchema,
  dpos: DetailPosSchema.nullable(),
  nation: z.string().nullable(),
  peak: z.number().int(),
  number: z.number().int().nullable(),
  publicName: z.string().nullable(),
  legendScore: z.number().int(),
  attrs: PeakProfileSchema.shape.attrs.nullable(),
  /** 기준가(만 원). */
  cardValue: man,
  /** 지금까지 팔린 횟수. */
  transfers: z.number().int().min(0),
  season: z.number().int().min(0),
});
export type MarketCard = z.infer<typeof MarketCardSchema>;

export const MarketListingSchema = z.strictObject({
  id: ListingIdSchema,
  price: man,
  createdAt: IsoUtcSchema,
  card: MarketCardSchema,
});
export type MarketListing = z.infer<typeof MarketListingSchema>;

/** 서버가 지금 쓰는 시장 수치(운영 도구 밸런스 설정). 화면이 가격 범위·수수료를 미리 보여 준다. */
export const MarketRulesSchema = z.strictObject({
  releaseRate: z.number(),
  feeRate: z.number(),
  priceMin: z.number(),
  priceMax: z.number(),
  listLimit: z.number().int(),
  dailyBuys: z.number().int(),
});
export type MarketRules = z.infer<typeof MarketRulesSchema>;

export const MarketListQuerySchema = z.strictObject({
  pos: CareerPosSchema.optional(),
  sort: z.enum(MARKET_SORTS).default('new'),
  page: z.coerce.number().int().min(0).max(50).default(0),
});

/**
 * GET /v1/market — 지금 시즌의 열린 등록. 시즌 사이 휴식기면 season null · 빈 목록. 모두에게 같은 응답이라 엣지에
 * 담는다 — 내 등록인지는 화면이 /v1/market/me의 listings와 id로 맞춘다.
 */
export const MarketListResponseSchema = z.strictObject({
  season: z.number().int().min(0).nullable(),
  items: z.array(MarketListingSchema),
  hasMore: z.boolean(),
  rules: MarketRulesSchema,
});
export type MarketListResponse = z.infer<typeof MarketListResponseSchema>;

export const MarketTradeSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['sold', 'bought', 'released']),
  /** 판매는 받은 돈(가격 − 수수료), 영입은 낸 돈, 방출은 받은 자금. */
  amount: man,
  at: IsoUtcSchema,
  card: z.strictObject({
    careerId: z.string(),
    pos: CareerPosSchema,
    peak: z.number().int(),
    number: z.number().int().nullable(),
    publicName: z.string().nullable(),
  }),
});
export type MarketTrade = z.infer<typeof MarketTradeSchema>;

/** GET /v1/market/me — 내 자금 · 구단 가치 · 열린 등록 · 최근 거래. */
export const MarketMeResponseSchema = z.strictObject({
  season: z.number().int().min(0).nullable(),
  balance: man,
  /** 구단 가치 = 자금 + 내가 가진 직접 키운 선수 은퇴 가치 + 영입한 선수 기준가. */
  clubValue: man,
  listings: z.array(MarketListingSchema),
  trades: z.array(MarketTradeSchema),
  /** 오늘(한국 시각) 남은 영입 수. */
  buysLeft: z.number().int().min(0),
  rules: MarketRulesSchema,
});
export type MarketMeResponse = z.infer<typeof MarketMeResponseSchema>;

export const CreateListingBodySchema = z.strictObject({
  careerId: CareerIdParamSchema,
  price: z.number().int().min(1),
});
export type CreateListingBody = z.infer<typeof CreateListingBodySchema>;
export const CreateListingResponseSchema = z.strictObject({ listing: MarketListingSchema });
export type CreateListingResponse = z.infer<typeof CreateListingResponseSchema>;

/** 구매는 화면에서 본 가격을 함께 보낸다 — 그 사이 값이 바뀌었으면 사지 않는다. */
export const BuyListingBodySchema = z.strictObject({ price: z.number().int().min(1) });
export type BuyListingBody = z.infer<typeof BuyListingBodySchema>;
export const BuyListingResponseSchema = z.strictObject({ balance: man });
export type BuyListingResponse = z.infer<typeof BuyListingResponseSchema>;

export const ReleaseCardsBodySchema = z.strictObject({
  careerIds: z.array(CareerIdParamSchema).min(1).max(RELEASE_MAX),
});
export type ReleaseCardsBody = z.infer<typeof ReleaseCardsBodySchema>;
export const ReleaseCardsResponseSchema = z.strictObject({
  released: z.number().int().min(0),
  amount: man,
  balance: man,
});
export type ReleaseCardsResponse = z.infer<typeof ReleaseCardsResponseSchema>;
