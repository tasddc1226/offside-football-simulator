import { canonicalize, utf8Encode, type JsonValue } from './canonical.js';
import type { CareerState } from './types.js';

// FIPS 180-4 SHA-256 상수(K[0..63]): 첫 64개 소수의 세제곱근의 소수부 32비트.
const K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

// FIPS 180-4 초기 해시값 H(0)[0..7]: 첫 8개 소수의 제곱근의 소수부 32비트.
const H0: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function toHex8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

/** 순수 TS SHA-256(FIPS 180-4). 전역 `crypto`를 쓰지 않는다. */
export function sha256Hex(input: string): string {
  const message = utf8Encode(input);
  const bitLength = message.length * 8;

  const withOneAndLength = message.length + 1 + 8;
  const paddedLength = Math.ceil(withOneAndLength / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;

  const hi = Math.floor(bitLength / 0x100000000) >>> 0;
  const lo = bitLength >>> 0;
  const lengthOffset = paddedLength - 8;
  padded[lengthOffset] = (hi >>> 24) & 0xff;
  padded[lengthOffset + 1] = (hi >>> 16) & 0xff;
  padded[lengthOffset + 2] = (hi >>> 8) & 0xff;
  padded[lengthOffset + 3] = hi & 0xff;
  padded[lengthOffset + 4] = (lo >>> 24) & 0xff;
  padded[lengthOffset + 5] = (lo >>> 16) & 0xff;
  padded[lengthOffset + 6] = (lo >>> 8) & 0xff;
  padded[lengthOffset + 7] = lo & 0xff;

  let [h0, h1, h2, h3, h4, h5, h6, h7] = H0;

  const w = new Uint32Array(64);
  for (let chunkStart = 0; chunkStart < paddedLength; chunkStart += 64) {
    for (let i = 0; i < 16; i++) {
      const offset = chunkStart + i * 4;
      w[i] =
        ((padded[offset]! << 24) | (padded[offset + 1]! << 16) | (padded[offset + 2]! << 8) | padded[offset + 3]!) >>>
        0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h0!;
    let b = h1!;
    let c = h2!;
    let d = h3!;
    let e = h4!;
    let f = h5!;
    let g = h6!;
    let h = h7!;

    for (let i = 0; i < 64; i++) {
      const bigS1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + bigS1 + ch + K[i]! + w[i]!) >>> 0;
      const bigS0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (bigS0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0! + a) >>> 0;
    h1 = (h1! + b) >>> 0;
    h2 = (h2! + c) >>> 0;
    h3 = (h3! + d) >>> 0;
    h4 = (h4! + e) >>> 0;
    h5 = (h5! + f) >>> 0;
    h6 = (h6! + g) >>> 0;
    h7 = (h7! + h) >>> 0;
  }

  return [h0!, h1!, h2!, h3!, h4!, h5!, h6!, h7!].map(toHex8).join('');
}

/** `sha256Hex(canonicalize(state))`. Snapshot 무결성 검증의 기준값이다. */
export function hashState(state: CareerState): string {
  return sha256Hex(canonicalize(state as unknown as JsonValue));
}
