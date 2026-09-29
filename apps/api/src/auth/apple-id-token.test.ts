// T-11-003 Sign in with Apple 신원 토큰 검증 — 테스트용 RSA 키로 서명한 토큰으로 서명·클레임 검사를 확인한다.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../db/hash.js';
import { bytesToBase64Url } from './base64url.js';
import { APPLE_ISSUER, verifyAppleIdToken, type AppleJwk } from './apple-id-token.js';

const AUD = 'com.offsidelab.app';
const NOW = Date.parse('2026-10-01T00:00:00Z');
const NONCE = 'raw-nonce-123456';

const b64urlJson = (v: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(v)));

let keys: CryptoKeyPair;
let jwk: AppleJwk;
const jwks = async () => [jwk];
const verify = (token: string, nonce = NONCE) =>
  verifyAppleIdToken(token, { audience: AUD, now: NOW, nonce, jwks });

async function sign(claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const h = b64urlJson({ alg: 'RS256', kid: 'k1', ...header });
  const p = b64urlJson({
    iss: APPLE_ISSUER,
    aud: AUD,
    exp: NOW / 1000 + 600,
    sub: 'apple-sub-1',
    nonce: await sha256Hex(NONCE),
    ...claims,
  });
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keys.privateKey,
      new TextEncoder().encode(`${h}.${p}`),
    ),
  );
  return `${h}.${p}.${bytesToBase64Url(sig)}`;
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
    const token = await sign({ email: 'a@privaterelay.appleid.com' });
    await expect(verify(token)).resolves.toEqual({
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
    await expect(verify(await sign(claims))).rejects.toThrow();
  });

  it('nonce가 다르면 거절한다', async () => {
    await expect(verify(await sign({}), 'other-nonce')).rejects.toThrow(/nonce/);
  });

  it('서명이 바뀌었거나 모르는 kid·알고리즘이면 거절한다', async () => {
    const [h, , sig] = (await sign({})).split('.');
    const forged = `${h}.${b64urlJson({ iss: APPLE_ISSUER, aud: AUD, exp: NOW / 1000 + 600, sub: 'x' })}.${sig}`;
    await expect(verify(forged)).rejects.toThrow(/서명/);
    await expect(verify(await sign({}, { kid: 'k2' }))).rejects.toThrow(/공개키/);
    await expect(verify(await sign({}, { alg: 'HS256' }))).rejects.toThrow(/헤더/);
  });

  it('모르는 kid면 키 목록을 한 번 다시 받는다(Apple 키 교체)', async () => {
    const fetchKeys = vi.fn(async (_now: number, refresh?: boolean) => (refresh ? [jwk] : []));
    const token = await sign({});
    await expect(
      verifyAppleIdToken(token, { audience: AUD, now: NOW, nonce: NONCE, jwks: fetchKeys }),
    ).resolves.toMatchObject({ sub: 'apple-sub-1' });
    expect(fetchKeys.mock.calls.map((call) => call[1])).toEqual([undefined, true]);
  });
});
