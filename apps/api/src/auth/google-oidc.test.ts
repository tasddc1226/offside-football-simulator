import { describe, expect, it } from 'vitest';
import { verifiedGoogleEmail, verifyGoogleIdTokenClaims } from './google-oidc.js';

function token(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(claims)}.`;
}

const now = Date.parse('2026-09-06T00:00:00Z');
const base = { sub: 'google-sub', aud: 'client-id', exp: now / 1000 + 60 };

describe('Google ID token claims', () => {
  it.each(['https://accounts.google.com', 'accounts.google.com'])(
    'accepts Google issuer %s',
    (iss) => {
      expect(
        verifyGoogleIdTokenClaims(
          token({ ...base, iss, email: 'player@example.com', email_verified: true }),
          'client-id',
          now,
        ),
      ).toEqual({ sub: 'google-sub', email: 'player@example.com', emailVerified: true });
    },
  );

  it('rejects a wrong audience or expired token', () => {
    expect(() =>
      verifyGoogleIdTokenClaims(
        token({ ...base, iss: 'https://accounts.google.com' }),
        'other-client',
        now,
      ),
    ).toThrow('aud');
    expect(() =>
      verifyGoogleIdTokenClaims(
        token({ ...base, iss: 'https://accounts.google.com', exp: now / 1000 }),
        'client-id',
        now,
      ),
    ).toThrow('만료');
  });

  it('does not persist an unverified email claim', () => {
    expect(
      verifiedGoogleEmail({ email: 'unverified@example.com', emailVerified: false }),
    ).toBeNull();
    expect(verifiedGoogleEmail({ email: 'verified@example.com', emailVerified: true })).toBe(
      'verified@example.com',
    );
  });
});
