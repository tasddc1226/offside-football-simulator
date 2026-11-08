/**
 * 잠재력 강화권 · 프리미엄 스카우트권 구매 퍼널 계측 계약(웹 · 앱 공용). GA4 이벤트 `commerce_stage` 하나에 단계를 싣는다.
 * 매출 이벤트가 아니다: purchase · in_app_purchase · 금액 · 통화 · 가격은 싣지 않고, 매출 근거는 서버 거래 원장이다.
 *
 * 단계(stage)의 뜻. 한 번의 구매 시도는 offer_select → checkout_request → 끝 하나로 이어진다.
 * - offer_view: 살 수 있는 묶음(가격을 받은 활성 버튼)이 화면 안에 절반 이상 보임. 웹은 IntersectionObserver, 앱은 지금 화면
 *   스크롤 창 기준 측정(ui/scroll measureShown). 마운트 · 펼침만으로는 남기지 않고, 잴 수 없으면 남기지 않는다. 자리마다 한 번.
 *   그 순간 동의 · SDK · 태그가 준비되지 않았으면 그 자리의 노출은 버린다(나중에 다시 보내지 않아 노출을 적게 셀 수 있다).
 * - offer_select: 활성 묶음 버튼을 직접 누름(결제 중이라 막힌 버튼은 누를 수 없어 남지 않는다).
 * - checkout_request: 앱은 스토어 결제창을 실제로 요청함(스토어 연결 뒤 requestPurchase 호출 직전), 웹은 주문 생성 요청
 *   (POST /v1/web-pay/orders)을 보내기 직전. 웹의 주문 응답 뒤 실패(checkout_error)는 그 사이 계정 · 동의가 바뀌지 않았을 때만.
 * - checkout_pending: 앱 스토어가 보류(가족 승인 · 현금 결제 등)를 알림. 이 시도의 성공은 더 남기지 않는다.
 * - checkout_cancel: 앱 스토어가 사용자 취소(UserCancelled)를 알림.
 * - checkout_error: 결제를 시작하지 못하거나 스토어가 취소가 아닌 오류를 알림(reason).
 * - grant_ack: (앱만) 기존 서버 확인 · 지급 응답(POST /v1/items/iap)이 성공으로 돌아옴. 스토어 콜백만으로는 남기지 않는다.
 *   진단용 확인이지 '새 구매 정확히 한 번'이 아니다: 서버 응답에는 새 지급인지 알리는 값이 없어 스토어 거래 시각이 시도 시작
 *   이후인 거래만 인정한다(시계 여유 없음: 시도 1초 전 거래도 제외. 기기 시계가 스토어보다 빠르면 진짜 구매도 빠져 적게
 *   센다). 구매 수 · 매출은 서버 원장으로 센다.
 * - grant_fail: (앱만) 이 시도의 서버 확인이 실패함(reason: 다시 하면 될 실패 / 거절).
 * 앱 재실행 · '지급 다시 확인' 복구와 같은 거래의 중복 콜백은 새 시도도 성공도 남기지 않는다(시도 상태가 없다).
 * 웹(엑솔라)은 결제창이 같은 탭을 떠나 시도를 메모리로 이어 갈 수 없어 checkout_request까지만 남긴다. 결제창 닫기 · 돌아옴 ·
 * 포커스 · 잔액 변화로 취소 · 보류 · 성공을 짓지 않고, 새 기기 저장(주문 id 표시)도 만들지 않는다.
 */
import { IAP_PRODUCTS } from '@offside/contracts/cup';

export const COMMERCE_EVENT = 'commerce_stage';
/** 이 계약의 판. 바뀌면 올려 GA4에서 나눠 본다. */
export const COMMERCE_CONTRACT = '1';
export const COMMERCE_STAGES = [
  'offer_view',
  'offer_select',
  'checkout_request',
  'checkout_pending',
  'checkout_cancel',
  'checkout_error',
  'grant_ack',
  'grant_fail',
] as const;
export const COMMERCE_ITEMS = ['boost', 'scout'] as const;
/** shop = 상점 화면(강화권 · 스카우트권 카드), player_tab = 경기 화면 선수 탭 잠재력 강화 카드. */
export const COMMERCE_ENTRIES = ['shop', 'player_tab'] as const;
export const COMMERCE_STORES = ['apple', 'google', 'xsolla'] as const;
export const COMMERCE_REASONS = [
  'store_unavailable',
  'start_failed',
  'store_error',
  'grant_retryable',
  'grant_rejected',
] as const;
const PACK_SIZES: readonly number[] = [1, 3, 5, 10, 50, 100];
const REASON_STAGES: readonly CommerceStage[] = ['checkout_error', 'grant_fail'];

