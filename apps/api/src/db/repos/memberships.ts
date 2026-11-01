// T-11-512 클럽 멤버십 구독 원장(memberships). 구매 · 앱 시작 때 다시 보낸 거래 · 스토어 서버 알림이 같은 줄을 고친다.
import { WEB_MEMBERSHIP_DAYS, WEB_PAY_STORE } from '@offside/contracts';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import type { Db } from '../client.js';
import { memberships } from '../schema.js';

export type MembershipChain = {
  store: 'apple' | 'google' | 'xsolla';
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

/**
 * T-11-591 웹 결제(엑솔라) 멤버십: 자동 갱신 없이 주문 하나가 한 줄(chain_id = 엑솔라 주문 번호)이다. 지금 남은 혜택 끝(없으면
 * 지금)부터 WEB_MEMBERSHIP_DAYS일을 더한다. 같은 주문 웹훅을 다시 받으면 기간을 다시 더하지 않는다. 다른 구단주의 주문이면 false.
 */
export async function grantWebMembership(
  db: Db,
  p: { profileId: string; xsollaOrderId: string; test: boolean; now: string },
) {
  const d1 = db.$client;
  const seen = await d1
    .prepare('SELECT profile_id FROM memberships WHERE store = ? AND chain_id = ?')
    .bind(WEB_PAY_STORE, p.xsollaOrderId)
    .first<{ profile_id: string }>();
  if (seen) return seen.profile_id === p.profileId;
  const current = await membershipOf(db, p.profileId);
  const from = current?.until && current.until > p.now ? current.until : p.now;
  const until = new Date(Date.parse(from) + WEB_MEMBERSHIP_DAYS * 86_400_000).toISOString();
  return bindMembership(
    db,
    p.profileId,
    {
      store: WEB_PAY_STORE,
      chainId: p.xsollaOrderId,
      until,
      autoRenew: false,
      test: p.test,
      verifiedAt: p.now,
    },
    p.now,
  );
}

/** 웹 결제 멤버십 환불 · 차지백: 그 주문의 혜택을 지금 끝낸다. 모르는 주문이면 found: false, 이미 끝냈으면 already. */
export async function revokeWebMembership(db: Db, xsollaOrderId: string, now: string) {
  const d1 = db.$client;
  const cut = await d1
    .prepare(
      `UPDATE memberships SET until = ?, auto_renew = 0, verified_at = ?
       WHERE store = ? AND chain_id = ? AND until > ? RETURNING profile_id`,
    )
    .bind(now, now, WEB_PAY_STORE, xsollaOrderId, now)
    .first<{ profile_id: string }>();
  if (cut) return { found: true, already: false };
  const seen = await d1
    .prepare('SELECT 1 AS one FROM memberships WHERE store = ? AND chain_id = ?')
    .bind(WEB_PAY_STORE, xsollaOrderId)
    .first();
  return { found: !!seen, already: !!seen };
}
