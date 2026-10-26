import { z } from 'zod';
import { ADMIN_GRANT_MAX, ADMIN_REVENUE_DAYS } from './admin-items.js';
import { OWNER_ITEMS } from './cup.js';
import { IsoUtcSchema } from './primitives.js';

// ───────── T-11-263 운영 도구: 유저 조회 · 아이템 지급/회수 · 매출 ─────────

export const AdminProfileIdSchema = z.string().regex(/^prf_[0-9a-f-]{36}$/);

/** `GET /v1/admin/users?q=` 프로필 id(prf_…) · 닉네임(대소문자 무시) · 친구 코드. */
export const AdminUserQuerySchema = z.string().trim().min(1).max(64);

const int = z.number().int();

export const AdminUserSchema = z.object({
  generatedAt: IsoUtcSchema,
  profile: z.object({
    id: z.string(),
    nickname: z.string().nullable(),
    friendCode: z.string().nullable(),
    title: z.string().nullable(),
    createdAt: z.string(),
    lastSeenAt: z.string(),
    deletedAt: z.string().nullable(),
    google: z.boolean(),
    apple: z.boolean(),
    toss: z.boolean(),
    recoveryIssuedAt: z.string().nullable(),
  }),
  /** 접속 채널별 유효 세션 수와 마지막 접속(만료·폐기 세션은 마지막 접속에만 든다). */
  sessions: z.array(z.object({ channel: z.string(), active: int, lastSeenAt: z.string() })),
  /** 푸시 등록 기기(최근 순, 최대 5). */
  devices: z.array(
    z.object({ platform: z.string(), appVersion: z.string(), updatedAt: z.string() }),
  ),
  careers: z.object({
    total: int,
    active: int,
    retired: int,
    recent: z.array(
      z.object({
        id: z.string(),
        pos: z.string(),
        status: z.string(),
        createdAt: z.string(),
        retiredAt: z.string().nullable(),
        peak: int.nullable(),
        legendScore: int.nullable(),
        hidden: z.boolean(),
      }),
    ),
  }),
  teams: z.array(
    z.object({
      season: int,
      name: z.string(),
      ovr: int,
      filled: int,
      rating: int,
      wins: int,
      draws: int,
      losses: int,
    }),
  ),
  cups: z.array(
    z.object({
      cupId: z.string(),
      /** 신청 때 팀 이름. */
      team: z.string(),
      status: z.string(),
      stage: z.string().nullable(),
      rewardedAt: z.string().nullable(),
    }),
  ),
  /** 구단 자금(만 원 단위). 자금 행이 없으면 null. */
  funds: int.nullable(),
  /** 보유 아이템 장수(reroll · boost · scout). */
  items: z.record(z.string(), int),
  /** 앱 결제(최근 순, 최대 50). */
  purchases: z.array(
    z.object({
      store: z.string(),
      productId: z.string(),
      item: z.string(),
      qty: int,
      test: z.boolean(),
      createdAt: z.string(),
      refundedAt: z.string().nullable(),
      revokedQty: int,
    }),
  ),
  /** 구단 자금으로 산 것(최근 순, 최대 20). */
  fundsPurchases: z.array(
    z.object({ item: z.string(), qty: int, price: int, createdAt: z.string() }),
  ),
  /** 운영자 지급·회수(최근 순, 최대 20). */
  grants: z.array(
    z.object({
      item: z.string(),
      delta: int,
      reason: z.string(),
      by: z.string(),
      createdAt: z.string(),
    }),
  ),
  scout: z.object({ used: int, streak: int, elites: int }),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

/** `POST /v1/admin/users/:profileId/items` delta > 0 지급, < 0 회수(가진 것보다 많이는 못 뺀다). notify면 지급 알림을 보낸다. */
export const AdminItemGrantInputSchema = z.strictObject({
  item: z.enum(OWNER_ITEMS),
  delta: z
    .number()
    .int()
    .min(-ADMIN_GRANT_MAX)
    .max(ADMIN_GRANT_MAX)
    .refine((v) => v !== 0),
  reason: z.string().trim().min(2).max(200),
  notify: z.boolean().default(true),
});
export type AdminItemGrantInput = z.input<typeof AdminItemGrantInputSchema>;
export const AdminItemGrantResultSchema = z.object({ item: z.enum(OWNER_ITEMS), qty: int });
export type AdminItemGrantResult = z.infer<typeof AdminItemGrantResultSchema>;

export const AdminRevenueQuerySchema = z.coerce
  .number()
  .int()
  .refine((d) => (ADMIN_REVENUE_DAYS as readonly number[]).includes(d))
  .default(7);

const RevenueSum = z.object({ count: int, krw: int });
export const AdminRevenueSchema = z.object({
  generatedAt: IsoUtcSchema,
  days: int,
  /** 기간 합(환불 뺀). refunds = 기간에 환불된 건(구매 시각과 무관). */
  total: RevenueSum.extend({ buyers: int, firstBuyers: int, refunds: int, refundKrw: int }),
  /** 전체 기간 합(환불 뺀, 소모성만). */
  allTime: RevenueSum.extend({ buyers: int }),
  /** KST 날짜별(기간이 1일이면 오늘 하루). adCount · adKrw = 그날 광고 제거 구매 알림(T-11-484, 환불 빼기 전). */
  daily: z.array(
    RevenueSum.extend({ day: z.string(), adCount: int.optional(), adKrw: int.optional() }),
  ),
  products: z.array(RevenueSum.extend({ productId: z.string(), refunded: int })),
  stores: z.array(RevenueSum.extend({ store: z.string() })),
  /** 광고 제거(스토어 알림 기준). since = 알림 기록이 시작된 시각. 서버 원장(iap_purchases) 밖이라 위 합에 없다.
   * T-11-484 allTime = 전체 기간, stores = 기간 안 스토어별. */
  removeAds: z.object({
    count: int,
    refunds: int,
    krw: int,
    since: z.string().nullable(),
    allTime: z.object({ count: int, refunds: int, krw: int }).optional(),
    stores: z.array(z.object({ store: z.string(), count: int, refunds: int })).optional(),
  }),
  recent: z.array(
    z.object({
      store: z.string(),
      productId: z.string(),
      profileId: z.string(),
      nickname: z.string().nullable(),
      createdAt: z.string(),
      refundedAt: z.string().nullable(),
    }),
  ),
});
export type AdminRevenue = z.infer<typeof AdminRevenueSchema>;
