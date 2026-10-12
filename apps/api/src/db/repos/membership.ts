import { sql } from 'drizzle-orm';
import {
  DEFAULT_MEMBER_APPEARANCE,
  MemberAppearanceSchema,
  memberBadge,
  memberIsActive,
  type MembershipState,
} from '@offside/contracts/membership';
import type { Db } from '../client.js';
import { profiles } from '../schema.js';

/** Correlated indexed lookup inside the existing public query, never a request/query per owner. */
export function displayedOwnerTitleSql(now = new Date().toISOString()) {
  return sql<string | null>`coalesce((
    select case (select count(*) from membership_periods mp
      where mp.profile_id = m.profile_id and mp.environment = m.environment
      and mp.paid = 1 and mp.refunded_at is null and mp.started_at <= ${now})
      when 0 then null when 1 then 'member-bronze' when 2 then 'member-bronze'
      when 3 then 'member-silver' when 4 then 'member-silver' when 5 then 'member-silver'
      when 6 then 'member-gold' when 7 then 'member-gold' when 8 then 'member-gold'
      when 9 then 'member-gold' when 10 then 'member-gold' when 11 then 'member-gold'
      else 'member-platinum' end
    from owner_memberships m where m.profile_id = ${profiles.id} and m.supporter_title = 1
      and ((m.status = 'active' and m.paid_until > ${now})
        or (m.status = 'grace' and m.grace_until > ${now}))
  ), ${profiles.title})`;
}
export function memberTitleUntilSql(now = new Date().toISOString()) {
  return sql<
    string | null
  >`(select case when m.status = 'grace' then m.grace_until else m.paid_until end
    from owner_memberships m where m.profile_id = ${profiles.id} and m.supporter_title = 1
      and ((m.status = 'active' and m.paid_until > ${now}) or (m.status = 'grace' and m.grace_until > ${now})))`;
}

/** No entitlement is inferred from a local purchase flag. Only server-persisted store state counts. */
export async function membershipOf(
  db: Db,
  profileId: string,
  now: string,
): Promise<MembershipState> {
  const [members, periods] = await db.$client.batch<Record<string, unknown>>([
    db.$client.prepare('SELECT * FROM owner_memberships WHERE profile_id = ?').bind(profileId),
    db.$client
      .prepare(
        `SELECT transaction_id, started_at, paid, granted_at, refunded_at FROM membership_periods
      WHERE profile_id = ? AND environment = (SELECT environment FROM owner_memberships WHERE profile_id = ?)
      AND started_at <= ? ORDER BY started_at DESC`,
      )
      .bind(profileId, profileId, now),
  ]);
  const m = members?.results[0];
  const paidMonths = (periods?.results ?? []).filter((p) => p.paid === 1 && !p.refunded_at).length;
  const status = (m?.status ?? 'none') as MembershipState['status'];
  const paidUntil = m ? String(m.paid_until) : null;
  const graceUntil = m?.grace_until ? String(m.grace_until) : null;
  const active = memberIsActive(status, paidUntil, graceUntil, now);
  const appearance = MemberAppearanceSchema.safeParse(
    m
      ? {
          theme: m.theme,
          frame: m.frame,
          supporterTitle: m.supporter_title === 1,
        }
      : DEFAULT_MEMBER_APPEARANCE,
  );
  return {
    active,
    status,
    store: (m?.store ?? null) as MembershipState['store'],
    paidUntil,
    graceUntil,
    autoRenew: m?.auto_renew === 1,
    paidMonths,
    badge: active ? memberBadge(paidMonths) : null,
    appearance: appearance.success ? appearance.data : DEFAULT_MEMBER_APPEARANCE,
    // Sales remain closed until provider lifecycle and review readiness have been verified.
    salesEnabled: false,
    grants: (periods?.results ?? [])
      .filter((p) => p.granted_at)
      .map((p) => ({
        period: String(p.transaction_id),
        at: String(p.granted_at),
        refunded: !!p.refunded_at,
      })),
  };
}

/** Public appearance exposes no billing history and falls back immediately after expiry. */
export async function publicMemberAppearance(db: Db, id: string, now: string) {
  const row = await db.$client
    .prepare(
      `SELECT theme,frame,status,paid_until,grace_until FROM owner_memberships WHERE profile_id=?`,
    )
    .bind(id)
    .first<{
      theme: string;
      frame: string;
      status: string;
      paid_until: string;
      grace_until: string | null;
    }>();
  if (
    !row ||
    !(
      (row.status === 'active' && row.paid_until > now) ||
      (row.status === 'grace' && row.grace_until !== null && row.grace_until > now)
    )
  )
    return { theme: 'classic' as const, frame: 'none' as const };
  const parsed = MemberAppearanceSchema.safeParse({
    theme: row.theme,
    frame: row.frame,
    supporterTitle: false,
  });
  return parsed.success
    ? { theme: parsed.data.theme, frame: parsed.data.frame }
    : { theme: 'classic' as const, frame: 'none' as const };
}

/** Slot authorization needs only the indexed entitlement row, never period/reward history. */
export async function hasActiveMembership(
  db: Db,
  profileId: string,
  now: string,
): Promise<boolean> {
  const row = await db.$client
    .prepare(`SELECT status, paid_until, grace_until FROM owner_memberships WHERE profile_id = ?`)
    .bind(profileId)
    .first<{ status: MembershipState['status']; paid_until: string; grace_until: string | null }>();
  return !!row && memberIsActive(row.status, row.paid_until, row.grace_until, now);
}
