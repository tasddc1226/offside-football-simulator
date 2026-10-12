import type { VerifiedMemberPeriod } from '../db/repos/memberRewards.js';
export type VerifiedMembership = {
  store: 'apple' | 'google';
  environment: 'production' | 'sandbox';
  chainId: string;
  status: 'active' | 'grace' | 'expired' | 'revoked' | 'hold';
  paidUntil: string;
  graceUntil: string | null;
  autoRenew: boolean;
  verifiedAt: string;
  periods: VerifiedMemberPeriod[];
  acknowledge?: () => Promise<void>;
};
export class MemberVerificationError extends Error {
  constructor(
    readonly reason: 'INVALID' | 'OTHER_ACCOUNT' | 'PENDING' | 'CONFIGURATION' | 'UPSTREAM',
  ) {
    super(reason);
  }
}
export function iso(value: string | number | undefined): string {
  if (value === undefined || !Number.isFinite(new Date(value).valueOf()))
    throw new MemberVerificationError('INVALID');
  return new Date(value).toISOString();
}
export async function tokenHash(token: string): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
}
