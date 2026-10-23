// T-11-454 웹 결제(엑솔라 Pay Station). 설정은 구단주 화면 상점이 열릴 때 한 번 묻는다(10분 메모). 상품을 고르면 서버가
// 만든 결제창 주소로 같은 탭에서 가고, 끝나면 `/?webpay=<주문>`으로 돌아온다. 아이템은 엑솔라 웹훅이 서버에서 주므로 웹은 주문
// 상태만 몇 번 묻는다. 그 사이 확인이 안 되면 주문을 기기에 두고 다음에 상점을 열 때 한 번 더 묻는다.
import { clearApiCache } from '@offside/app-core/api/client';
import {
  createWebPayOrder,
  fetchWebPayConfig,
  fetchWebPayOrder,
  type WebPayConfigResponse,
} from '@offside/app-core/api/webPay';
import { webPayText as L } from '@offside/app-core/i18n/ko/webPay';
import { toast } from '../helpers.js';
import { go } from '../nav.js';

const PENDING_KEY = 'ft_webpay_pending';
const ORDER_ID = /^wp_[a-f0-9]{32}$/;
/** 결제창에서 돌아와 상태를 묻는 간격 · 횟수(웹훅은 보통 몇 초 안에 온다). */
const POLL_MS = 2000;
const POLL_TRIES = 6;
/** 하루가 지난 미확인 주문은 결제하지 않은 것으로 보고 잊는다. */
const PENDING_TTL_MS = 24 * 3600_000;

export const webPay = $state<{ config: WebPayConfigResponse | null; busy: boolean }>({
  config: null,
  busy: false,
});

let loading: Promise<void> | null = null;
export function loadWebPay() {
  loading ??= fetchWebPayConfig().then((r) => {
    if (r.ok) webPay.config = r.data;
    else loading = null;
  });
  void checkPending();
  return loading;
}

type Pending = { orderId: string; at: number };
function readPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null;
    return p &&
      typeof p.orderId === 'string' &&
      ORDER_ID.test(p.orderId) &&
      typeof p.at === 'number'
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
    // 저장소를 못 써도 아이템은 웹훅이 준다. 다음 방문 때 알림만 못 띄운다.
  }
}

/** 주문 상태를 한 번 묻는다. 끝났으면(지급 · 환불 · 없는 주문) 기기에서 지우고 true. */
async function settle(orderId: string): Promise<boolean> {
  const r = await fetchWebPayOrder(orderId);
  if (!r.ok) {
    if (r.error.retryable) return false;
    writePending(null);
    return true;
  }
  if (r.data.status === 'READY') return false;
  writePending(null);
  if (r.data.status === 'PAID') {
    clearApiCache();
    toast(L.done);
  } else toast(L.canceled);
  return true;
}

async function checkPending() {
  const p = readPending();
  if (!p) return;
  if (Date.now() - p.at > PENDING_TTL_MS) return writePending(null);
  await settle(p.orderId);
}

/** 상품을 고르면 주문을 만들고 엑솔라 결제창으로 간다. */
export async function startWebPay(productId: string) {
  if (webPay.busy) return;
  webPay.busy = true;
  toast(L.opening);
  const r = await createWebPayOrder(productId);
  if (!r.ok) {
    webPay.busy = false;
    return toast(r.error.message || L.startFail);
  }
  writePending({ orderId: r.data.orderId, at: Date.now() });
  location.assign(r.data.payUrl);
}

/** main.ts: 엑솔라 결제창에서 돌아왔을 때(`?webpay=<주문>`). 주소를 정리하고 구단주 화면에서 결과를 기다린다. */
export async function handleWebPayReturn() {
  const orderId = new URLSearchParams(location.search).get('webpay') ?? '';
  window.history.replaceState({}, '', '/');
  go('owner');
  if (!ORDER_ID.test(orderId)) return;
  toast(L.confirming);
  for (let i = 0; i < POLL_TRIES; i += 1) {
    if (await settle(orderId)) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  toast(L.pending);
}
