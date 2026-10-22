import type { Bindings } from '../env.js';
import { iapAccount } from './verify.js';

// T-11-454 토스페이먼츠 결제 승인 · 조회(API v1, 시크릿 키 Basic 인증). 결제창(v2 SDK)은 웹이 띄우고, 서버는 결제창이 돌려준
// paymentKey로 승인하고 상태를 다시 조회만 한다. 웹훅 본문은 믿지 않고 paymentKey로 토스에 다시 묻는다.

const TOSS_API = 'https://api.tosspayments.com/v1/payments';

/** 토스 결제 객체 중 쓰는 칸. */
export type TossPayment = {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  method: string | null;
  approvedAt: string | null;
};
export type TossResult = { ok: true; payment: TossPayment } | { ok: false; code: string };

/** 이 구단주가 웹에서 살 수 있는지. 키가 둘 다 있고 스위치가 켜져 있어야 하며, WEB_PAY_TESTERS가 있으면 그 구단주만 산다. */
export function webPayEnabled(env: Bindings, profileId: string): boolean {
  if (env.WEB_PAY_ENABLED !== '1' || !env.TOSS_CLIENT_KEY || !env.TOSS_SECRET_KEY) return false;
  return (
    !env.WEB_PAY_TESTERS || env.WEB_PAY_TESTERS.split(',').some((id) => id.trim() === profileId)
  );
}

/** 결제창에 넘기는 구단주 표시(인앱 구매의 구단주 표시와 같은 uuid). */
export const webPayCustomerKey = iapAccount;

/** 테스트 키(test_sk_ · test_gsk_)로 승인한 결제는 매출에서 뺀다. */
export const tossTest = (env: Bindings) => (env.TOSS_SECRET_KEY ?? '').startsWith('test_');

const auth = (env: Bindings) => `Basic ${btoa(`${env.TOSS_SECRET_KEY ?? ''}:`)}`;

function paymentOf(body: unknown): TossPayment | null {
  const p = body as Partial<Record<keyof TossPayment, unknown>> | null;
  if (
    !p ||
    typeof p.paymentKey !== 'string' ||
    typeof p.orderId !== 'string' ||
    typeof p.status !== 'string' ||
    typeof p.totalAmount !== 'number'
  )
    return null;
  return {
    paymentKey: p.paymentKey,
    orderId: p.orderId,
    status: p.status,
    totalAmount: p.totalAmount,
    method: typeof p.method === 'string' ? p.method.slice(0, 40) : null,
    approvedAt: typeof p.approvedAt === 'string' ? p.approvedAt : null,
  };
}

/** 토스 응답을 읽는다. 4xx는 토스 오류 코드, 5xx · 형식 오류는 던진다(웹이 다시 승인을 보낸다). */
async function read(res: Response): Promise<TossResult> {
  const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
  if (res.ok) {
    const payment = paymentOf(body);
    if (payment) return { ok: true, payment };
    throw new Error('toss: unexpected payment body');
  }
  if (res.status >= 500 || typeof body?.code !== 'string') throw new Error(`toss: ${res.status}`);
  return { ok: false, code: body.code };
}

/** 결제 승인. 같은 주문의 재승인은 Idempotency-Key로 토스가 같은 결과를 돌려준다. */
export async function confirmTossPayment(
  env: Bindings,
  input: { paymentKey: string; orderId: string; amount: number },
  fetcher: typeof fetch = fetch,
): Promise<TossResult> {
  const res = await fetcher(`${TOSS_API}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: auth(env),
      'Content-Type': 'application/json',
      'Idempotency-Key': `confirm-${input.orderId}`,
    },
    body: JSON.stringify(input),
  });
  return read(res);
}

/** 결제 조회(paymentKey). */
export async function getTossPayment(
  env: Bindings,
  paymentKey: string,
  fetcher: typeof fetch = fetch,
): Promise<TossResult> {
  const res = await fetcher(`${TOSS_API}/${encodeURIComponent(paymentKey)}`, {
    headers: { Authorization: auth(env) },
  });
  return read(res);
}
