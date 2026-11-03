import { z } from 'zod';
import { IAP_PRICE_KRW } from './admin-items.js';
import { IAP_PRODUCT_IDS, IAP_PRODUCTS, OWNER_ITEMS } from './cup.js';
import { MEMBERSHIP_PRICE_KRW, MEMBERSHIP_PRODUCT_ID } from './membership-rules.js';
import { SEASON_PASS_PRICE_KRW, SEASON_PASS_PRODUCT_ID } from './season-pass-rules.js';

// T-11-454 웹 결제(엑솔라 Pay Station). 앱 인앱 상품과 같은 상품을 웹에서 해외 카드 · PayPal · 나라별 결제 수단으로 판다.
// 엑솔라 상품 카탈로그의 SKU는 앱 상품 id와 같고, 나라별 가격 · 통화 · 세금은 엑솔라가 정한다(한국 기준가 = 앱 한국 정가).
// 구매 원장은 앱과 같은 iap_purchases이고 store만 'xsolla'다. 옛 앱이 엄격한 enum으로 읽는 IapStoreSchema · GET /v1/items의
// iap.stores에는 넣지 않고, 웹은 GET /v1/web-pay/config로 따로 본다.

export const WEB_PAY_STORE = 'xsolla';

/** 웹 결제 상품 목록(앱 상품 순서 그대로). amount는 한국 기준가(원). 실제 결제 금액 · 통화는 결제창이 나라에 맞춰 보인다. */
export const WEB_PAY_PRODUCTS = IAP_PRODUCT_IDS.map((productId) => ({
  productId,
  ...IAP_PRODUCTS[productId],
  amount: IAP_PRICE_KRW[productId],
}));

/**
 * T-11-591 웹에서 파는 시즌 패스 · 클럽 멤버십(광고 제거는 앱 전용). SKU는 앱 상품 id와 같다. 시즌 패스는 앱과 같은 시즌
 * 패스 원장(season_passes)에 store 'xsolla'로 열고, 멤버십은 자동 갱신 없이 결제 한 번에 WEB_MEMBERSHIP_DAYS일을 더한다.
 */
export const WEB_MEMBERSHIP_DAYS = 30;
export const WEB_PAY_PASS = {
  productId: SEASON_PASS_PRODUCT_ID,
  amount: SEASON_PASS_PRICE_KRW,
} as const;
export const WEB_PAY_MEMBERSHIP = {
  productId: MEMBERSHIP_PRODUCT_ID,
  amount: MEMBERSHIP_PRICE_KRW,
  days: WEB_MEMBERSHIP_DAYS,
} as const;
export const WEB_PAY_PRODUCT_IDS = [
  ...IAP_PRODUCT_IDS,
  SEASON_PASS_PRODUCT_ID,
  MEMBERSHIP_PRODUCT_ID,
] as const;

/** GET /v1/web-pay/config — 이 구단주가 웹에서 살 수 있는지. enabled가 false면 상품은 없다(상점은 앱 안내를 그대로 둔다). */
export const WebPayConfigResponseSchema = z.strictObject({
  enabled: z.boolean(),
  products: z
    .array(
      z.strictObject({
        productId: z.enum(IAP_PRODUCT_IDS),
        item: z.enum(OWNER_ITEMS),
        qty: z.number().int().min(1),
        amount: z.number().int().min(100),
      }),
    )
    .optional(),
  /** 지금 웹에서 파는 시즌 패스(판매 스위치가 켜지고 시즌 2가 열렸을 때만). */
  pass: z
    .strictObject({ productId: z.literal(SEASON_PASS_PRODUCT_ID), amount: z.number().int() })
    .optional(),
  /** 웹에서 파는 클럽 멤버십(한 번 결제에 days일, 자동 갱신 없음). */
  membership: z
    .strictObject({
      productId: z.literal(MEMBERSHIP_PRODUCT_ID),
      amount: z.number().int(),
      days: z.number().int().min(1),
    })
    .optional(),
});
export type WebPayConfigResponse = z.infer<typeof WebPayConfigResponseSchema>;

/** POST /v1/web-pay/orders — 주문을 만들고 엑솔라 결제창 주소를 돌려준다. */
export const WebPayOrderBodySchema = z.strictObject({ productId: z.enum(WEB_PAY_PRODUCT_IDS) });
export type WebPayOrderBody = z.infer<typeof WebPayOrderBodySchema>;

export const WEB_PAY_ORDER_ID = /^wp_[a-f0-9]{32}$/;
export const WebPayOrderResponseSchema = z.strictObject({
  orderId: z.string().regex(WEB_PAY_ORDER_ID),
  /** 엑솔라 결제창(Pay Station) 주소. 같은 탭에서 열고, 끝나면 `/?webpay=<orderId>`로 돌아온다. */
  payUrl: z
    .string()
    .regex(/^https:\/\/(sandbox-)?secure\.xsolla\.com\/paystation4\/\?token=[A-Za-z0-9._~%-]+$/),
});
export type WebPayOrderResponse = z.infer<typeof WebPayOrderResponseSchema>;

/**
 * GET /v1/web-pay/orders/:orderId — 결제창에서 돌아온 뒤 주문 상태. 아이템은 엑솔라 웹훅이 주므로 PAID가 될 때까지 몇 번
 * 묻는다. 내 주문이 아니면 404.
 */
export const WebPayOrderStatusResponseSchema = z.strictObject({
  status: z.enum(['READY', 'PAID', 'CANCELED']),
});
export type WebPayOrderStatusResponse = z.infer<typeof WebPayOrderStatusResponseSchema>;
