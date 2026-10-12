import { base64UrlToBytes, bytesToBase64Url } from '../auth/base64url.js';

async function key(secret: string) {
  const bytes = base64UrlToBytes(secret);
  if (bytes.length !== 32) throw new Error('MEMBERSHIP_TOKEN_KEY invalid');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
/** Bind ciphertext to account and chain. Never persist tokens in event payloads or logs. */
export async function sealToken(token: string, secret: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) },
    await key(secret),
    new TextEncoder().encode(token),
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}
export async function openToken(cipher: string, secret: string, context: string) {
  const [version, iv, data] = cipher.split('.');
  if (version !== 'v1' || !iv || !data) throw new Error('MEMBERSHIP_TOKEN_CIPHER invalid');
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64UrlToBytes(iv),
        additionalData: new TextEncoder().encode(context),
      },
      await key(secret),
      base64UrlToBytes(data),
    ),
  );
}
