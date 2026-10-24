import type { Bindings } from '../env.js';

// T-11-454 엑솔라 Pay Station. 서버가 결제 토큰을 만들고(프로젝트 id:API 키 Basic 인증) 웹은 그 토큰으로 결제창에 간다.
// 결제 · 환불은 엑솔라 웹훅으로 알고, 웹훅은 `Authorization: Signature sha1(본문 + 웹훅 비밀 키)`로 확인한다.

const API = 'https://store.xsolla.com/api/v3/project';

/** 이 구단주가 웹에서 살 수 있는지. 스위치 · 프로젝트 id · 두 키가 있어야 하며, WEB_PAY_TESTERS가 있으면 그 구단주만 산다. */
export function webPayEnabled(env: Bindings, profileId: string): boolean {
  if (
    env.WEB_PAY_ENABLED !== '1' ||
    !env.XSOLLA_PROJECT_ID ||
    !env.XSOLLA_API_KEY ||
    !env.XSOLLA_WEBHOOK_SECRET
  )
    return false;
  return (
    !env.WEB_PAY_TESTERS || env.WEB_PAY_TESTERS.split(',').some((id) => id.trim() === profileId)
  );
}

/** 샌드박스(테스트 카드 · 실제 돈이 오가지 않는다). 계약 전에는 샌드박스만 된다. */
export const xsollaSandbox = (env: Bindings) => env.XSOLLA_SANDBOX === '1';

export type XsollaTokenInput = {
  profileId: string;
  sku: string;
  /** ISO 3166-1 alpha-2(Cloudflare가 알려 준 나라). 없으면 IPv4로 엑솔라가 정한다. */
  country: string | null;
  ip: string | null;
  language: 'ko' | 'en' | 'ja';
  returnUrl: string;
};

/** 주문과 결제 토큰을 만든다. 실패(엑솔라 오류 · 형식)는 던진다. */
export async function createXsollaToken(
  env: Bindings,
  input: XsollaTokenInput,
  fetcher: typeof fetch = fetch,
): Promise<{ token: string; xsollaOrderId: string }> {
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${env.XSOLLA_PROJECT_ID ?? ''}:${env.XSOLLA_API_KEY ?? ''}`)}`,
    'Content-Type': 'application/json',
  };
  if (!input.country && input.ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(input.ip))
    headers['X-User-Ip'] = input.ip;
  const res = await fetcher(`${API}/${env.XSOLLA_PROJECT_ID}/admin/payment/token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...(xsollaSandbox(env) ? { sandbox: true } : {}),
      user: {
        id: { value: input.profileId },
        ...(input.country ? { country: { value: input.country, allow_modify: true } } : {}),
      },
      purchase: { items: [{ sku: input.sku, quantity: 1 }] },
      settings: {
        // external_id(우리 주문 번호)를 보내면 엑솔라가 [0401-2000]으로 토큰을 거절한다. 주문은 엑솔라 주문 번호로 잇는다.
        language: input.language,
        return_url: input.returnUrl,
      },
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    token?: unknown;
    order_id?: unknown;
    errorCode?: unknown;
    errorMessage?: unknown;
    errorMessageExtended?: unknown;
  } | null;
  if (
    !res.ok ||
    typeof body?.token !== 'string' ||
    !/^[A-Za-z0-9._~-]+$/.test(body.token) ||
    (typeof body.order_id !== 'number' && typeof body.order_id !== 'string')
  )
    // 엑솔라 오류 코드 · 문구(요청 형식 · 상품 설정 문제)를 로그에 남긴다. 키나 사용자 정보는 담기지 않는다.
    throw new Error(
      `xsolla token: ${res.status} ${String(body?.errorCode ?? '')} ${String(body?.errorMessage ?? '').slice(0, 300)} ${JSON.stringify(body?.errorMessageExtended ?? '').slice(0, 500)}`.trim(),
    );
  return { token: body.token, xsollaOrderId: String(body.order_id) };
}

export const xsollaPayUrl = (env: Bindings, token: string) =>
  `https://${xsollaSandbox(env) ? 'sandbox-' : ''}secure.xsolla.com/paystation4/?token=${token}`;

async function sha1Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 웹훅 서명 확인. 헤더는 `Signature <sha1 hex>`. */
export async function xsollaSignatureOk(
  env: Bindings,
  rawBody: string,
  header: string | undefined,
): Promise<boolean> {
  const sent = /^Signature ([a-f0-9]{40})$/i.exec(header?.trim() ?? '')?.[1]?.toLowerCase();
  if (!sent || !env.XSOLLA_WEBHOOK_SECRET) return false;
  const want = await sha1Hex(rawBody + env.XSOLLA_WEBHOOK_SECRET);
  let diff = 0;
  for (let i = 0; i < want.length; i += 1) diff |= want.charCodeAt(i) ^ sent.charCodeAt(i);
  return diff === 0;
}