export type CommerceStage = (typeof COMMERCE_STAGES)[number];
export type CommerceItem = (typeof COMMERCE_ITEMS)[number];
export type CommerceEntry = (typeof COMMERCE_ENTRIES)[number];
export type CommerceStore = (typeof COMMERCE_STORES)[number];
export type CommerceReason = (typeof COMMERCE_REASONS)[number];
export type CommerceOffer = {
  item: CommerceItem;
  entry: CommerceEntry;
  store: CommerceStore;
  /** 묶음 장수. 자리 전체 노출(offer_view)에는 없다. */
  packSize?: number;
};
export type CommerceObservation = CommerceOffer & { stage: CommerceStage; reason?: CommerceReason };

const has = <T>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

/** 상품 id → 계측 대상 묶음. 강화권 · 스카우트권이 아니면(리롤권 · 이름 변경권 · 패스 · 멤버십) null. */
export function commerceOffer(
  productId: unknown,
  entry: CommerceEntry,
  store: CommerceStore,
): CommerceOffer | null {
  if (typeof productId !== 'string' || !Object.hasOwn(IAP_PRODUCTS, productId)) return null;
  const p = IAP_PRODUCTS[productId as keyof typeof IAP_PRODUCTS];
  if (!has(COMMERCE_ITEMS, p.item)) return null;
  return { item: p.item, entry, store, packSize: p.qty };
}

/** 허용 목록으로만 매개변수를 만든다. 목록 밖 값이 하나라도 있으면 보내지 않는다(null). */
export function commerceParams(o: unknown): Record<string, string | number> | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (
    !has(COMMERCE_STAGES, x.stage) ||
    !has(COMMERCE_ITEMS, x.item) ||
    !has(COMMERCE_ENTRIES, x.entry) ||
    !has(COMMERCE_STORES, x.store)
  )
    return null;
  const out: Record<string, string | number> = {
    commerce_contract: COMMERCE_CONTRACT,
    stage: x.stage,
    offer_item: x.item,
    entrypoint: x.entry,
    store: x.store,
  };
  if (x.packSize !== undefined) {
    if (!has(PACK_SIZES, x.packSize)) return null;
    out.pack_size = x.packSize;
  }
  if (x.reason !== undefined) {
    if (!has(COMMERCE_REASONS, x.reason) || !REASON_STAGES.includes(x.stage)) return null;
    out.reason = x.reason;
  }
  return out;
}

/** 결제 완료 콜백에서 맞춰 보는 값(기기 안에서만 쓰고 보내지 않는다). */
export type StorePurchaseRef = { id?: unknown; productId: string; transactionDate?: unknown };
type Attempt = { offer: CommerceOffer; productId: string; startedAt: number; epoch: number };
/** 서버 확인에 넘기는 표. 계정 · 동의가 바뀌면(epoch) 더는 남기지 않는다. */
export type CheckoutTicket = { offer: CommerceOffer; epoch: number };

/**
 * 앱 스토어 결제 시도 상태. 한 번에 하나(스토어 결제창은 하나만 뜬다). 끝 단계(취소 · 보류 · 오류 · 서버 확인에 넘김)에서
 * 시도를 비워, 늦게 오거나 겹쳐 온 콜백 · 복구 지급은 아무것도 남기지 않는다.
 * - epoch: 계정이 바뀌거나 이용 분석 동의가 바뀌면 reset()으로 올린다. 이미 서버 확인 중인 표(ticket)와 SDK 줄에 올라간 전송도
 *   emit에 넘긴 alive()로 실제 전송 직전에 다시 보고 버린다.
 * - 같은 상품의 옛 거래: 서버 응답에는 새 지급인지 알리는 값이 없다. 그래서 거래 id를 이미 본 적 있거나, 거래 시각이 시도
 *   시작(버튼을 누른 순간의 기기 시각)보다 이르거나, 시각 · id를 알 수 없으면 애매한 콜백으로 보고 시도를 버린다(성공을 짓지
 *   않는다). 시계 여유를 두지 않아, 시계 차이로 진짜 구매가 빠지는 쪽(적게 셈)을 택했다.
 * emit이 던져도 결제 흐름에는 닿지 않는다.
 */
