import { describe, expect, it } from 'vitest';
import {
  activeMemberTitle,
  effectiveOwnerTitle,
  memberBadge,
  memberIsActive,
} from './membership-rules.js';

const now = '2026-10-12T00:00:00.000Z';
const paidUntil = '2026-11-01T00:00:00.000Z';
const member = {
  status: 'active',
  paidUntil,
  graceUntil: null,
  paidMonths: 3,
  supporterTitle: true,
};

describe('subscription identity lifecycle', () => {
  it('excludes unpaid/invalid tenure and recognizes each paid threshold', () => {
    expect([-1, 0, 0.5, NaN, Infinity].map(memberBadge)).toEqual([null, null, null, null, null]);
    expect([1, 2, 3, 5, 6, 11, 12, 24].map(memberBadge)).toEqual([
      'bronze',
      'bronze',
      'silver',
      'silver',
      'gold',
      'gold',
      'platinum',
      'platinum',
    ]);
  });
  it('expires exactly at the paid boundary, without a webhook', () => {
    expect(activeMemberTitle(member, now)).toBe('member-silver');
    expect(activeMemberTitle(member, paidUntil)).toBeNull();
    expect(activeMemberTitle({ ...member, paidUntil: 'bad' }, now)).toBeNull();
    expect(activeMemberTitle(member, 'bad')).toBeNull();
    expect(memberIsActive('active', '2026-10-12T09:30:00+09:00', null, now)).toBe(true);
  });
  it('retains access through grace, but never after refund/hold', () => {
    expect(
      activeMemberTitle({ ...member, status: 'grace', paidUntil: now, graceUntil: paidUntil }, now),
    ).toBe('member-silver');
    for (const status of ['revoked', 'hold', 'expired', 'none'])
      expect(activeMemberTitle({ ...member, status }, now)).toBeNull();
    expect(activeMemberTitle({ ...member, status: 'grace' }, now)).toBeNull();
  });
  it('keeps earned identity and opt-out intact on expiration or resubscription', () => {
    expect(effectiveOwnerTitle('owner-founder', member, now)).toBe('member-silver');
    expect(effectiveOwnerTitle('owner-founder', member, paidUntil)).toBe('owner-founder');
    expect(effectiveOwnerTitle('owner-founder', { ...member, supporterTitle: false }, now)).toBe(
      'owner-founder',
    );
    expect(effectiveOwnerTitle(null, member, paidUntil)).toBeNull();
    expect(effectiveOwnerTitle('member-platinum', null, now)).toBeNull();
  });
});
