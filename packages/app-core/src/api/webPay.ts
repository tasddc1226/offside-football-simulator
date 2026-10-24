// T-11-454 웹 결제(엑솔라) API. 웹 상점만 쓴다(앱은 스토어 인앱 결제). 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  WebPayConfigResponse,
  WebPayOrderResponse,
  WebPayOrderStatusResponse,
} from '@offside/contracts';
import { apiFetch, ownerCachedGet, withLang } from './client.js';

export type { WebPayConfigResponse, WebPayOrderResponse } from '@offside/contracts';

// 상점 카드 여럿이 같이 묻는다(같은 요청은 하나로 합쳐진다). 켜고 끄는 일은 드물어 10분 메모한다.
export const fetchWebPayConfig = () =>
  ownerCachedGet<WebPayConfigResponse>('/v1/web-pay/config', 10 * 60_000);

/** 주문을 만들고 엑솔라 결제창 주소를 받는다(결제창 언어는 지금 화면 언어). */
export const createWebPayOrder = (productId: string) =>
  apiFetch<WebPayOrderResponse>(withLang('/v1/web-pay/orders'), {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });

/** 결제창에서 돌아온 뒤 주문 상태(메모하지 않는다 — 웹훅이 오면 바뀐다). */
export const fetchWebPayOrder = (orderId: string) =>
  apiFetch<WebPayOrderStatusResponse>(`/v1/web-pay/orders/${encodeURIComponent(orderId)}`);
