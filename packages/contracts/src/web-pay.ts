import { z } from 'zod';
import { IAP_PRICE_KRW } from './admin-items.js';
import { IAP_PRODUCT_IDS, IAP_PRODUCTS, OWNER_ITEMS, type IapProductId } from './cup.js';

// T-11-454 웹 결제(토스페이먼츠). 앱 인앱 상품과 같은 상품 · 같은 한국 정가를 웹에서 카드 · 간편결제로 판다.
// 구매 원장은 앱과 같은 iap_purchases이고 store만 'toss'다. 옛 앱이 엄격한 enum으로 읽는 IapStoreSchema · GET /v1/items의
// iap.stores에는 넣지 않고, 웹은 GET /v1/web-pay/config로 따로 본다.

export const WEB_PAY_STORE = 'toss';

/** 웹 결제 상품 목록(앱 상품 순서 그대로). amount는 원 단위 결제 금액. */
export const WEB_PAY_PRODUCTS = IAP_PRODUCT_IDS.map((productId) => ({
  productId,
  ...IAP_PRODUCTS[productId],
  amount: IAP_PRICE_KRW[productId],
}));
export const webPayAmount = (productId: IapProductId) => IAP_PRICE_KRW[productId];

/**
 * GET /v1/web-pay/config — 이 구단주가 웹에서 살 수 있는지. enabled가 false면 나머지는 없다(상점은 앱 안내를 그대로 둔다).
 * customerKey는 결제창에 넘기는 구단주 표시(프로필 id에서 만든 uuid, 개인정보 없음).
 */
export const WebPayConfigResponseSchema = z.strictObject({
  enabled: z.boolean(),
  clientKey: z.string().min(1).optional(),
  customerKey: z.string().min(2).max(50).optional(),
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
});
export type WebPayConfigResponse = z.infer<typeof WebPayConfigResponseSchema>;

/** POST /v1/web-pay/orders — 주문을 만든다. 금액은 서버가 정한다. */
export const WebPayOrderBodySchema = z.strictObject({ productId: z.enum(IAP_PRODUCT_IDS) });
export type WebPayOrderBody = z.infer<typeof WebPayOrderBodySchema>;

export const WebPayOrderResponseSchema = z.strictObject({
  orderId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  amount: z.number().int().min(100),
  /** 결제창 · 영수증에 보일 상품 이름(한국어 저장값). */
  orderName: z.string().min(1).max(100),
});
export type WebPayOrderResponse = z.infer<typeof WebPayOrderResponseSchema>;

/**
 * POST /v1/web-pay/confirm — 결제창이 돌려준 값으로 결제를 승인하고 아이템을 준다(응답은 GET /v1/items와 같은 장수).
 * 같은 주문을 다시 보내도(새로고침) 한 번만 준다.
 */
export const WebPayConfirmBodySchema = z.strictObject({
  paymentKey: z.string().min(1).max(200),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  amount: z.number().int().min(100),
});
export type WebPayConfirmBody = z.infer<typeof WebPayConfirmBodySchema>;
