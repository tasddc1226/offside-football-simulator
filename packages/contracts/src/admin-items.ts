// T-11-263 운영 도구 아이템 지급 · 매출 상수. zod 없는 서브패스(`@offside/contracts/admin-items`) — API 모양은 admin-users.ts.
import { IAP_PRODUCTS, type IapProductId } from './cup.js';

/** 한 번에 지급·회수할 수 있는 장수 상한. */
export const ADMIN_GRANT_MAX = 100;

/**
 * 상품별 한국 정가(원). 스토어가 나라마다 환산하고 수수료를 떼므로 매출 탭의 금액은 "정가 기준 추정"이다. 광고 제거는 비소모성이라
 * 서버 구매 기록이 없고 스토어 알림(billing_alerts)으로만 센다.
 */
export const REMOVE_ADS_PRODUCT = 'com.offsidelab.app.remove_ads';
export const IAP_PRICE_KRW: Record<IapProductId | typeof REMOVE_ADS_PRODUCT, number> = {
  'com.offsidelab.app.reroll_5': 1100,
  'com.offsidelab.app.reroll_15': 2200,
  'com.offsidelab.app.reroll_40': 5500,
  'com.offsidelab.app.boost_3': 1100,
  'com.offsidelab.app.boost_10': 2200,
  'com.offsidelab.app.scout_1': 1100,
  'com.offsidelab.app.scout_5': 4400,
  'com.offsidelab.app.rename_5': 1100,
  [REMOVE_ADS_PRODUCT]: 6600,
};

/**
 * T-11-574 광고 제거 정가를 3,300원에서 6,600원으로 올린 시각(두 스토어 변경 직후). 매출 추정은 판매 시각의 정가로 세서
 * 지난 판매를 새 가격으로 다시 세지 않는다.
 */
export const REMOVE_ADS_PRICE_CHANGED_AT = '2026-10-29T08:00:00.000Z';
export const REMOVE_ADS_PRICE_BEFORE_KRW = 3300;
/** created_at 열 기준 광고 제거 정가 SQL 식(값은 코드 상수라 그대로 넣는다). */
export const REMOVE_ADS_PRICE_SQL = `CASE WHEN created_at >= '${REMOVE_ADS_PRICE_CHANGED_AT}' THEN ${IAP_PRICE_KRW[REMOVE_ADS_PRODUCT]} ELSE ${REMOVE_ADS_PRICE_BEFORE_KRW} END`;
export const iapProduct = (productId: string) =>
  Object.hasOwn(IAP_PRODUCTS, productId) ? IAP_PRODUCTS[productId as IapProductId] : null;

export const ADMIN_REVENUE_DAYS = [1, 7, 30, 90] as const;
