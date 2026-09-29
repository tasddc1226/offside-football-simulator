// T-11-003 Sign in with Apple 신원 토큰 검증 — 테스트용 RSA 키로 서명한 토큰으로 서명·클레임 검사를 확인한다.
import { beforeAll, describe, expect, it } from 'vitest';
import { sha256Hex } from '../db/hash.js';
import { APPLE_ISSUER, verifyAppleIdToken, type AppleJwk } from './apple-id-token.js';

const AUD = 'com.offsidelab.app';
const NOW = Date.parse('2026-10-01T00:00:00Z');

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

let keys: CryptoKeyPair;
let jwk: AppleJwk;
const jwks = async () => [jwk];

async function sign(claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const h = b64urlJson({ alg: 'RS256', kid: 'k1', ...header });
  const p = b64urlJson({
    iss: APPLE_ISSUER,
    aud: AUD,
    exp: NOW / 1000 + 600,
    sub: 'apple-sub-1',
    ...claims,
  });
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keys.privateKey,
      new TextEncoder().encode(`${h}.${p}`),
    ),
  );
  return `${h}.${p}.${b64url(sig)}`;
}

describe('verifyAppleIdToken', () => {
  beforeAll(async () => {
    keys = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    jwk = { ...((await crypto.subtle.exportKey('jwk', keys.publicKey)) as JsonWebKey), kid: 'k1' };
  });

  it('올바른 토큰이면 sub·email을 돌려준다', async () => {
    const nonce = 'raw-nonce-123456';
    const token = await sign({
      email: 'a@privaterelay.appleid.com',
      nonce: await sha256Hex(nonce),
    });
    await expect(
      verifyAppleIdToken(token, { audience: AUD, now: NOW, nonce, jwks }),
    ).resolves.toEqual({
      sub: 'apple-sub-1',
      email: 'a@privaterelay.appleid.com',
    });
  });

  it.each([
    ['iss', { iss: 'https://evil.example' }],
    ['aud', { aud: 'com.other.app' }],
    ['exp', { exp: NOW / 1000 - 1 }],
    ['sub', { sub: '' }],
  ])('%s가 틀리면 거절한다', async (_, claims) => {
    const token = await sign(claims);
    await expect(verifyAppleIdToken(token, { audience: AUD, now: NOW, jwks })).rejects.toThrow();
  });

  it('nonce가 다르면 거절한다', async () => {
    const token = await sign({ nonce: await sha256Hex('other') });
    await expect(
      verifyAppleIdToken(token, { audience: AUD, now: NOW, nonce: 'raw', jwks }),
    ).rejects.toThrow(/nonce/);
  });

  it('서명이 바뀌었거나 모르는 kid면 거절한다', async () => {
    const token = await sign({});
    const [h, p] = token.split('.');
    const forged = `${h}.${b64urlJson({ iss: APPLE_ISSUER, aud: AUD, exp: NOW / 1000 + 600, sub: 'x' })}.${token.split('.')[2]}`;
    await expect(verifyAppleIdToken(forged, { audience: AUD, now: NOW, jwks })).rejects.toThrow(
      /서명/,
    );
    expect(p).toBeTruthy();
    const unknownKid = await sign({}, { kid: 'k2' });
    await expect(verifyAppleIdToken(unknownKid, { audience: AUD, now: NOW, jwks })).rejects.toThrow(
      /공개키/,
    );
    const hs = await sign({}, { alg: 'HS256' });
    await expect(verifyAppleIdToken(hs, { audience: AUD, now: NOW, jwks })).rejects.toThrow(/헤더/);
  });
});
