import { expect, it } from 'vitest';
import { openToken, sealToken } from './tokenVault.js';
import { bytesToBase64Url } from '../auth/base64url.js';
it('encrypts nondeterministically and binds tokens to the owner and chain', async () => {
  const secret = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const a = await sealToken('private-token', secret, 'owner:chain');
  const b = await sealToken('private-token', secret, 'owner:chain');
  expect(a).not.toBe(b);
  expect(a).not.toContain('private-token');
  expect(await openToken(a, secret, 'owner:chain')).toBe('private-token');
  await expect(openToken(a, secret, 'another:chain')).rejects.toThrow();
  await expect(openToken(a, bytesToBase64Url(new Uint8Array(32)), 'owner:chain')).rejects.toThrow();
});
