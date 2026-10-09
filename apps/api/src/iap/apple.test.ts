import { describe, expect, it } from 'vitest';
import { bytesToBase64Url } from '../auth/base64url.js';
import { verifyAppleTransaction, type AppleTransaction } from './apple.js';
import { oidBytes } from './der.js';

// 테스트용 사슬(루트 → 중간 → 잎)을 WebCrypto로 직접 만든다. 파서가 읽는 부분(서명 알고리즘 · 공개키 · 용도 OID)만 채운다.

const tlv = (tag: number, ...parts: Uint8Array[]) => {
  const body = Uint8Array.from(parts.flatMap((p) => [...p]));
  const n = body.length;
  const len = n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 0xff];
  return Uint8Array.from([tag, ...len, ...body]);
};
const seq = (...p: Uint8Array[]) => tlv(0x30, ...p);
const oid = (d: string) => tlv(0x06, oidBytes(d));
const ALG = seq(oid('1.2.840.10045.4.3.2'));
const EC = { name: 'ECDSA', namedCurve: 'P-256' } as const;

/** r||s → DER SEQUENCE{INTEGER, INTEGER}. */
function rawToDer(raw: Uint8Array) {
  const int = (v: Uint8Array) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    const x = v.subarray(i);
    return tlv(0x02, x[0]! & 0x80 ? Uint8Array.from([0, ...x]) : x);
  };
  return seq(int(raw.subarray(0, 32)), int(raw.subarray(32)));
}

async function cert(subject: CryptoKeyPair, issuer: CryptoKey, extOid?: string) {
  const spki = new Uint8Array(
    (await crypto.subtle.exportKey('spki', subject.publicKey)) as ArrayBuffer,
  );
  const ext = extOid
    ? [tlv(0xa3, seq(seq(oid(extOid), tlv(0x04, Uint8Array.from([0x05, 0x00])))))]
    : [];
  const tbs = seq(
    tlv(0xa0, tlv(0x02, Uint8Array.from([2]))),
    tlv(0x02, Uint8Array.from([1])),
    ALG,
    seq(),
    seq(),
    seq(),
    spki,
    ...ext,
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, issuer, tbs),
  );
  return seq(tbs, ALG, tlv(0x03, Uint8Array.from([0, ...rawToDer(sig)])));
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const json64 = (v: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(v)));

async function chain() {
  const gen = () =>
    crypto.subtle.generateKey(EC, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
  const [root, mid, leaf] = await Promise.all([gen(), gen(), gen()]);
  const rootDer = await cert(root, root.privateKey);
  const x5c = [
    await cert(leaf, mid.privateKey, '1.2.840.113635.100.6.11.1'),
    await cert(mid, root.privateKey, '1.2.840.113635.100.6.2.1'),
    rootDer,
  ];
  const rootSha = hex(await crypto.subtle.digest('SHA-256', rootDer));
  return { leaf, mid, x5c, rootSha };
}

async function sign(key: CryptoKey, x5c: Uint8Array[], payload: unknown) {
  const head = json64({ alg: 'ES256', x5c: x5c.map(b64) });
  const body = json64(payload);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

const TX: AppleTransaction = {
  transactionId: '2000000123',
  bundleId: 'com.offsidelab.app',
  productId: 'com.offsidelab.app.reroll_5',
  type: 'Consumable',
  environment: 'Sandbox',
};

describe('T-11-174 App Store 서명 거래 확인', () => {
  it('사슬과 서명이 맞으면 거래를 돌려준다', async () => {
    const c = await chain();
    const jws = await sign(c.leaf.privateKey, c.x5c, TX);
    expect(await verifyAppleTransaction(jws, c.rootSha)).toEqual(TX);
  });

  it('루트가 다르거나, 서명이 틀리거나, 용도 표시가 없으면 받지 않는다', async () => {
    const c = await chain();
    const jws = await sign(c.leaf.privateKey, c.x5c, TX);
    // Apple 루트가 아니다(기본 지문).
    expect(await verifyAppleTransaction(jws)).toBeNull();
    // 본문을 바꿨다.
    const [h, , s] = jws.split('.');
    const forged = `${h}.${json64({ ...TX, productId: 'com.offsidelab.app.reroll_40' })}.${s}`;
    expect(await verifyAppleTransaction(forged, c.rootSha)).toBeNull();
    // 다른 키로 서명했다.
    const other = (await crypto.subtle.generateKey(EC, true, ['sign'])) as CryptoKeyPair;
    expect(
      await verifyAppleTransaction(await sign(other.privateKey, c.x5c, TX), c.rootSha),
    ).toBeNull();
    // 잎 인증서를 중간 인증서가 아닌 키로 발급했다.
    const fakeLeaf = await cert(c.leaf, other.privateKey, '1.2.840.113635.100.6.11.1');
    const swapped = [fakeLeaf, c.x5c[1]!, c.x5c[2]!];
    expect(
      await verifyAppleTransaction(await sign(c.leaf.privateKey, swapped, TX), c.rootSha),
    ).toBeNull();
    // 잎에 App Store 영수증 용도 표시가 없다.
    const plainLeaf = await cert(c.leaf, c.mid.privateKey);
    const unmarked = [plainLeaf, c.x5c[1]!, c.x5c[2]!];
    expect(
      await verifyAppleTransaction(await sign(c.leaf.privateKey, unmarked, TX), c.rootSha),
    ).toBeNull();
    expect(await verifyAppleTransaction('not.a.jws', c.rootSha)).toBeNull();
  });
});
