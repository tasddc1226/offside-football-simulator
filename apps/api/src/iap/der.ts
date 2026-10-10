// ───────── X.509 인증서에서 서명 확인에 필요한 부분만 읽는 작은 DER 파서 (T-11-174) ─────────
// Apple이 서명한 거래(JWS)의 인증서 사슬을 Workers WebCrypto로 확인하는 데만 쓴다. 길이·태그만 따라가며 값은 해석하지 않는다.

type Node = { tag: number; start: number; body: number; end: number };

function readNode(b: Uint8Array, at: number): Node {
  const tag = b[at]!;
  let len = b[at + 1]!;
  let body = at + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw new Error('DER length');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[body + i]!;
    body += n;
  }
  const end = body + len;
  if (end > b.length) throw new Error('DER overflow');
  return { tag, start: at, body, end };
}

function children(b: Uint8Array, n: Node): Node[] {
  const out: Node[] = [];
  for (let at = n.body; at < n.end;) {
    const c = readNode(b, at);
    out.push(c);
    at = c.end;
  }
  return out;
}

const SEQ = 0x30;
const OID = 0x06;
const BIT_STRING = 0x03;

/** OID 점 표기 → DER 본문 바이트. */
export function oidBytes(dotted: string): Uint8Array {
  const [a, b, ...rest] = dotted.split('.').map(Number);
  const out = [a! * 40 + b!];
  for (const v of rest) {
    const groups = [v & 0x7f];
    for (let x = Math.floor(v / 128); x > 0; x = Math.floor(x / 128))
      groups.unshift((x & 0x7f) | 0x80);
    out.push(...groups);
  }
  return Uint8Array.from(out);
}

const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const ECDSA_SHA256 = oidBytes('1.2.840.10045.4.3.2');
const ECDSA_SHA384 = oidBytes('1.2.840.10045.4.3.3');
const P256 = oidBytes('1.2.840.10045.3.1.7');
const P384 = oidBytes('1.3.132.0.34');

export interface Cert {
  der: Uint8Array;
  /** 발급자가 서명한 tbsCertificate 원문. */
  tbs: Uint8Array;
  /** 발급자의 서명 해시. */
  hash: 'SHA-256' | 'SHA-384';
  /** DER로 감싼 ECDSA 서명(r, s). */
  sig: Uint8Array;
  /** 이 인증서의 공개키(SubjectPublicKeyInfo 원문)와 곡선. */
  spki: Uint8Array;
  curve: 'P-256' | 'P-384';
}

/** ECDSA 인증서만 읽는다(Apple 거래 사슬은 모두 ECDSA다). 다른 형식이면 던진다. */
export function parseCert(der: Uint8Array): Cert {
  const top = readNode(der, 0);
  if (top.tag !== SEQ) throw new Error('cert');
  const [tbsN, algN, sigN] = children(der, top);
  if (!tbsN || !algN || sigN?.tag !== BIT_STRING) throw new Error('cert parts');
  const algOid = children(der, algN)[0];
  const alg = algOid?.tag === OID ? der.subarray(algOid.body, algOid.end) : undefined;
  const hash =
    alg && same(alg, ECDSA_SHA256) ? 'SHA-256' : alg && same(alg, ECDSA_SHA384) ? 'SHA-384' : null;
  if (!hash) throw new Error('cert alg');
  // tbsCertificate: [0] version?, serial, signature, issuer, validity, subject, subjectPublicKeyInfo, …
  const tbsKids = children(der, tbsN);
  const spkiN = tbsKids[tbsKids[0]!.tag === 0xa0 ? 6 : 5];
  if (spkiN?.tag !== SEQ) throw new Error('cert spki');
  const curveN = children(der, children(der, spkiN)[0]!)[1];
  const curveOid = curveN?.tag === OID ? der.subarray(curveN.body, curveN.end) : undefined;
  const curve =
    curveOid && same(curveOid, P256) ? 'P-256' : curveOid && same(curveOid, P384) ? 'P-384' : null;
  if (!curve) throw new Error('cert curve');
  return {
    der,
    tbs: der.subarray(tbsN.start, tbsN.end),
    hash,
    // BIT STRING 첫 바이트는 남는 비트 수(0)다.
    sig: der.subarray(sigN.body + 1, sigN.end),
    spki: der.subarray(spkiN.start, spkiN.end),
    curve,
  };
}

/** DER ECDSA 서명(SEQUENCE{INTEGER r, INTEGER s}) → WebCrypto가 받는 r||s(각 size바이트). */
export function derSigToRaw(sig: Uint8Array, size: number): Uint8Array {
  const top = readNode(sig, 0);
  const out = new Uint8Array(size * 2);
  children(sig, top).forEach((n, i) => {
    let v = sig.subarray(n.body, n.end);
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    if (v.length > size) throw new Error('ECDSA int');
    out.set(v, i * size + (size - v.length));
  });
  return out;
}

/** 인증서 안에 이 OID(확장 표시)가 있는가 — Apple 사슬의 용도 표시 확인용. */
export function hasOid(der: Uint8Array, dotted: string): boolean {
  const o = oidBytes(dotted);
  const needle = Uint8Array.from([OID, o.length, ...o]);
  outer: for (let i = 0; i + needle.length <= der.length; i++) {
    for (let j = 0; j < needle.length; j++) if (der[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}
