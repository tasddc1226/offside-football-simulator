import { z } from 'zod';
import {
  CareerIdParamSchema,
  CareerPosSchema,
  DetailPosSchema,
  PeakProfileSchema,
} from './careers.js';
import { MARKET_CHART_RANGES } from './market-value.js';
import { IsoUtcSchema } from './primitives.js';
import { FUNDS_ITEMS, type FundsItem } from './cup.js';

export { MARKET_CHART_DAYS, MARKET_CHART_RANGES, type MarketChartRange } from './market-value.js';

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
  /** 선수 국적(없으면 기본 국적). 카드 상세에 그린다. */
  nation: z.string().nullable(),
  peak: z.number().int(),
  number: z.number().int().nullable(),
  publicName: z.string().nullable(),
  legendScore: z.number().int(),
  /** 카드 능력치 6개(옛 기록은 null). */
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
  page: z.coerce.number().int().min(0).max(10).default(0),
});

/** 이번 시즌에 팔린 선수(이적시장 화면의 '방금 이적' 띠). 판 사람·산 사람은 싣지 않는다. */
export const MarketSaleSchema = z.strictObject({
  id: ListingIdSchema,
  price: man,
  soldAt: IsoUtcSchema,
  card: MarketCardSchema,
});
export type MarketSale = z.infer<typeof MarketSaleSchema>;
/** '방금 이적' 띠에 싣는 최근 거래 수. */
export const MARKET_RECENT = 10;

/**
 * GET /v1/market — 지금 시즌의 열린 등록. 시즌 사이 휴식기면 season null · 빈 목록. 모두에게 같은 응답이라 엣지에
 * 담는다 — 내 등록인지는 화면이 /v1/market/me의 listings와 id로 맞춘다.
 */
export const MarketListResponseSchema = z.strictObject({
  season: z.number().int().min(0).nullable(),
  items: z.array(MarketListingSchema),
  hasMore: z.boolean(),
  /** 첫 페이지에만 싣는다(다음 페이지는 빈 배열). */
  recent: z.array(MarketSaleSchema),
});
export type MarketListResponse = z.infer<typeof MarketListResponseSchema>;

/** 시세 차트 조회. pos·band를 함께 주면 그 묶음(포지션군 · OVR대), 둘 다 없으면 시장 전체. */
export const MarketChartQuerySchema = z
  .strictObject({
    range: z.enum(MARKET_CHART_RANGES).default('week'),
    pos: CareerPosSchema.optional(),
    band: z.coerce.number().int().min(0).max(100).multipleOf(5).optional(),
  })
  .refine((q) => (q.pos === undefined) === (q.band === undefined), {
    message: 'pos와 band는 함께 보낸다.',
  });
export type MarketChartQuery = z.infer<typeof MarketChartQuerySchema>;

/** 하루치 시세(KST 일자). 비율은 기준가 대비 천분율(1000 = 기준가 그대로), 거래 대금은 만 원. */
export const MarketChartPointSchema = z.strictObject({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trades: z.number().int().min(1),
  volume: man,
  avg: z.number().int(),
  min: z.number().int(),
  max: z.number().int(),
});
export type MarketChartPoint = z.infer<typeof MarketChartPointSchema>;

/** GET /v1/market/chart — 모두에게 같은 응답이라 엣지에 담는다(1분). 시즌 사이 휴식기면 season null · 빈 배열. */
export const MarketChartResponseSchema = z.strictObject({
  season: z.number().int().min(0).nullable(),
  points: z.array(MarketChartPointSchema),
});
export type MarketChartResponse = z.infer<typeof MarketChartResponseSchema>;

/** GET /v1/market/cards/:careerId/trades — 이 선수가 팔린 기록(최신순). 판 사람·산 사람은 싣지 않는다. */
export const MarketCardTradesResponseSchema = z.strictObject({
  trades: z.array(z.strictObject({ price: man, ratio: z.number().int(), soldAt: IsoUtcSchema })),
});
export type MarketCardTradesResponse = z.infer<typeof MarketCardTradesResponseSchema>;

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

/** 구단 자금으로 산 것 하나(리롤권 · 광고 대신 받은 보상). 거래(trades)와 따로 둬 옛 앱이 모르는 줄을 그리다 깨지지 않게 한다. */
export const FundsSpendSchema = z.strictObject({
  id: z.string(),
  item: z.enum(FUNDS_ITEMS as unknown as [FundsItem, ...FundsItem[]]),
  amount: man,
  at: IsoUtcSchema,
});
export type FundsSpend = z.infer<typeof FundsSpendSchema>;

/** 자금 내역 한 줄(GET /v1/market/funds/history). amount는 잔액 변화(받으면 +, 쓰면 −). */
export const FundsHistoryEntrySchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['released', 'sold', 'bought', 'spent']),
  /** spent일 때 산 것. */
  item: z.enum(FUNDS_ITEMS as unknown as [FundsItem, ...FundsItem[]]).nullable(),
  amount: z.number().int(),
  /** sold일 때 뗀 수수료. */
  fee: man.nullable(),
  at: IsoUtcSchema,
  card: MarketTradeSchema.shape.card.nullable(),
});
export type FundsHistoryEntry = z.infer<typeof FundsHistoryEntrySchema>;

export const FundsHistoryQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(0).max(1000).default(0),
});

/** GET /v1/market/funds/history — 구단 자금 내역(최근 순, 페이지)과 지금까지 출처별 합. */
export const FundsHistoryResponseSchema = z.strictObject({
  balance: man,
  totals: z.strictObject({
    /** 방출로 받은 자금. */
    released: man,
    /** 판매로 받은 자금(수수료 뺀 값)과 뗀 수수료. */
    sold: man,
    fees: man,
    /** 영입에 쓴 자금. */
    bought: man,
    /** 리롤권 · 광고 대신 받은 보상에 쓴 자금. */
    spent: man,
  }),
  items: z.array(FundsHistoryEntrySchema),
  hasMore: z.boolean(),
});
export type FundsHistoryResponse = z.infer<typeof FundsHistoryResponseSchema>;

/** GET /v1/market/funds — 구단주 화면 요약용 구단 자금 · 구단 가치(이적시장 화면은 /v1/market/me). */
export const MarketFundsResponseSchema = z.strictObject({ balance: man, clubValue: man });
export type MarketFundsResponse = z.infer<typeof MarketFundsResponseSchema>;

/** GET /v1/market/me — 내 자금 · 구단 가치 · 열린 등록 · 최근 거래. */
export const MarketMeResponseSchema = z.strictObject({
  season: z.number().int().min(0).nullable(),
  balance: man,
  /** 구단 가치 = 자금 + 내가 가진 카드의 기준가 합(T-11-109). */
  clubValue: man,
  listings: z.array(MarketListingSchema),
  trades: z.array(MarketTradeSchema),
  /** T-11-153 구단 자금으로 산 것(최근 순). 자금 내역에 거래와 시각순으로 섞어 그린다. */
  spends: z.array(FundsSpendSchema),
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
