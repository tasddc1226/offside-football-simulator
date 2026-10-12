import { beforeAll, it, expect } from 'vitest';
import { verifyGooglePush } from './googlePushAuth.js';
let keys: CryptoKeyPair;
let jwk: JsonWebKey & { kid: string };
const NOW = Date.parse('2026-10-12T00:00:00.000Z');
const claims = {
  iss: 'https://accounts.google.com',
  aud: 'https://api.example.test/push',
  email: 'pubsub@example.iam.gserviceaccount.com',
  email_verified: true,
  sub: '123',
  iat: NOW / 1000,
  exp: NOW / 1000 + 3600,
};
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
  jwk = { ...((await crypto.subtle.exportKey('jwk', keys.publicKey)) as JsonWebKey), kid: 'key' };
});
async function token(overrides: Record<string, unknown> = {}) {
  const encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${encode({ alg: 'RS256', kid: 'key' })}.${encode({ ...claims, ...overrides })}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keys.privateKey,
    new TextEncoder().encode(data),
  );
  return `${data}.${Buffer.from(signature).toString('base64url')}`;
}
const opts = { audience: claims.aud, email: claims.email, now: NOW, keys: async () => [jwk] };
it('accepts only a signed delivery from the configured service account', async () => {
  await expect(verifyGooglePush(await token(), opts)).resolves.toBeUndefined();
});
it.each([
  { aud: 'wrong' },
  { email: 'attacker@example.com' },
  { email_verified: false },
  { exp: NOW / 1000 },
  { iss: 'https://attacker.example' },
  { iat: NOW / 1000 + 60 },
])('rejects mismatched or expired claims %j', async (change) => {
  await expect(verifyGooglePush(await token(change), opts)).rejects.toThrow();
});
it('rejects a modified signature', async () => {
  const t = await token();
  await expect(
    verifyGooglePush(t.slice(0, t.lastIndexOf('.') + 1) + 'AAAA', opts),
  ).rejects.toThrow();
});
