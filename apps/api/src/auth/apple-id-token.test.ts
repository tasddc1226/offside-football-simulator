// T-11-003 Sign in with Apple 신원 토큰 검증 — 테스트용 RSA 키로 서명한 토큰으로 서명·클레임 검사를 확인한다.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../db/hash.js';
import { base64UrlToBytes, bytesToBase64Url } from './base64url.js';
import { revokeAppleAuthorization } from './apple-revoke.js';
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
    const token = await sign({ email: 'relay@apple.example.com' });
    await expect(verify(token)).resolves.toEqual({
      sub: 'apple-sub-1',
      email: 'relay@apple.example.com',
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

// T-11-167 계정 삭제 때 Apple 토큰 해지 — client_secret 서명과 교환·해지 요청 순서를 본다.
describe('revokeAppleAuthorization', () => {
  async function ecPem() {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const der = new Uint8Array(
      (await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer,
    );
    const b64 = btoa(String.fromCharCode(...der));
    return { pem: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`, pair };
  }

  it('키가 없으면 Apple을 부르지 않고 건너뛴다', async () => {
    const fetcher = vi.fn();
    const r = await revokeAppleAuthorization({ APPLE_TEAM_ID: 'T' } as never, 'code', {
      nowS: NOW / 1000,
      fetcher,
    });
    expect(r).toBe('skipped');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('코드를 토큰으로 바꾼 뒤 refresh_token을 해지하고, client_secret은 ES256으로 서명한다', async () => {
    const { pem, pair } = await ecPem();
    const calls: { url: string; body: URLSearchParams }[] = [];
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: new URLSearchParams(String(init.body)) });
      return url.endsWith('/auth/token')
        ? Response.json({ refresh_token: 'rt-1', access_token: 'at-1' })
        : new Response(null, { status: 200 });
    });
    const env = {
      APPLE_TEAM_ID: 'TEAM1',
      APPLE_SIGNIN_KEY_ID: 'KEY1',
      APPLE_SIGNIN_PRIVATE_KEY: pem,
    };
    const r = await revokeAppleAuthorization(env as never, 'auth-code', {
      nowS: NOW / 1000,
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(r).toBe('revoked');
    expect(calls.map((x) => x.url)).toEqual([
      `${APPLE_ISSUER}/auth/token`,
      `${APPLE_ISSUER}/auth/revoke`,
    ]);
    expect(calls[0]!.body.get('code')).toBe('auth-code');
    expect(calls[1]!.body.get('token')).toBe('rt-1');
    expect(calls[1]!.body.get('token_type_hint')).toBe('refresh_token');
    const secret = calls[0]!.body.get('client_secret')!;
    const [h, p, s] = secret.split('.') as [string, string, string];
    const dec = (x: string) => JSON.parse(new TextDecoder().decode(base64UrlToBytes(x)));
    expect(dec(h)).toEqual({
      alg: 'ES256',
      kid: 'KEY1',
    });
    const claims = dec(p);
    expect(claims).toMatchObject({ iss: 'TEAM1', sub: AUD, aud: APPLE_ISSUER });
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      base64UrlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(valid).toBe(true);
  });

  it('해지 응답이 실패면 던진다(호출 쪽이 기록만 한다)', async () => {
    const { pem } = await ecPem();
    const fetcher = vi.fn(async (url: string) =>
      url.endsWith('/auth/token')
        ? Response.json({ access_token: 'at-1' })
        : new Response(null, { status: 400 }),
    );
    const env = { APPLE_TEAM_ID: 'T', APPLE_SIGNIN_KEY_ID: 'K', APPLE_SIGNIN_PRIVATE_KEY: pem };
    await expect(
      revokeAppleAuthorization(env as never, 'c', {
        nowS: NOW / 1000,
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).rejects.toThrow('revoke 400');
  });
});
