/** Subscription identity is temporary; never add these to PERMANENT_TITLES. */
export const MEMBER_BADGES = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type MemberBadge = (typeof MEMBER_BADGES)[number];
export const MEMBER_BADGE_MONTHS: Record<MemberBadge, number> = {
  bronze: 1,
  silver: 3,
  gold: 6,
  platinum: 12,
};
export const MEMBER_BADGE_COLORS: Record<MemberBadge, string> = {
  bronze: '#D5A17C',
  silver: '#B9CCDA',
  gold: '#E5C572',
  platinum: '#A9DDCF',
};
export function memberBadge(months: number): MemberBadge | null {
  if (!Number.isSafeInteger(months) || months < 1) return null;
  return months >= 12 ? 'platinum' : months >= 6 ? 'gold' : months >= 3 ? 'silver' : 'bronze';
}
export function parseMemberTitle(id: string | null | undefined): MemberBadge | null {
  return MEMBER_BADGES.find((badge) => id === `member-${badge}`) ?? null;
}
export type MemberAccess = {
  status: string;
  paidUntil: string | null;
  graceUntil: string | null;
};
/** Fail closed on invalid dates. Cancellation changes autoRenew, not the paid entitlement. */
export function memberIsActive(
  status: string,
  paidUntil: string | null,
  graceUntil: string | null,
  now: string,
): boolean {
  const end = status === 'active' ? paidUntil : status === 'grace' ? graceUntil : null;
  return !!end && Date.parse(end) > Date.parse(now);
}
/** Derive on read, so expiry does not depend on a webhook/cron arriving on time. */
export function activeMemberTitle(
  member: (MemberAccess & { paidMonths: number; supporterTitle: boolean }) | null,
  now: string,
): string | null {
  if (
    !member?.supporterTitle ||
    !memberIsActive(member.status, member.paidUntil, member.graceUntil, now)
  )
    return null;
  const badge = memberBadge(member.paidMonths);
  return badge ? `member-${badge}` : null;
}
/** Keep the owner's earned selection intact when applying temporary subscription identity. */
export function effectiveOwnerTitle(
  earnedTitle: string | null,
  member: Parameters<typeof activeMemberTitle>[0],
  now: string,
): string | null {
  return activeMemberTitle(member, now) ?? (parseMemberTitle(earnedTitle) ? null : earnedTitle);
}

export const MEMBER_PALETTES = {
  classic: {
    bg: '#102219',
    wall: '#14281e',
    gold: '#d5bd7d',
    ink: '#ede9d8',
    muted: '#b6c3b2',
    line: '#52674e',
  },
  midnight: {
    bg: '#101b2d',
    wall: '#172b43',
    gold: '#a3c8e7',
    ink: '#edf5ff',
    muted: '#b5c4d5',
    line: '#45617c',
  },
  ivory: {
    bg: '#312a20',
    wall: '#473e2e',
    gold: '#f0d8a0',
    ink: '#fff5df',
    muted: '#d2c4a8',
    line: '#85734e',
  },
  royal: {
    bg: '#23152c',
    wall: '#35213f',
    gold: '#d5b1e2',
    ink: '#f7eefa',
    muted: '#c8b1cf',
    line: '#77527f',
  },
} as const;
