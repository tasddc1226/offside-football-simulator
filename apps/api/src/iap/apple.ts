// ───────── App Store 서명 거래(JWS) 확인 (T-11-174) ─────────
// StoreKit 2가 기기에 주는 거래는 Apple이 서명한 JWS다. 헤더의 x5c 사슬(잎 → 중간 → 루트)을 따라 서명을 확인하고, 루트가
// Apple Root CA - G3인지 지문으로 확인한다. 네트워크 없이 끝나 App Store Server API 키가 필요 없다(Apple 공식 라이브러리와
// 같은 방식). 인증서 유효 기간은 보지 않는다 — 기기에 늦게 남은 거래를 다음 실행 때 다시 보내도 받기 위해서다.
import { base64UrlToBytes } from '../auth/base64url.js';
import { derSigToRaw, hasOid, parseCert, type Cert } from './der.js';

/** Apple Root CA - G3 SHA-256 지문(macOS 시스템 루트 인증서와 같다). */
export const APPLE_ROOT_G3_SHA256 =
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';
/** 잎 인증서(App Store 영수증 서명) · 중간 인증서(WWDR) 용도 표시. */
const LEAF_OID = '1.2.840.113635.100.6.11.1';
const INTERMEDIATE_OID = '1.2.840.113635.100.6.2.1';

export interface AppleTransaction {
  transactionId: string;
  bundleId: string;
  productId: string;
  type?: string;
  appAccountToken?: string;
  environment?: string;
  quantity?: number;
  revocationDate?: number;
}

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const SIZE = { 'P-256': 32, 'P-384': 48 } as const;

/** child가 parent의 키로 서명됐는가. */
async function signedBy(child: Cert, parent: Cert): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'spki',
    parent.spki,
    { name: 'ECDSA', namedCurve: parent.curve },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: child.hash },
    key,
    derSigToRaw(child.sig, SIZE[parent.curve]),
    child.tbs,
  );
}

/**
 * JWS를 확인하고 거래를 돌려준다. 서명·사슬이 맞지 않으면 null. rootSha256은 테스트가 자기 루트를 쓸 때만 바꾼다.
 */
export async function verifyAppleTransaction(
  jws: string,
  rootSha256 = APPLE_ROOT_G3_SHA256,
): Promise<AppleTransaction | null> {
  try {
    const [h, p, s] = jws.split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(h))) as {
      alg?: string;
      x5c?: string[];
    };
    if (header.alg !== 'ES256' || header.x5c?.length !== 3) return null;
    const [leaf, mid, root] = header.x5c.map((c) => parseCert(b64(c))) as [Cert, Cert, Cert];
    if (hex(await crypto.subtle.digest('SHA-256', root.der)) !== rootSha256) return null;
    if (!hasOid(leaf.der, LEAF_OID) || !hasOid(mid.der, INTERMEDIATE_OID)) return null;
    if (!(await signedBy(mid, root)) || !(await signedBy(leaf, mid))) return null;
    const leafKey = await crypto.subtle.importKey(
      'spki',
      leaf.spki,
      { name: 'ECDSA', namedCurve: leaf.curve },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      leafKey,
      base64UrlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    if (!ok) return null;
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(p))) as AppleTransaction;
  } catch {
    return null;
  }
}
