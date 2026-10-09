// ───────── Google Play 구매 확인 (T-11-174) ─────────
// Google Play Developer API(purchases.products.get)로 purchaseToken을 확인한다. 서비스 계정(Play Console에서 이 앱의
// 재무 데이터 보기 · 주문 관리 권한)의 JSON 키를 secret GOOGLE_PLAY_SA_JSON으로 두고, 그 키로 서명한 JWT를 액세스 토큰으로
// 바꾼다. 확인한 구매는 서버가 바로 승인(acknowledge)해 둔다 — 앱이 소비(consume)하기 전에 꺼져도 3일 뒤 자동 환불되지 않게.
import { bytesToBase64Url, json64, pemToPkcs8 } from '../auth/base64url.js';

export const ANDROID_PACKAGE = 'com.offsidelab.app';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE}/purchases/products`;

export interface GoogleProductPurchase {
  orderId?: string;
  /** 0 구매됨 · 1 취소 · 2 대기. */
  purchaseState?: number;
  /** 0 아직 승인 전 · 1 승인됨. */
  acknowledgementState?: number;
  /** 있으면 0 테스트(라이선스 테스터) · 1 프로모션 · 2 보상형. 일반 구매엔 없다. */
  purchaseType?: number;
  obfuscatedExternalAccountId?: string;
  quantity?: number;
}

type ServiceAccount = { client_email: string; private_key: string };

// 아이솔레이트가 살아 있는 동안 액세스 토큰을 다시 쓴다(한 시간짜리).
let cached: { key: string; token: string; until: number } | undefined;

async function accessToken(saJson: string, doFetch: typeof fetch, nowS: number): Promise<string> {
  if (cached?.key === saJson && cached.until > nowS) return cached.token;
  const sa = JSON.parse(saJson) as ServiceAccount;
  const head = json64({ alg: 'RS256', typ: 'JWT' });
  const claims = json64({
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowS,
    exp: nowS + 3600,
  });
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${head}.${claims}`),
  );
  const res = await doFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claims}.${bytesToBase64Url(new Uint8Array(sig))}`,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  const { access_token: token, expires_in: ttl = 3600 } = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  cached = { key: saJson, token, until: nowS + ttl - 120 };
  return token;
}

const tokenPath = (productId: string, token: string) =>
  `${API}/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;

type GoogleOpts = { nowS: number; fetcher?: typeof fetch };

/** 서비스 계정 토큰을 붙여 이 구매 경로(suffix: '' · ':acknowledge')를 부른다. */
async function callPurchase(
  saJson: string,
  productId: string,
  token: string,
  opts: GoogleOpts,
  suffix = '',
  init: RequestInit = {},
) {
  const doFetch = opts.fetcher ?? fetch;
  const auth = `Bearer ${await accessToken(saJson, doFetch, opts.nowS)}`;
  return doFetch(`${tokenPath(productId, token)}${suffix}`, {
    ...init,
    headers: { authorization: auth, ...init.headers },
  });
}

/** 구매를 읽는다. Google이 모르는 토큰(400·404·410)이면 null, 그 밖의 실패는 던진다(다시 시도할 수 있다). */
export async function getGooglePurchase(
  saJson: string,
  productId: string,
  token: string,
  opts: GoogleOpts,
): Promise<GoogleProductPurchase | null> {
  const res = await callPurchase(saJson, productId, token, opts);
  if (res.status === 400 || res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Google purchase ${res.status}`);
  return (await res.json()) as GoogleProductPurchase;
}

/** 구매 승인. 실패해도 앱이 소비할 때 함께 승인되니 던지기만 한다(호출하는 쪽이 기록만 한다). */
export async function acknowledgeGooglePurchase(
  saJson: string,
  productId: string,
  token: string,
  opts: GoogleOpts,
): Promise<void> {
  const res = await callPurchase(saJson, productId, token, opts, ':acknowledge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Google acknowledge ${res.status}`);
}

/** 테스트용: 캐시한 액세스 토큰을 비운다. */
export const resetGoogleTokenCache = () => {
  cached = undefined;
};