export function createCheckoutFunnel(
  emit: (o: CommerceObservation, alive: () => boolean) => void,
  now: () => number = () => Date.now(),
) {
  let attempt: Attempt | null = null;
  let epoch = 0;
  const seen = new Set<string>();
  const remember = (id: unknown) => {
    if (typeof id !== 'string' || !id) return;
    seen.delete(id);
    seen.add(id);
    if (seen.size > 100) seen.delete(seen.values().next().value!);
  };
  const out = (stage: CommerceStage, offer: CommerceOffer, at: number, reason?: CommerceReason) => {
    if (at !== epoch) return;
    try {
      emit({ ...offer, stage, ...(reason ? { reason } : {}) }, () => at === epoch);
    } catch {
      /* 계측은 결제 · 지급 · 화면에 영향을 주지 않는다. */
    }
  };
  const end = (stage: CommerceStage, reason?: CommerceReason) => {
    const a = attempt;
    attempt = null;
    if (a) out(stage, a.offer, a.epoch, reason);
  };
  return {
    /** 묶음 자리가 화면에 보임(packSize 없이 자리 단위). */
    view(offer: Omit<CommerceOffer, 'packSize'> | null) {
      if (offer) out('offer_view', offer, epoch);
    },
    /** 활성 묶음 버튼을 누르고 결제를 시작함. 계측 대상이 아니면 이전 시도만 비운다. */
    begin(productId: string, offer: CommerceOffer | null) {
      attempt = offer ? { offer, productId, startedAt: now(), epoch } : null;
      if (offer) out('offer_select', offer, epoch);
    },
    /** 스토어 결제창을 실제로 요청하기 직전. */
    requested() {
      if (attempt) out('checkout_request', attempt.offer, attempt.epoch);
    },
    fail: (reason: Extract<CommerceReason, 'store_unavailable' | 'start_failed' | 'store_error'>) =>
      end('checkout_error', reason),
    cancel: () => end('checkout_cancel'),
    pending: () => end('checkout_pending'),
    /** 이미 스토어에 남아 있던 거래(앱 시작 · 동기화 · 복구에서 본 것). 이 id는 새 시도의 성공이 될 수 없다. */
    known(p: StorePurchaseRef) {
      remember(p.id);
    },
    /**
     * 결제 완료 콜백. 지금 시도의 새 거래로 확실할 때만 표를 꺼낸다. 시도가 있는데 애매하면 시도를 버린다(null).
     * 두 번째 콜백 · 복구 지급에는 시도가 없어 null.
     */
    take(p: StorePurchaseRef): CheckoutTicket | null {
      const a = attempt;
      const fresh =
        !!a &&
        a.productId === p.productId &&
        typeof p.id === 'string' &&
        !!p.id &&
        !seen.has(p.id) &&
        typeof p.transactionDate === 'number' &&
        Number.isFinite(p.transactionDate) &&
        p.transactionDate >= a.startedAt;
      remember(p.id);
      if (a && a.productId === p.productId) attempt = null;
      return fresh && a!.epoch === epoch ? { offer: a!.offer, epoch: a!.epoch } : null;
    },
    granted(t: CheckoutTicket | null) {
      if (t) out('grant_ack', t.offer, t.epoch);
    },
    grantFailed(t: CheckoutTicket | null, retryable: boolean) {
      if (t) out('grant_fail', t.offer, t.epoch, retryable ? 'grant_retryable' : 'grant_rejected');
    },
    /** 계정 또는 이용 분석 동의가 바뀜: 진행 중 시도 · 서버 확인 중 표 · 줄에 올라간 전송을 모두 버린다. */
    reset() {
      attempt = null;
      epoch++;
    },
  };
}
export type CheckoutFunnel = ReturnType<typeof createCheckoutFunnel>;
