import { INVITE_REROLLS, INVITE_REWARD_MAX } from '@offside/contracts/owner-team';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { profiles, referrals } from '../schema.js';
import { eventNotificationStatements } from '../../push/events.js';
import { grantItemStatement } from './itemShop.js';
import { accountLinkedSql } from './profiles.js';

// T-11-171 친구 초대. 초대는 친구 코드로 친구 신청을 할 때 기록하고(claimReferral), 초대받은 사람이 처음 커리어를
// 은퇴시킬 때 판정한다(completeReferralStatements). 보상은 owner_items의 리롤권 장수에 더한다.

/**
 * 친구 코드로 신청한 구단주를 그 코드 주인의 초대로 적는다. 아직 은퇴시킨 커리어가 없는 사람만, 한 사람당 한 번만 적힌다.
 * 새로 적었으면 true.
 */
export async function claimReferral(db: Db, inviteeId: string, inviterId: string, now: string) {
  const r = await db.$client
    .prepare(
      `INSERT OR IGNORE INTO referrals (invitee_id, inviter_id, claimed_at)
       SELECT ?1, ?2, ?3
       WHERE NOT EXISTS (SELECT 1 FROM careers WHERE profile_id = ?1 AND status = 'retired')`,
    )
    .bind(inviteeId, inviterId, now)
    .run();
  return r.meta.changes > 0;
}

/**
 * 초대받은 사람이 커리어를 은퇴까지 마쳤다: 초대를 끝내고 두 사람에게 리롤권을 준다. 초대한 쪽은 지금까지 보상받은 초대가
 * INVITE_REWARD_MAX명 미만일 때만 받는다. 같은 batch 안에서 앞 문장이 바꾼 줄(done_at · career_id)을 조건으로 걸어
 * 다시 불려도 두 번 주지 않는다.
 */
export function completeReferralStatements(
  d1: D1Database,
  r: { inviteeId: string; inviterId: string; careerId: string },
  now: string,
) {
  const done = (extra = '') => ({
    sql: `EXISTS (SELECT 1 FROM referrals WHERE invitee_id = ? AND career_id = ? AND done_at = ?${extra})`,
    params: [r.inviteeId, r.careerId, now],
  });
  const mine = done();
  const inviterPaid = done(' AND inviter_rewarded = 1');
  const notice = (profileId: string, guard: typeof mine, title: string, body: string) =>
    eventNotificationStatements(
      d1,
      {
        profileId,
        sourceKey: `invite:${r.inviteeId}:${profileId}`,
        now,
        content: { kind: 'social', title, body, target: { type: 'screen', screen: 'team' } },
      },
      guard,
    );
  return [
    d1
      .prepare(
        `UPDATE referrals SET done_at = ?, career_id = ? WHERE invitee_id = ? AND done_at IS NULL`,
      )
      .bind(now, r.careerId, r.inviteeId),
    d1
      .prepare(
        `UPDATE referrals SET inviter_rewarded = 1
         WHERE invitee_id = ? AND career_id = ? AND done_at = ?
           AND (SELECT count(*) FROM referrals WHERE inviter_id = ? AND inviter_rewarded = 1) < ?`,
      )
      .bind(...mine.params, r.inviterId, INVITE_REWARD_MAX),
    grantItemStatement(d1, r.inviteeId, 'reroll', INVITE_REROLLS, now, mine),
    grantItemStatement(d1, r.inviterId, 'reroll', INVITE_REROLLS, now, inviterPaid),
    ...notice(
      r.inviteeId,
      mine,
      '친구 초대 보상을 받았어요', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
      `커리어를 끝까지 마쳐 선수 후보 리롤권 ${INVITE_REROLLS}장을 받았어요.`, // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
    ),
    ...notice(
      r.inviterId,
      inviterPaid,
      '초대한 친구가 커리어를 마쳤어요', // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
      `친구 초대 보상으로 선수 후보 리롤권 ${INVITE_REROLLS}장을 받았어요.`, // i18n-ignore: 푸시·알림함 문구는 기기 언어를 모른다
    ),
  ];
}

/**
 * 은퇴 때 부른다: 아직 판정 전인 초대가 있고 지금 로그인한 구단주면 초대를 끝내고 보상을 준다. 초대가 없으면 PK 조회 한 번.
 */
export async function completeInvite(db: Db, inviteeId: string, careerId: string, now: string) {
  const [open] = await db
    .select({ inviterId: referrals.inviterId })
    .from(referrals)
    .innerJoin(profiles, eq(profiles.id, referrals.inviteeId))
    .where(
      and(
        eq(referrals.inviteeId, inviteeId),
        isNull(referrals.doneAt),
        isNull(profiles.deletedAt),
        accountLinkedSql(),
      ),
    );
  if (!open) return;
  await db.$client.batch(
    completeReferralStatements(db.$client, { inviteeId, inviterId: open.inviterId, careerId }, now),
  );
}

/** 친구 화면의 초대 현황: 내가 초대한 사람 수(진행 · 완료 · 보상)와 나를 초대한 사람. */
export async function inviteCountsOf(db: Db, profileId: string) {
  const [[counts], [byRow]] = await db.batch([
    db
      .select({
        pending: sql<number>`coalesce(sum(${referrals.doneAt} IS NULL), 0)`,
        done: sql<number>`coalesce(sum(${referrals.doneAt} IS NOT NULL), 0)`,
        rewarded: sql<number>`coalesce(sum(${referrals.inviterRewarded}), 0)`,
      })
      .from(referrals)
      .where(eq(referrals.inviterId, profileId)),
    db
      .select({
        inviterId: referrals.inviterId,
        nickname: profiles.nickname,
        doneAt: referrals.doneAt,
      })
      .from(referrals)
      .innerJoin(profiles, eq(profiles.id, referrals.inviterId))
      .where(eq(referrals.inviteeId, profileId)),
  ]);
  return {
    pending: Number(counts?.pending ?? 0),
    done: Number(counts?.done ?? 0),
    rewarded: Number(counts?.rewarded ?? 0),
    invitedBy: byRow ?? null,
  };
}

/** 프로필 삭제 batch용: 내가 초대한 줄과 초대받은 줄. */
export const deleteReferralsStatements = (db: Db, profileId: string) =>
  [
    db
      .delete(referrals)
      .where(or(eq(referrals.inviteeId, profileId), eq(referrals.inviterId, profileId))),
  ] as const;
