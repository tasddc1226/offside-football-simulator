// T-11-454 웹 결제(토스페이먼츠 결제위젯 v2). 설정은 구단주 화면 상점이 열릴 때 한 번 묻고(10분 메모), 토스 SDK는
// '결제하기'를 누를 때만 불러온다(첫 화면 번들 · 다른 화면에는 싣지 않는다). 결제창은 같은 탭에서 토스로 갔다가
// `/?webpay=success|fail`로 돌아오고, 돌아온 값으로 서버에 승인을 부탁한다. 승인 응답을 못 받으면 값을 기기에 두고
// 다음에 상점을 열 때 다시 보낸다(서버가 같은 결제를 한 번만 준다).
import {
  confirmWebPay,
  fetchWebPayConfig,
  type WebPayConfigResponse,
} from '@offside/app-core/api/webPay';
import { webPayText as L } from '@offside/app-core/i18n/ko/webPay';
import { toast } from '../helpers.js';
import { go } from '../nav.js';

const SDK = 'https://js.tosspayments.com/v2/standard';
const PENDING_KEY = 'ft_webpay_pending';

export const webPay = $state<{ config: WebPayConfigResponse | null; confirming: boolean }>({
  config: null,
  confirming: false,
});

let loading: Promise<void> | null = null;
export function loadWebPay() {
  loading ??= fetchWebPayConfig().then((r) => {
    if (r.ok) webPay.config = r.data;
    else loading = null;
  });
  void retryPending();
  return loading;
}

type Pending = { paymentKey: string; orderId: string; amount: number };
function readPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null;
    return p &&
      typeof p.paymentKey === 'string' &&
      typeof p.orderId === 'string' &&
      typeof p.amount === 'number'
      ? p
      : null;
  } catch {
    return null;
  }
}
function writePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // 저장소를 못 쓰면 이번 탭에서만 다시 시도할 수 없다(결제는 토스가 10분 뒤 자동 취소한다).
  }
}

async function confirm(p: Pending) {
  if (webPay.confirming) return;
  webPay.confirming = true;
  const r = await confirmWebPay(p);
  webPay.confirming = false;
  if (r.ok) {
    writePending(null);
    return toast(L.done);
  }
  writePending(r.error.retryable ? p : null);
  toast(r.error.retryable ? L.claimFail : r.error.message || L.failed);
}

async function retryPending() {
  const p = readPending();
  if (p) await confirm(p);
}

/** main.ts: 토스 결제창에서 돌아왔을 때(`?webpay=`). 주소를 정리하고 구단주 화면에서 승인한다. */
export function handleWebPayReturn() {
  const q = new URLSearchParams(location.search);
  const result = q.get('webpay');
  window.history.replaceState({}, '', '/');
  go('owner');
  if (result === 'fail')
    return toast(q.get('code') === 'PAY_PROCESS_CANCELED' ? L.canceled : L.failed);
  const paymentKey = q.get('paymentKey');
  const orderId = q.get('orderId');
  const amount = Number(q.get('amount'));
  if (!paymentKey || !orderId || !Number.isInteger(amount)) return toast(L.failed);
  toast(L.confirming);
  void confirm({ paymentKey, orderId, amount });
}

// ── 토스 결제위젯 ──
type Widgets = {
  setAmount(a: { currency: 'KRW'; value: number }): Promise<void>;
  renderPaymentMethods(o: { selector: string; variantKey?: string }): Promise<unknown>;
  renderAgreement(o: { selector: string; variantKey?: string }): Promise<unknown>;
  requestPayment(o: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  }): Promise<void>;
};
type TossPaymentsFn = (clientKey: string) => { widgets(o: { customerKey: string }): Widgets };

let sdk: Promise<TossPaymentsFn> | null = null;
function loadSdk(): Promise<TossPaymentsFn> {
  sdk ??= new Promise<TossPaymentsFn>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK;
    s.async = true;
    s.onload = () => {
      const fn = (window as unknown as { TossPayments?: TossPaymentsFn }).TossPayments;
      if (fn) resolve(fn);
      else reject(new Error('TossPayments missing'));
    };
    s.onerror = () => reject(new Error('TossPayments load failed'));
    document.head.appendChild(s);
  }).catch((e: unknown) => {
    sdk = null;
    throw e;
  });
  return sdk;
}

/** 결제 수단 · 약관 위젯을 그린다. 같은 위젯에 금액만 바꿔 다시 쓴다. */
export async function mountWidgets(
  config: WebPayConfigResponse,
  amount: number,
  methods: string,
  agreement: string,
) {
  const TossPayments = await loadSdk();
  const widgets = TossPayments(config.clientKey!).widgets({ customerKey: config.customerKey! });
  await widgets.setAmount({ currency: 'KRW', value: amount });
  await Promise.all([
    widgets.renderPaymentMethods({ selector: methods, variantKey: 'DEFAULT' }),
    widgets.renderAgreement({ selector: agreement, variantKey: 'AGREEMENT' }),
  ]);
  return widgets;
}

export const returnUrls = () => ({
  successUrl: `${location.origin}/?webpay=success`,
  failUrl: `${location.origin}/?webpay=fail`,
});
