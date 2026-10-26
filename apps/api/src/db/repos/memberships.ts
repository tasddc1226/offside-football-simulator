// T-11-512 클럽 멤버십 구독 원장(memberships). 구매 · 앱 시작 때 다시 보낸 거래 · 스토어 서버 알림이 같은 줄을 고친다.
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import type { Db } from '../client.js';
import { memberships } from '../schema.js';

export type MembershipChain = {
  store: 'apple' | 'google';
  chainId: string;
  until: string;
  autoRenew: boolean | null;
  test: boolean;
  verifiedAt: string;
};

/**
 * 구단주에게 구독을 묶는다(처음이면 만들고, 이미 있으면 더 늦게 확인한 값으로 고친다). 다른 구단주에게 묶인 구독이면 false.
 * 같은 구독을 두 기기에서 동시에 보내도 PK 한 줄이라 하나만 묶인다.
 */
export async function bindMembership(db: Db, profileId: string, m: MembershipChain, now: string) {
  const d1 = db.$client;
  const [, owner] = await d1.batch<{ profile_id: string }>([
    d1
      .prepare(
        `INSERT INTO memberships (store, chain_id, profile_id, until, auto_renew, test, verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (store, chain_id) DO UPDATE SET
           until = excluded.until, auto_renew = excluded.auto_renew, test = excluded.test, verified_at = excluded.verified_at
         WHERE memberships.profile_id = excluded.profile_id AND memberships.verified_at <= excluded.verified_at`,
      )
      .bind(
        m.store,
        m.chainId,
        profileId,
        m.until,
        m.autoRenew === null ? null : m.autoRenew ? 1 : 0,
        m.test ? 1 : 0,
        m.verifiedAt,
        now,
      ),
    d1
      .prepare('SELECT profile_id FROM memberships WHERE store = ? AND chain_id = ?')
      .bind(m.store, m.chainId),
  ]);
  return owner?.results[0]?.profile_id === profileId;
}

/** 서버 알림: 이미 묶인 구독만 고친다(구단주는 바꾸지 않는다). 고친 줄의 구단주, 모르는 구독이면 null. */
export async function updateMembership(db: Db, m: MembershipChain) {
  const row = await db.$client
    .prepare(
      `UPDATE memberships SET until = ?, auto_renew = ?, test = ?, verified_at = ?
       WHERE store = ? AND chain_id = ? AND verified_at <= ?
       RETURNING profile_id`,
    )
    .bind(
      m.until,
      m.autoRenew === null ? null : m.autoRenew ? 1 : 0,
      m.test ? 1 : 0,
      m.verifiedAt,
      m.store,
      m.chainId,
      m.verifiedAt,
    )
    .first<{ profile_id: string }>();
  return row?.profile_id ?? null;
}

/** 이 구단주의 가장 늦게 끝나는 구독(구독한 적이 없으면 undefined). */
export const membershipOf = (db: Db, profileId: string) =>
  db
    .select()
    .from(memberships)
    .where(eq(memberships.profileId, profileId))
    .orderBy(desc(memberships.until))
    .limit(1)
    .get();

/** 지금 구독 중인 구단주만 골라 돌려준다(서포터 뱃지). batch에 넣을 수 있게 쿼리로 돌려준다. */
export const membersOf = (db: Db, profileIds: readonly string[], now: string) =>
  db
    .selectDistinct({ profileId: memberships.profileId })
    .from(memberships)
    .where(and(inArray(memberships.profileId, [...profileIds]), gt(memberships.until, now)));

/** 지금 구독 중인가(인덱스 한 번). */
export async function isMember(db: Db, profileId: string, now: string) {
  const row = await db.$client
    .prepare('SELECT 1 AS one FROM memberships WHERE profile_id = ? AND until > ? LIMIT 1')
    .bind(profileId, now)
    .first<{ one: number }>();
  return !!row;
}
