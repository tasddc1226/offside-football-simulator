// T-11-454 웹 결제(토스페이먼츠) API. 웹 상점만 쓴다(앱은 스토어 인앱 결제). 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  OwnerItemsResponse,
  WebPayConfigResponse,
  WebPayConfirmBody,
  WebPayOrderResponse,
} from '@offside/contracts';
import { apiFetch, ownerCachedGet } from './client.js';

export type { WebPayConfigResponse, WebPayOrderResponse } from '@offside/contracts';

// 상점 카드 여럿이 같이 묻는다(같은 요청은 하나로 합쳐진다). 켜고 끄는 일은 드물어 10분 메모한다.
export const fetchWebPayConfig = () =>
  ownerCachedGet<WebPayConfigResponse>('/v1/web-pay/config', 10 * 60_000);

export const createWebPayOrder = (productId: string) =>
  apiFetch<WebPayOrderResponse>('/v1/web-pay/orders', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });

/** 결제창에서 돌아온 값으로 승인한다. 같은 결제를 다시 보내도 서버가 한 번만 준다. */
export const confirmWebPay = (body: WebPayConfirmBody) =>
  apiFetch<OwnerItemsResponse>('/v1/web-pay/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
