import { MEMBERSHIP_BONUS, MEMBERSHIP_VERSION } from '@offside/contracts/membership';
import type { Db } from '../client.js';

/** Internal only: callers must verify the store transaction and account binding first. */
export type VerifiedMemberPeriod = {
  store: 'apple' | 'google' | 'local';
  environment: 'production' | 'sandbox' | 'local';
  transactionId: string;
  chainId: string;
  profileId: string;
  startedAt: string;
  expiresAt: string;
  paid: boolean;
  refundedAt: string | null;
};

/** Immutable identity, durable refund marker, and source-specific lots prevent replay grants. */
export async function recordMemberPeriod(db: Db, p: VerifiedMemberPeriod, now: string) {
  for (const date of [p.startedAt, p.expiresAt, now, ...(p.refundedAt ? [p.refundedAt] : [])]) {
    if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date)
      throw new Error('MEMBER_PERIOD_DATE');
  }
  if (p.expiresAt <= p.startedAt) throw new Error('MEMBER_PERIOD_RANGE');
  const d1 = db.$client;
  const key = [p.store, p.environment, p.transactionId] as const;
  const owned = 'store = ? AND environment = ? AND transaction_id = ? AND profile_id = ?';
  const result = await d1.batch<{ owner: string }>([
    d1
      .prepare(
        `INSERT INTO membership_periods
      (store, environment, transaction_id, chain_id, profile_id, started_at, expires_at, paid, benefit_version, refunded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      )
      .bind(
        ...key,
        p.chainId,
        p.profileId,
        p.startedAt,
        p.expiresAt,
        p.paid ? 1 : 0,
        MEMBERSHIP_VERSION,
        p.refundedAt,
      ),
    // A delayed active event must never undo a refund.
    d1
      .prepare(
        `UPDATE membership_periods SET refunded_at = coalesce(refunded_at, ?)
      WHERE ${owned}`,
      )
      .bind(p.refundedAt, ...key, p.profileId),
    ...Object.entries(MEMBERSHIP_BONUS).map(([item, qty]) =>
      d1
        .prepare(
          `
      INSERT INTO membership_item_lots
        (store, environment, transaction_id, profile_id, item, granted, remaining, created_at)
      SELECT store, environment, transaction_id, profile_id, ?, ?, ?, ? FROM membership_periods
      WHERE ${owned} AND paid = 1 AND refunded_at IS NULL AND started_at <= ?
        AND benefit_version = ?
      ON CONFLICT DO NOTHING`,
        )
        .bind(item, qty, qty, now, ...key, p.profileId, now, MEMBERSHIP_VERSION),
    ),
    d1
      .prepare(
        `UPDATE membership_periods SET granted_at = coalesce(granted_at, ?)
      WHERE ${owned} AND paid = 1 AND refunded_at IS NULL AND started_at <= ?`,
      )
      .bind(now, ...key, p.profileId, now),
    d1
      .prepare(
        `UPDATE membership_item_lots SET remaining = 0 WHERE ${owned}
      AND EXISTS (SELECT 1 FROM membership_periods WHERE ${owned} AND refunded_at IS NOT NULL)`,
      )
      .bind(...key, p.profileId, ...key, p.profileId),
    d1
      .prepare(
        'SELECT profile_id AS owner FROM membership_periods WHERE store = ? AND environment = ? AND transaction_id = ?',
      )
      .bind(...key),
  ]);
  return result.at(-1)?.results[0]?.owner === p.profileId;
}
