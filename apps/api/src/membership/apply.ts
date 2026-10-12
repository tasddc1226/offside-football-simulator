import type { Db } from '../db/client.js';
import { recordMemberPeriod } from '../db/repos/memberRewards.js';
import { MemberVerificationError, type VerifiedMembership } from './types.js';

/** One chain can never move between game accounts, even during concurrent restores. */
export async function applyMembership(
  db: Db,
  profileId: string,
  m: VerifiedMembership,
  tokenCipher: string | null,
) {
  if (
    m.periods.some(
      (p) =>
        p.profileId !== profileId ||
        p.chainId !== m.chainId ||
        p.store !== m.store ||
        p.environment !== m.environment,
    )
  )
    throw new MemberVerificationError('INVALID');
  const d1 = db.$client;
  const [, owner] = await d1.batch<{ profile_id: string }>([
    d1
      .prepare(
        `INSERT INTO membership_chains (store,environment,chain_id,profile_id,status,paid_until,grace_until,auto_renew,verified_at,token_cipher)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(store,environment,chain_id) DO UPDATE SET
      status=excluded.status,paid_until=excluded.paid_until,grace_until=excluded.grace_until,auto_renew=excluded.auto_renew,verified_at=excluded.verified_at,token_cipher=coalesce(excluded.token_cipher,membership_chains.token_cipher)
      WHERE membership_chains.profile_id=excluded.profile_id AND membership_chains.verified_at<=excluded.verified_at`,
      )
      .bind(
        m.store,
        m.environment,
        m.chainId,
        profileId,
        m.status,
        m.paidUntil,
        m.graceUntil,
        m.autoRenew ? 1 : 0,
        m.verifiedAt,
        tokenCipher,
      ),
    d1
      .prepare(
        'SELECT profile_id FROM membership_chains WHERE store=? AND environment=? AND chain_id=?',
      )
      .bind(m.store, m.environment, m.chainId),
  ]);
  if (owner?.results[0]?.profile_id !== profileId)
    throw new MemberVerificationError('OTHER_ACCOUNT');
  for (const p of m.periods)
    if (!(await recordMemberPeriod(db, p, m.verifiedAt)))
      throw new MemberVerificationError('OTHER_ACCOUNT');
  await projectMembership(db, profileId, m.verifiedAt);
}

/** Keep preferences while selecting the longest valid entitlement across the owner's stores. */
export async function projectMembership(db: Db, profileId: string, now: string) {
  await db.$client
    .prepare(
      `INSERT INTO owner_memberships
    (profile_id,store,environment,chain_id,status,paid_until,grace_until,auto_renew,verified_at)
    SELECT profile_id,store,environment,chain_id,status,paid_until,grace_until,auto_renew,verified_at
    FROM membership_chains WHERE profile_id=?1
    ORDER BY CASE WHEN (status='active' AND paid_until>?2) OR (status='grace' AND grace_until>?2) THEN 1 ELSE 0 END DESC,
      CASE WHEN environment='production' THEN 1 ELSE 0 END DESC,
      CASE WHEN status='grace' THEN grace_until ELSE paid_until END DESC,verified_at DESC,store,chain_id LIMIT 1
    ON CONFLICT(profile_id) DO UPDATE SET store=excluded.store,environment=excluded.environment,chain_id=excluded.chain_id,
    status=excluded.status,paid_until=excluded.paid_until,grace_until=excluded.grace_until,auto_renew=excluded.auto_renew,
    verified_at=excluded.verified_at,revision=owner_memberships.revision+1`,
    )
    .bind(profileId, now)
    .run();
}
